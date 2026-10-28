import asyncio
import unittest
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
import httpx
from main import app, Source
from citation_audit import sentence_spans


class EssayTests(unittest.TestCase):
    def setUp(self):
        for name, value in [('build_brief', SimpleNamespace(model_dump=lambda: {})),
                            ('build_argument_plan', {}), ('review_argument', {'status': 'passed', 'issues': [], 'judgment': 'Test review.'})]:
            task_patch = patch('main.' + name, new=AsyncMock(return_value=value))
            task_patch.start()
            self.addCleanup(task_patch.stop)
        self.discovery = patch('main.discover_sources', new=AsyncMock(return_value=[
            Source(title='Retrieved paper', authors=['Smith, A.'], year='2024',
                   details='Actual indexed abstract.', apa_citation='Smith, A. (2024). Retrieved paper.'),
            Source(title='Second paper', authors=['Jones, A.'], year='2023', details='Other actual evidence.'),
            Source(title='Third paper', authors=['Rogowski, A.'], year='2025', details='A fair caution.')]))
        self.discovery_mock = self.discovery.start()
        self.addCleanup(self.discovery.stop)
        async def supported_audit(essay, sources, complete):
            return [{**row, 'label': 'supported', 'issue': None, 'what_abstract_supports': 'Test evidence.',
                     'suggested_fix': None, 'correct_source': None} for row in sentence_spans(essay)]
        self.auditor = patch('main.verify_citations', side_effect=supported_audit)
        self.auditor.start()
        self.addCleanup(self.auditor.stop)
        async def accept_sources(question, sources, complete):
            return sources, [{'candidate_id': f'C{i+1}', 'title': s.title, 'score': 4,
                'scope': 'direct', 'accepted': True, 'evidence_kind': 'empirical', 'reason': 'Test relevance.'}
                for i, s in enumerate(sources)]
        screening = patch('main.screen_sources', side_effect=accept_sources)
        screening.start()
        self.addCleanup(screening.stop)
        retry = patch('main.reformulate_queries', new=AsyncMock(return_value=['retry one', 'retry two']))
        retry.start()
        self.addCleanup(retry.stop)

    def _wait_for_job(self, client, job_id):
        import time
        for _ in range(100):
            job = client.get(f'/v1/essays/jobs/{job_id}').json()
            if job['status'] in {'done', 'failed'}:
                return job
            time.sleep(0.05)
        self.fail('job did not finish')

    def test_job_returns_the_same_essay_as_generate(self):
        body = {'title': 'Flexible deadlines', 'outline': [{'main_idea': s} for s in ['Intro', 'Body', 'End']], 'citation_markup': True}
        with patch.dict('os.environ', {'ESSAY_API_KEY': 'test', 'ESSAY_MODEL': 'test-model'}):
            with TestClient(app) as client, patch('main.complete', new=AsyncMock(return_value='Supported argument (Smith, 2024).')):
                started = client.post('/v1/essays/jobs', json=body)
                self.assertEqual(started.status_code, 202)
                job = self._wait_for_job(client, started.json()['job_id'])
                self.assertEqual(job['status'], 'done')
                self.assertEqual(job['stage'], 'done')
                self.assertIsNone(job['error'])
                direct = client.post('/v1/essays/generate', json=body).json()
                self.assertEqual(job['result']['tagged_section_texts'], direct['tagged_section_texts'])
                self.assertEqual(job['result']['word_count'], direct['word_count'])

    def test_job_failure_is_reported_not_raised(self):
        self.discovery_mock.return_value = []
        body = {'title': 'No sources anywhere', 'outline': [{'main_idea': s} for s in ['Intro', 'Body', 'End']]}
        with patch.dict('os.environ', {'ESSAY_API_KEY': 'test', 'ESSAY_MODEL': 'test-model'}):
            with TestClient(app) as client, patch('main.complete', new=AsyncMock(return_value='Text.')):
                job = self._wait_for_job(client, client.post('/v1/essays/jobs', json=body).json()['job_id'])
                self.assertEqual(job['status'], 'failed')
                self.assertIsNone(job['result'])
                self.assertIn('status_code', job['error'])

    def test_unknown_job_is_404(self):
        with TestClient(app) as client:
            self.assertEqual(client.get('/v1/essays/jobs/nope').status_code, 404)

    def test_timed_out_model_call_is_retried_once(self):
        import main
        calls = []
        class Client:
            async def post(self, *args, **kwargs):
                calls.append(1)
                if len(calls) == 1:
                    raise httpx.ReadTimeout('slow')
                return httpx.Response(200, json={'choices': [{'message': {'content': 'ok'}, 'finish_reason': 'stop'}]},
                                      request=httpx.Request('POST', 'http://x'))
        main.app.state.client = Client()
        with patch.dict('os.environ', {'ESSAY_API_KEY': 'test', 'ESSAY_MODEL': 'test-model'}), patch('main.asyncio.sleep', new=AsyncMock()):
            self.assertEqual(asyncio.run(main.complete('hi', tokens=10)), 'ok')
        self.assertEqual(len(calls), 2)

    def test_default_discovers_sources_and_includes_references(self):
        with patch.dict('os.environ', {'ESSAY_API_KEY': 'test', 'ESSAY_MODEL': 'test-model'}):
            with TestClient(app) as client, patch('main.complete', new=AsyncMock(return_value='Supported argument (Smith, 2024).')) as completion:
                result = client.post('/v1/essays/generate', json={'title': 'Flexible deadlines',
                    'outline': [{'main_idea': s} for s in ['Intro', 'Body', 'End']]})
                self.assertEqual(result.status_code, 200)
                self.assertTrue(result.json()['references'])
                self.assertEqual(len(result.json()['references']), 1)
                self.assertNotIn('Jones', result.json()['full_text'])
                self.assertEqual(len(result.json()['sources']), 3)
                self.assertIn('Actual indexed abstract.', completion.call_args_list[0].args[0])
                self.discovery_mock.assert_awaited_once_with('Flexible deadlines', 10)

    def test_empty_search_is_explicit_and_can_be_disabled(self):
        self.discovery_mock.return_value = []
        with patch.dict('os.environ', {'ESSAY_API_KEY': 'test', 'ESSAY_MODEL': 'test-model'}):
            with TestClient(app) as client, patch('main.complete', new=AsyncMock(return_value='Unsourced draft.')):
                payload = {'title': 'Test', 'outline': [{'main_idea': s} for s in ['Intro', 'Body', 'End']]}
                self.assertEqual(client.post('/v1/essays/generate', json=payload).status_code, 424)
                payload['auto_sources'] = False
                result = client.post('/v1/essays/generate', json=payload)
                self.assertEqual(result.status_code, 200)
                self.assertEqual(result.json()['references'], [])

    def test_references_and_full_text(self):
        with patch.dict('os.environ', {'ESSAY_API_KEY': 'test', 'ESSAY_MODEL': 'test-model'}):
            with TestClient(app) as client, patch('main.complete', new=AsyncMock(return_value='Essay paragraph (Smith, 2024).')):
                response = client.post('/v1/essays/generate', json={
                    'title': 'Test', 'outline': [{'main_idea': s} for s in ['Intro', 'Body', 'End']],
                    'sources': [{'title': 'Supplied source', 'apa_citation': 'Smith, A. (2024). Supplied source.',
                                 'authors': ['Smith, A.'], 'year': '2024', 'details': 'Supplied evidence.'}]})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['references'], ['Smith, A. (2024). Supplied source.'])
        self.assertIn('\n\nReferences\n\nSmith', body['full_text'])
        self.assertNotIn('References', body['essay'])

    def test_doi_resolution_and_failure_fallback(self):
        with patch.dict('os.environ', {'ESSAY_API_KEY': 'test', 'ESSAY_MODEL': 'test-model'}):
            with TestClient(app) as client, patch('main.complete', new=AsyncMock(return_value='Essay paragraph (Smith, 2024).')) as completion:
                resolved = httpx.Response(200, request=httpx.Request('POST', 'http://test/resolve'), json={
                    'citation': {'title': 'Resolved title', 'authors': [{'last_name': 'Smith', 'first_name': 'A'}],
                                 'publication_year': 2024}, 'apa7': 'Resolved APA reference.'})
                with patch.object(app.state.client, 'post', new=AsyncMock(return_value=resolved)):
                    response = client.post('/v1/essays/generate', json={
                        'title': 'Test', 'outline': [{'main_idea': s} for s in ['Intro', 'Body', 'End']],
                        'sources': [{'title': 'Original', 'doi': '10.1234/test', 'details': 'Evidence excerpt.'}]})
                self.assertIn('Resolved title.', response.json()['references'][0])
                self.assertIn('Resolved title', completion.call_args_list[0].args[0])
                self.assertEqual(response.json()['sources'][0]['details'], 'Evidence excerpt.')
                with patch.object(app.state.client, 'post', new=AsyncMock(side_effect=httpx.ConnectError('Unavailable'))):
                    response = client.post('/v1/essays/generate', json={
                        'title': 'Test', 'outline': [{'main_idea': s} for s in ['Intro', 'Body', 'End']],
                        'sources': [{'title': 'Original', 'doi': '10.1234/test'}]})
                self.assertEqual(response.status_code, 200)
                self.assertTrue(any('DOI resolution failed' in w for w in response.json()['warnings']))

    def test_sequential_context_and_revision_citation_guard(self):
        calls = []
        async def fake(prompt, **kwargs):
            calls.append(prompt)
            return [
                '{"outline":[{"main_idea":"Thesis"},{"main_idea":"Argument"},{"main_idea":"Resolution"}]}',
                'Opening (Smith, 2024).', 'Changed (Jones, 2023).',
                'Distinct body.', 'Refined body.', 'Closing.', 'Refined closing.',
            ][len(calls) - 1]
        with patch.dict('os.environ', {'ESSAY_API_KEY': 'test', 'ESSAY_MODEL': 'test-model'}):
            with TestClient(app) as client, patch('main.complete', side_effect=fake):
                result = client.post('/v1/essays/generate', json={'title': 'Test essay'})
        self.assertEqual(result.status_code, 200)
        body = result.json()
        self.assertIn('Opening (Smith, 2024).', body['essay'])
        self.assertIn('Opening (Smith, 2024).', calls[3])
        self.assertIn('Refined body.', calls[5])
        self.assertTrue(any('changed citations' in w for w in body['warnings']))

    def test_invalid_outline_and_provider_failure(self):
        with patch.dict('os.environ', {'ESSAY_API_KEY': 'test', 'ESSAY_MODEL': 'test-model'}):
            with TestClient(app) as client:
                result = client.post('/v1/essays/generate', json={'title': 'Test', 'outline': [{'main_idea': 'Only'}]})
                self.assertEqual(result.status_code, 422)
                with patch('main.complete', new=AsyncMock(return_value='not json')):
                    self.assertEqual(client.post('/v1/essays/generate', json={'title': 'Test'}).status_code, 502)

    def test_malformed_outline_is_retried_once_before_drafting(self):
        async def completion(prompt, **kwargs):
            if kwargs.get('purpose') == 'plan':
                completion.plans += 1
                return '{"outline":{}}' if completion.plans == 1 else json.dumps({'outline': [
                    {'main_idea': name, 'subtopics': [], 'source_ids': []} for name in ['Intro', 'Body', 'End']]})
            return 'A supported point (Smith, 2024).'
        completion.plans = 0
        with patch.dict('os.environ', {'ESSAY_API_KEY': 'test', 'ESSAY_MODEL': 'test-model'}), TestClient(app) as client:
            with patch('main.complete', side_effect=completion):
                response = client.post('/v1/essays/generate', json={'title': 'Test', 'refine': False})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(completion.plans, 2)

    def test_missing_configuration(self):
        with patch.dict('os.environ', {}, clear=True), patch('main.openrouter_config', return_value={'key': '', 'url': ''}), TestClient(app) as client:
            self.assertEqual(client.post('/v1/essays/generate', json={'title': 'Test'}).status_code, 503)

    def test_openrouter_settings_are_used_when_no_provider_is_configured(self):
        import main
        router = {'key': 'router-key', 'url': 'https://openrouter.ai/api/v1'}
        with patch.dict('os.environ', {}, clear=True), patch('main.openrouter_config', return_value=router):
            self.assertEqual(main.provider_config(), ('router-key', 'google/gemini-2.5-flash', 'https://openrouter.ai/api/v1'))
        with patch.dict('os.environ', {'ESSAY_API_KEY': 'own', 'ESSAY_MODEL': 'm'}, clear=True), patch('main.openrouter_config', return_value=router):
            self.assertEqual(main.provider_config()[0], 'own')   # an explicit essay-service key always wins


if __name__ == '__main__':
    unittest.main()
