import asyncio
import json
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

from author_names import clean_authors, apa_reference
from citation_guard import accept_refinement, cited_keys
from source_relevance import screen_sources, reformulate_queries
from main import app, EssayRequest, Source, select_evidence


class RelevanceTests(unittest.TestCase):
    def test_zenodo_guide_is_labelled_grey_even_if_model_calls_it_conceptual(self):
        source = Source(title='Evidence Contracts: A Guide', doi='10.5281/zenodo.123',
                        publication_type='report', details='An untested assessment-design framework.')
        raw = {'results': [{'candidate_id': 'C1', 'score': 3, 'scope': 'direct',
            'evidence_kind': 'conceptual', 'reason': 'A relevant design proposal.'}]}
        accepted, report = asyncio.run(screen_sources('AI in assessments?', [source], AsyncMock(return_value=json.dumps(raw))))
        self.assertEqual(accepted[0].evidence_kind, 'grey_literature')
        self.assertIn('peer review is not established', accepted[0].relevance_reason)
        self.assertEqual(report[0]['reported_evidence_kind'], 'conceptual')

    def test_record_exclusions_and_actor_task_screening(self):
        sources = [Source(title='PREreview of a depression study', details='An unrelated review comment.'),
                   Source(title='Dataset', publication_type='dataset', details='A shared dataset.'),
                   Source(title='Student record searches', details='Administrative retrieval.'),
                   Source(title='Instructor feedback', details='Teachers summarise peer feedback.'),
                   Source(title='AI assessment design guide', details='An untested Zenodo guide.')]
        raw = {'results': [
            {'candidate_id': 'C3', 'score': 0, 'scope': 'off_topic', 'evidence_kind': 'empirical', 'reason': 'Administration, not assessment.'},
            {'candidate_id': 'C4', 'score': 2, 'scope': 'context', 'evidence_kind': 'empirical', 'reason': 'Instructor-side use.'},
            {'candidate_id': 'C5', 'score': 3, 'scope': 'direct', 'evidence_kind': 'grey_literature', 'reason': 'Relevant proposal, not evidence it works.'}]}
        completion = AsyncMock(return_value=json.dumps(raw))
        accepted, report = asyncio.run(screen_sources('Student AI in assessed work?', sources, completion))
        self.assertEqual([s.title for s in accepted], ['AI assessment design guide'])
        self.assertEqual(accepted[0].evidence_kind, 'grey_literature')
        self.assertEqual([row['score'] for row in report], [0, 0, 0, 2, 3])
        candidate_data = json.loads(completion.call_args.args[0].split('\n')[-1])
        self.assertEqual([row['candidate_id'] for row in candidate_data['candidates']], ['C3', 'C4', 'C5'])

    def test_incomplete_screening_cannot_pass(self):
        with self.assertRaises(HTTPException) as context:
            asyncio.run(screen_sources('Question', [Source(title='Paper', details='Evidence.')],
                AsyncMock(return_value='{"results":[]}')))
        self.assertEqual(context.exception.status_code, 502)

    def test_requery_uses_original_question_and_stops_at_threshold(self):
        async def screen(question, sources, complete):
            self.assertEqual(question, 'Original question')
            accepted = [s.model_copy(update={'relevance_score': 4}) for s in sources if s.title.startswith('Good')]
            return accepted, []
        discovery = AsyncMock(side_effect=[[Source(title='Bad')],
            [Source(title='Good one'), Source(title='Good two'), Source(title='Good three')]])
        with TestClient(app), patch('main.discover_sources', discovery), patch('main.screen_sources', side_effect=screen), patch('main.reformulate_queries', new=AsyncMock(return_value=['focused query', 'another query'])):
            accepted, report, warnings = asyncio.run(select_evidence(EssayRequest(title='Original question')))
        self.assertEqual(len(accepted), 3)
        self.assertEqual(report['queries'], ['Original question', 'focused query'])
        self.assertEqual(discovery.await_count, 2)

    def test_insufficient_sources_do_not_trigger_padding(self):
        with TestClient(app), patch('main.discover_sources', new=AsyncMock(return_value=[Source(title='Wrong scope')])) as discovery, patch('main.screen_sources', new=AsyncMock(return_value=([], []))), patch('main.reformulate_queries', new=AsyncMock(return_value=['query two', 'query three'])):
            with self.assertRaises(HTTPException) as context:
                asyncio.run(select_evidence(EssayRequest(title='Question')))
        self.assertEqual(context.exception.status_code, 424)
        self.assertEqual(discovery.await_count, 3)
        self.assertEqual(context.exception.detail['retrieval']['status'], 'insufficient_evidence')

    def test_duplicate_reformulations_are_rejected(self):
        with self.assertRaises(HTTPException):
            asyncio.run(reformulate_queries('Question', [], AsyncMock(return_value='{"queries":["same","same"]}')))


class NameAndDateTests(unittest.TestCase):
    def test_full_names_duplicate_strings_and_apa_initials(self):
        self.assertEqual(clean_authors(['Adam Obidowski; Adam Obidowski', 'Adam Obidowski']), ['Adam Obidowski'])
        sources = [{'source_id': 'S2', 'title': 'Guide', 'authors': ['Vicente Pelechano'], 'year': '2026'},
                   {'source_id': 'S5', 'title': 'Paper', 'authors': ['Adam Obidowski; Adam Obidowski'], 'year': '2026'}]
        self.assertEqual(cited_keys('Pelechano (2026) proposes a framework (Obidowski, 2026).', sources), {'S2', 'S5'})
        self.assertEqual(apa_reference(sources[0]), 'Pelechano, V. (2026). Guide.')
        self.assertEqual(apa_reference(sources[1]), 'Obidowski, A. (2026). Paper.')

    def test_percentage_and_duplicate_year_occurrences_do_not_trigger_date_guard(self):
        source = {'source_id': 'S1', 'title': 'Paper', 'authors': ['Mozelius, P.'], 'year': '2026'}
        draft = 'Mozelius (2026) reports accuracy "just above 50%". Mozelius (2026) describes limitations.'
        refined = 'Mozelius (2026) reports accuracy "just above 50%" and describes limitations in that study.'
        accepted, problems = accept_refinement(draft, refined, {'main_idea': 'Detection', 'source_ids': ['S1']}, [source])
        self.assertTrue(accepted, problems)
        accepted, problems = accept_refinement(draft, refined.replace('2026', '2025'), {'main_idea': 'Detection'}, [source])
        self.assertFalse(accepted)
        self.assertTrue(any("added: ['2025']" in problem for problem in problems))


if __name__ == '__main__':
    unittest.main()
