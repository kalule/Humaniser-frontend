import tempfile
import unittest
import re
from unittest.mock import patch
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient
from pydantic import ValidationError
from main import create_app
from store import Store
from thesis_models import ThesisRequest
from thesis_pipeline import check_sources, word_targets, install


def payload():
    return dict(topic='Green infrastructure and urban heat mitigation', field='Environmental science',
                institution='Example University', peer_reviewed_dois=['10.1234/a', '10.1234/b', '10.1234/c'])


class ThesisTests(unittest.TestCase):
    def test_chapter_composition_is_chunked_and_abstract_is_last(self):
        request = ThesisRequest(**payload(), target_pages=30)
        generator = SimpleNamespace(PipelineValidationError=ValueError, get_word_count_targets=lambda level: {})
        install(generator, request.model_dump())
        records = [SimpleNamespace(id=f'cite_{i}', source_type='journal', doi=f'10.1234/{key}',
                    verification_status='multi_source_confirmed', to_dict=lambda: {}) for i, key in enumerate('abc')]
        prompts = []
        def generate(prompt, generation_config):
            prompts.append(prompt)
            count = int(re.search(r'write about (\d+) words', prompt).group(1))
            return SimpleNamespace(text='word ' * (count-3) + '{cite_0} {cite_1} {cite_2}')
        def audit(*args, **kwargs):
            return {'report': '# Passed', 'verdicts': [SimpleNamespace(citation_id=f'cite_{i}', verdict='RELEVANT') for i in range(3)]}
        with tempfile.TemporaryDirectory() as root:
            folder = Path(root)
            ctx = SimpleNamespace(model=SimpleNamespace(generate_content=generate),
                word_targets=generator.get_word_count_targets('master'),
                citation_database=SimpleNamespace(citations=records), scribe_output='Evidence excerpts',
                tracker=SimpleNamespace(update_phase=lambda *a, **k: None),
                folders={'research': folder, 'drafts': folder})
            with patch.dict('sys.modules', {'utils.citation_claim_verifier': SimpleNamespace(run_citation_claim_verification=audit)}):
                generator.run_compose_phase(ctx)
            self.assertEqual(len(ctx.thesis_chapters), 7)
            self.assertEqual(ctx.thesis_chapters[-1][0].kind, 'abstract')
            self.assertGreater(len(prompts), 7)
            self.assertTrue((folder / 'thesis_methodology.md').exists())
            self.assertIn('Do not fabricate', prompts[0])

    def test_outline_page_and_source_validation(self):
        request = ThesisRequest(**payload())
        self.assertEqual(len(request.chapters), 7)
        for page_count in [29, 81]:
            with self.assertRaises(ValidationError):
                ThesisRequest(**payload(), target_pages=page_count)
        with self.assertRaises(ValidationError):
            ThesisRequest(**{**payload(), 'peer_reviewed_dois': ['10.1234/a']})
        with self.assertRaises(ValidationError):
            ThesisRequest(**{**payload(), 'chapters': list(reversed([c.model_dump() for c in request.chapters]))})

    def test_length_budget_and_strict_source_threshold(self):
        request = ThesisRequest(**payload(), target_pages=80)
        targets = word_targets(request, lambda level: {'min_citations': 25})
        self.assertEqual(targets['total'], '24000-24000')
        chapter = request.chapters[1]
        records = [SimpleNamespace(id=f'cite_{i}', source_type='journal', doi=f'10.1234/{key}',
                                   verification_status='multi_source_confirmed') for i, key in enumerate('abc')]
        db = SimpleNamespace(citations=records)
        text = '{cite_0} {cite_1} {cite_2}'
        curated = set(request.peer_reviewed_dois)
        self.assertEqual(len(check_sources(text, db, chapter, curated, ValueError)), 3)
        records[0].verification_status = 'llm_unverified'
        with self.assertRaises(ValueError):
            check_sources(text, db, chapter, curated, ValueError)
        with self.assertRaises(ValueError):
            check_sources(text + ' {cite_999}', db, chapter, curated, ValueError)

    def test_routes_type_boundaries_events_and_bundle(self):
        with tempfile.TemporaryDirectory() as root, TestClient(create_app(root, 's'*32, run_jobs=False)) as client:
            headers = {'X-Runner-Secret': 's'*32}
            self.assertEqual(client.post('/api/thesis/generate', json=payload()).status_code, 401)
            response = client.post('/api/thesis/generate', json=payload(), headers=headers)
            self.assertEqual(response.status_code, 202)
            job_id = response.json()['id']
            url = response.json()['status_url']
            store = Store(root)
            store.update(job_id, phase='chapter:introduction')
            state = client.get(url, headers=headers).json()
            self.assertEqual(state['events'][0]['phase'], 'chapter:introduction')
            self.assertEqual(state['status'], 'Queued')
            output = Path(root) / job_id / 'output'
            output.mkdir(parents=True)
            (output / 'thesis_bundle.zip').write_bytes(b'bundle')
            store.update(job_id, status='Completed')
            download = client.get(f'/api/thesis/download/{job_id}/thesis_bundle.zip', headers=headers)
            self.assertEqual(download.content, b'bundle')
            paper = client.post('/v1/research-papers', headers=headers, json={'topic': 'An ordinary research paper'}).json()['id']
            self.assertEqual(client.get(f'/api/thesis/status/{paper}', headers=headers).status_code, 404)


if __name__ == '__main__':
    unittest.main()
