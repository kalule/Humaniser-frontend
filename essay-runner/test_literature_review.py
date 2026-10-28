import asyncio
import json
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from main import app
from literature_review.dependencies import get_literature_review_service
from literature_review.models import (Paper, SearchRun, LiteratureReviewRequest, ScreeningDecision,
    EvidenceExtraction, SupportedFinding, PaperEvidence, EvidencePassage, SupportedText, ReviewSection, Synthesis)
from literature_review.retrieval import (LiteratureRetriever, normalize_doi, deduplicate, filter_metadata, parse_openalex, parse_crossref)
from literature_review.synthesis import ReviewSynthesizer, balanced_selection, source_record
from literature_review.service import LiteratureReviewService
from argument_planning import evidence_catalogue
from citation_audit import sentence_spans


ABSTRACT = ('A survey of 16 university students examined assessment design. Students reported mixed views '
            'of generative AI and requested explicit assessment rules. The abstract does not establish causal learning effects.')


def paper(**updates):
    return Paper(title='AI assessment design', authors=['Smith, Alex'], year=2024,
        doi='10.1234/example', abstract=ABSTRACT, providers=['openalex'], matched_queries=['AI assessment'], **updates)


class FakeRetriever:
    def __init__(self, failed=False, partial=False):
        self.failed, self.partial = failed, partial

    async def search(self, request):
        if self.failed:
            return [], [SearchRun(provider='openalex', query='AI assessment', status='failed')]
        runs = [SearchRun(provider='openalex', query='AI assessment', status='ok', returned=1)]
        if self.partial:
            runs.append(SearchRun(provider='crossref', query='AI assessment', status='failed'))
        return [paper()], runs

    async def verify_dois(self, papers):
        return [value.model_copy(update={'doi_status': 'confirmed'}) for value in papers]


class FakeSynthesizer:
    async def screen(self, papers, request):
        return [ScreeningDecision(paper_id=p.paper_id, include=True, score=4, subtopic='Assessment', reason='Direct study.') for p in papers]

    async def extract(self, value):
        catalogue = evidence_catalogue([source_record(value)])
        return PaperEvidence(metadata=value, extraction=EvidenceExtraction(study_design='survey', population='University students',
            sample_size='16', methodology='Survey', method_passage_ids=[catalogue[0]['passage_id']],
            key_findings=[SupportedFinding(text='Students reported mixed views of AI.', passage_ids=[catalogue[1]['passage_id']])],
            reported_limitations=[], unreported_in_abstract=['Long-term outcomes']),
            passages=[EvidencePassage(**{'passage_id': row['passage_id'], 'text': row['text']}) for row in catalogue])

    async def synthesize(self, evidence, request):
        value = evidence[0]
        block = SupportedText(text='Students reported mixed views of generative AI.',
            source_ids=[value.metadata.paper_id], passage_ids=[value.passages[1].passage_id])
        return Synthesis(summary=block.model_copy(), sections=[ReviewSection(heading='Perceptions', paragraphs=[block.model_copy()]),
            ReviewSection(heading='Assessment design', paragraphs=[block.model_copy()])], methodology_comparison=block.model_copy(),
            evidence_gaps=[], contradictions=[], evidence_base=block.model_copy(), conclusion=block.model_copy())


class DTOTests(unittest.TestCase):
    def test_query_or_topic_and_strict_parameters(self):
        self.assertEqual(LiteratureReviewRequest(query='AI assessment').question, 'AI assessment')
        self.assertEqual(LiteratureReviewRequest(query='search terms', topic='Review question').question, 'Review question')
        for body in [{}, {'query': '  '}, {'query': 'Valid', 'max_papers': 0},
                     {'query': 'Valid', 'min_papers': 4, 'max_papers': 2},
                     {'query': 'Valid', 'search': {'providers': ['unknown']}},
                     {'query': 'Valid', 'search': {'year_from': 2025, 'year_to': 2020}},
                     {'query': 'Valid', 'search': {'year_to': 3000}},
                     {'query': 'Valid', 'domain_filters': ['']}, {'query': 'Valid', 'unexpected': True}]:
            with self.subTest(body=body), self.assertRaises(ValidationError):
                LiteratureReviewRequest.model_validate(body)


class RetrievalTests(unittest.IsolatedAsyncioTestCase):
    def test_provider_parsers_and_abstract_word_order(self):
        work = {'title': 'Study', 'doi': 'https://doi.org/10.1234/UPPER', 'publication_year': 2024,
            'authorships': [{'author': {'display_name': 'Alex Smith'}}],
            'abstract_inverted_index': {'second': [1], 'First': [0]}, 'type': 'article'}
        self.assertEqual(parse_openalex(work, 'query').abstract, 'First second')
        self.assertEqual(parse_openalex(work, 'query').doi, '10.1234/upper')
        self.assertIsNone(parse_openalex({**work, 'is_retracted': True}, 'query'))
        crossref = parse_crossref({'title': ['A &amp; B'], 'DOI': '10.1234/UPPER', 'abstract': '<jats:p>Some evidence.</jats:p>',
            'author': [{'family': 'Smith', 'given': 'Alex'}], 'published': {'date-parts': [[2024]]}}, 'query')
        self.assertEqual(crossref.title, 'A & B')
        self.assertEqual(crossref.abstract, 'Some evidence.')
        self.assertEqual(crossref.authors, ['Smith, Alex'])

    def test_dedup_prefers_richer_metadata_and_merges_provenance(self):
        short = paper().model_copy(update={'abstract': 'Short.', 'doi': normalize_doi('https://doi.org/10.1234/EXAMPLE')})
        rich = paper().model_copy(update={'providers': ['crossref'], 'matched_queries': ['other query']})
        result = deduplicate([short, rich])
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].abstract, ABSTRACT)
        self.assertEqual(result[0].providers, ['crossref', 'openalex'])
        self.assertEqual(len(result[0].matched_queries), 2)
        self.assertEqual(len(deduplicate([rich.model_copy(update={'doi': None}), rich])), 1)

    def test_metadata_filter_has_explicit_reasons(self):
        request = LiteratureReviewRequest(query='AI assessment', search={'year_from': 2020})
        values = [paper(paper_id='P1'), paper(paper_id='P2').model_copy(update={'publication_type': 'dataset'}),
                  paper(paper_id='P3').model_copy(update={'year': 2019}), paper(paper_id='P4').model_copy(update={'year': None}),
                  paper(paper_id='P5').model_copy(update={'abstract': ''})]
        kept, exclusions = filter_metadata(values, request)
        self.assertEqual([value.paper_id for value in kept], ['P1'])
        self.assertEqual(len(exclusions), 4)

    async def test_provider_failure_is_sanitized_and_other_provider_survives(self):
        async def request(url, **kwargs):
            if 'openalex' in url:
                raise httpx.ConnectError('secret-key-and-email')
            return httpx.Response(200, request=httpx.Request('GET', url), json={'message': {'items': [
                {'title': ['A study'], 'abstract': ABSTRACT, 'DOI': '10.1234/study'}]}})
        client = AsyncMock()
        client.get.side_effect = request
        retriever = LiteratureRetriever(client, {'enabled': True, 'key': 'secret-key', 'email': 'private@example.test'})
        values, runs = await retriever.search(LiteratureReviewRequest(query='AI assessment'))
        self.assertEqual(len(values), 1)
        self.assertEqual([run.status for run in runs], ['failed', 'ok'])
        self.assertNotIn('secret', json.dumps([run.model_dump() for run in runs]))
        openalex_call = next(call for call in client.get.call_args_list if 'openalex' in call.args[0])
        self.assertEqual(openalex_call.kwargs['headers']['Authorization'], 'Bearer secret-key')
        self.assertNotIn('api_key', openalex_call.kwargs['params'])

    async def test_doi_404_is_not_called_invalid_and_title_mismatch_is_flagged(self):
        client = AsyncMock()
        client.get.side_effect = [httpx.Response(404, request=httpx.Request('GET', 'https://test')),
            httpx.Response(200, request=httpx.Request('GET', 'https://test'), json={'message': {'title': ['Unrelated chemistry study']}})]
        retriever = LiteratureRetriever(client, {'enabled': True, 'key': '', 'email': ''})
        values = await retriever.verify_dois([paper(), paper()])
        self.assertEqual([value.doi_status for value in values], ['not_indexed_in_crossref', 'metadata_mismatch'])


class SynthesisTests(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def draft(value):
        data = value.model_dump()
        data.pop('validation_warnings', None)
        blocks = [data[key] for key in ['summary', 'evidence_base', 'conclusion'] if data.get(key)] + [p for section in data['sections'] for p in section['paragraphs']] + [data['methodology_comparison']] + data['evidence_gaps'] + data['contradictions']
        for block in blocks:
            block.pop('source_ids')
        return data

    async def test_synthesis_derives_non_contiguous_source_ids_from_real_passage_owners(self):
        evidence = [await FakeSynthesizer().extract(paper(paper_id=pid)) for pid in ['P2', 'P21']]
        value = await FakeSynthesizer().synthesize(evidence, LiteratureReviewRequest(query='AI assessment'))
        raw = self.draft(value)
        raw['summary']['passage_ids'] = ['P21:E2', 'P2:E2']
        complete = AsyncMock(return_value=json.dumps(raw))
        result = await ReviewSynthesizer(complete).synthesize(evidence, LiteratureReviewRequest(query='AI assessment'))
        self.assertEqual(result.summary.source_ids, ['P21', 'P2'])
        self.assertEqual(complete.await_count, 1)
        prompt = complete.call_args.args[0]
        schema = json.loads(prompt.split('\nJSON schema:\n', 1)[1].split('\nDATA:\n', 1)[0])
        self.assertNotIn('source_ids', schema['$defs']['DraftText']['properties'])
        self.assertIn('P21:E2', schema['$defs']['DraftText']['properties']['passage_ids']['items']['enum'])

    async def test_single_source_contradiction_is_omitted_with_warning_without_losing_valid_review(self):
        evidence = [await FakeSynthesizer().extract(paper(paper_id='P2'))]
        value = await FakeSynthesizer().synthesize(evidence, LiteratureReviewRequest(query='AI assessment'))
        raw = self.draft(value)
        raw['contradictions'] = [{**raw['summary'], 'passage_ids': ['P2:E1', 'P2:E2']}]
        result = await ReviewSynthesizer(AsyncMock(return_value=json.dumps(raw))).synthesize(evidence, LiteratureReviewRequest(query='AI assessment'))
        self.assertEqual(result.contradictions, [])
        self.assertEqual(len(result.sections), 2)
        self.assertTrue(result.validation_warnings)

    async def test_contradiction_with_two_real_passage_owners_is_preserved(self):
        evidence = [await FakeSynthesizer().extract(paper(paper_id=pid).model_copy(update={'doi': f'10.1234/{pid}'})) for pid in ['P2', 'P21']]
        value = await FakeSynthesizer().synthesize(evidence, LiteratureReviewRequest(query='AI assessment'))
        raw = self.draft(value)
        raw['contradictions'] = [{'text': 'The studies differ.', 'passage_ids': ['P2:E1', 'P21:E1']}]
        result = await ReviewSynthesizer(AsyncMock(return_value=json.dumps(raw))).synthesize(evidence, LiteratureReviewRequest(query='AI assessment'))
        self.assertEqual(result.contradictions[0].source_ids, ['P2', 'P21'])
        self.assertEqual(result.validation_warnings, [])

    async def test_missing_method_evidence_retry_receives_exact_failure_and_prior_output(self):
        value = paper(paper_id='P16').model_copy(update={'abstract':
            'This systematic review examined higher education institutions. It included 21 research studies published between 2023 and 2025.'})
        raw = {'study_design': 'Systematic review', 'population': 'Higher education institutions',
               'sample_size': '21 research studies', 'methodology': None, 'method_passage_ids': [],
               'key_findings': [], 'reported_limitations': [], 'unreported_in_abstract': []}
        corrected = {**raw, 'method_passage_ids': ['P16:E1', 'P16:E2']}
        complete = AsyncMock(side_effect=[json.dumps(raw), json.dumps(corrected)])
        with self.assertLogs('humaniser.literature_review', level='WARNING'):
            result = await ReviewSynthesizer(complete).extract(value)
        self.assertEqual(result.extraction.method_passage_ids, ['P16:E1', 'P16:E2'])
        repair_prompt = complete.call_args_list[1].args[0]
        self.assertIn('missing_method_evidence', repair_prompt)
        self.assertIn('previous_response', repair_prompt)
        self.assertIn('P16:E2', repair_prompt)
        self.assertIn('Evidence IDs are opaque; never renumber them', repair_prompt)

    async def test_persistent_schema_error_reports_stage_without_leaking_model_content(self):
        complete = AsyncMock(return_value='{"study_design":"SECRET-CONTENT"}')
        with self.assertLogs('humaniser.literature_review', level='WARNING') as captured, self.assertRaises(HTTPException) as error:
            await ReviewSynthesizer(complete).extract(paper(paper_id='P16'))
        detail = error.exception.detail
        self.assertEqual(detail['stage'], 'extraction')
        self.assertEqual(detail['paper_id'], 'P16')
        self.assertTrue(detail['validation_errors'])
        self.assertNotIn('SECRET-CONTENT', json.dumps(detail) + ' '.join(captured.output))

    def test_balanced_selection_does_not_fill_with_one_subtopic(self):
        values = [paper(paper_id=f'P{i}') for i in range(1, 5)]
        decisions = [ScreeningDecision(paper_id=f'P{i}', include=True, score=4 if i < 4 else 3,
            subtopic='A' if i < 4 else 'B', reason='Relevant') for i in range(1, 5)]
        self.assertEqual([value.paper_id for value in balanced_selection(values, decisions, 2)], ['P1', 'P4'])

    async def test_screening_omissions_fail_closed_after_one_retry(self):
        complete = AsyncMock(return_value='{"decisions":[]}')
        synthesizer = ReviewSynthesizer(complete)
        with self.assertRaises(HTTPException):
            await synthesizer.screen([paper(paper_id='P1')], LiteratureReviewRequest(query='AI assessment'))
        self.assertEqual(complete.await_count, 2)

    async def test_extraction_cannot_bind_to_another_paper(self):
        raw = {'study_design': None, 'population': None, 'sample_size': None, 'methodology': None,
               'method_passage_ids': [], 'key_findings': [{'text': 'An invented finding.', 'passage_ids': ['P99:E1']}],
               'reported_limitations': [], 'unreported_in_abstract': []}
        synthesizer = ReviewSynthesizer(AsyncMock(return_value=json.dumps(raw)))
        with self.assertRaises(HTTPException):
            await synthesizer.extract(paper(paper_id='P1'))

    async def test_synthesis_rejects_unknown_citations_and_unbound_passages(self):
        evidence = [await FakeSynthesizer().extract(paper(paper_id='P1'))]
        valid = await FakeSynthesizer().synthesize(evidence, LiteratureReviewRequest(query='AI assessment'))
        raw = self.draft(valid)
        raw['summary']['passage_ids'] = ['P99:E1']
        synthesizer = ReviewSynthesizer(AsyncMock(return_value=json.dumps(raw)))
        with self.assertRaises(HTTPException):
            await synthesizer.synthesize(evidence, LiteratureReviewRequest(query='AI assessment'))


class PipelineTests(unittest.IsolatedAsyncioTestCase):
    async def test_omitted_optional_claim_is_visible_and_not_marked_clean(self):
        synthesizer = FakeSynthesizer()
        original = synthesizer.synthesize
        async def synthesize(evidence, request):
            value = await original(evidence, request)
            value.validation_warnings = ['Omitted one-source cross-study contradiction.']
            return value
        synthesizer.synthesize = synthesize
        service = LiteratureReviewService(FakeRetriever(), synthesizer, AsyncMock())
        with patch('literature_review.service.stage'):
            result = await service.generate(LiteratureReviewRequest(query='AI assessment', min_papers=1, verify_claims=False))
        self.assertEqual(result.quality_checks.status, 'needs_review')
        self.assertIn('Omitted one-source cross-study contradiction.', result.warnings)

    async def test_one_failed_extraction_is_excluded_and_all_tasks_finish_before_response(self):
        retriever = FakeRetriever()
        retriever.search = AsyncMock(return_value=([paper(), paper().model_copy(update={'doi': '10.1234/second'})],
            [SearchRun(provider='openalex', query='query', status='ok', returned=2)]))
        synthesizer = FakeSynthesizer()
        original_extract = synthesizer.extract
        completed = []
        async def extract(value):
            if value.paper_id == 'P1':
                raise HTTPException(502, {'code': 'review_model_validation_failed', 'stage': 'extraction',
                    'validation_errors': [{'code': 'missing_method_evidence', 'path': ['method_passage_ids']}]})
            await asyncio.sleep(.01)
            completed.append(value.paper_id)
            return await original_extract(value)
        synthesizer.extract = extract
        service = LiteratureReviewService(retriever, synthesizer, AsyncMock())
        with patch('literature_review.service.stage'):
            result = await service.generate(LiteratureReviewRequest(query='AI assessment', min_papers=1, max_papers=2, verify_claims=False))
        self.assertEqual(completed, ['P2'])
        self.assertEqual([value.metadata.paper_id for value in result.papers], ['P2'])
        self.assertEqual(result.methodology.included, 1)
        self.assertEqual(result.quality_checks.status, 'needs_review')
        self.assertTrue(any(value.stage == 'extraction' and value.paper_id == 'P1' for value in result.methodology.exclusions))
        self.assertTrue(any('failed evidence extraction' in warning for warning in result.warnings))

    async def test_extraction_failure_cannot_bypass_minimum_paper_requirement(self):
        synthesizer = FakeSynthesizer()
        synthesizer.extract = AsyncMock(side_effect=HTTPException(502, 'Invalid evidence'))
        service = LiteratureReviewService(FakeRetriever(), synthesizer, AsyncMock())
        with patch('literature_review.service.stage'), self.assertRaises(HTTPException) as error:
            await service.generate(LiteratureReviewRequest(query='AI assessment', min_papers=1, max_papers=1))
        self.assertEqual(error.exception.status_code, 502)
        self.assertEqual(error.exception.detail['code'], 'review_extraction_failed')
        self.assertEqual(error.exception.detail['stage'], 'extraction')
        self.assertEqual(error.exception.detail['usable_papers'], 0)
        self.assertTrue(error.exception.detail['request_id'])

    async def test_doi_mismatch_is_removed_before_final_paper_limit(self):
        retriever = FakeRetriever()
        values = [paper(paper_id=f'P{i}').model_copy(update={'doi': f'10.1234/{i}', 'title': f'Assessment study {i}'}) for i in range(1, 4)]
        retriever.search = AsyncMock(return_value=(values, [SearchRun(provider='openalex', query='query', status='ok', returned=3)]))
        retriever.verify_dois = AsyncMock(side_effect=lambda papers: [value.model_copy(update={
            'doi_status': 'metadata_mismatch' if value.title.endswith('1') else 'confirmed'}) for value in papers])
        service = LiteratureReviewService(retriever, FakeSynthesizer(), AsyncMock())
        with patch('literature_review.service.stage'):
            result = await service.generate(LiteratureReviewRequest(query='AI assessment', min_papers=2,
                max_papers=2, verify_claims=False))
        self.assertEqual([value.metadata.paper_id for value in result.papers], ['P2', 'P3'])
        self.assertEqual(result.methodology.included, 2)
        self.assertTrue(any(value.stage == 'doi' for value in result.methodology.exclusions))

    async def test_timeout_is_sanitized_and_correlated(self):
        retriever = FakeRetriever()
        retriever.search = AsyncMock(side_effect=TimeoutError())
        service = LiteratureReviewService(retriever, FakeSynthesizer(), AsyncMock())
        with patch('literature_review.service.stage'), self.assertRaises(HTTPException) as context:
            await service.generate(LiteratureReviewRequest(query='AI assessment'))
        self.assertEqual(context.exception.status_code, 504)
        self.assertEqual(context.exception.detail['code'], 'review_timeout')
        self.assertTrue(context.exception.detail['request_id'])

    async def test_complete_response_counts_evidence_and_only_real_citations(self):
        service = LiteratureReviewService(FakeRetriever(partial=True), FakeSynthesizer(), AsyncMock())
        with self.assertLogs('humaniser.literature_review', level='INFO') as captured:
            result = await service.generate(LiteratureReviewRequest(query='AI assessment', min_papers=1,
                max_papers=2, target_words=500, verify_claims=False))
        self.assertEqual(result.methodology.included, 1)
        self.assertEqual(result.methodology.cited, 1)
        self.assertEqual(result.quality_checks.status, 'not_checked')
        self.assertEqual(result.papers[0].metadata.doi_status, 'confirmed')
        self.assertEqual(result.citations[0].paper_id, 'P1')
        self.assertIn('Smith, A.', result.citations[0].formatted)
        self.assertIn('## Search methodology', result.synthesized_review_text)
        self.assertIn('## References', result.synthesized_review_text)
        self.assertTrue(result.warnings)
        self.assertTrue(all(json.loads(row.split(':', 2)[-1])['request_id'] == result.request_id for row in captured.output))

    async def test_all_provider_failure_and_insufficient_evidence_are_distinct(self):
        for retriever, minimum, expected in [(FakeRetriever(failed=True), 1, 503), (FakeRetriever(), 3, 424)]:
            service = LiteratureReviewService(retriever, FakeSynthesizer(), AsyncMock())
            with patch('literature_review.service.stage'), self.assertRaises(HTTPException) as context:
                await service.generate(LiteratureReviewRequest(query='AI assessment', min_papers=minimum, verify_claims=False))
            self.assertEqual(context.exception.status_code, expected)
            self.assertTrue(context.exception.detail['request_id'])

    async def test_claim_audit_results_are_exposed(self):
        async def audit(text, sources, complete):
            return [{**row, 'label': 'unsupported', 'issue': 'invented_detail', 'what_abstract_supports': 'No support.',
                     'suggested_fix': None, 'correct_source': None} for row in sentence_spans(text)]
        service = LiteratureReviewService(FakeRetriever(), FakeSynthesizer(), AsyncMock())
        with patch('literature_review.service.stage'), patch('literature_review.service.verify_citations', side_effect=audit):
            result = await service.generate(LiteratureReviewRequest(query='AI assessment', min_papers=1))
        self.assertEqual(result.quality_checks.status, 'needs_review')
        self.assertGreater(result.quality_checks.claim_audit['summary']['unsupported_or_misattributed'], 0)

    async def test_unexpected_failure_does_not_leak_secret_in_logs_or_response(self):
        retriever = FakeRetriever()
        retriever.search = AsyncMock(side_effect=RuntimeError('SECRET-TOKEN'))
        service = LiteratureReviewService(retriever, FakeSynthesizer(), AsyncMock())
        with self.assertLogs('humaniser.literature_review', level='INFO') as captured, self.assertRaises(HTTPException) as context:
            await service.generate(LiteratureReviewRequest(query='Private user question'))
        self.assertEqual(context.exception.status_code, 500)
        self.assertNotIn('SECRET', json.dumps(context.exception.detail) + ' '.join(captured.output))
        self.assertNotIn('Private user question', ' '.join(captured.output))


class RouteTests(unittest.TestCase):
    def setUp(self):
        self.service = LiteratureReviewService(FakeRetriever(), FakeSynthesizer(), AsyncMock())
        app.dependency_overrides[get_literature_review_service] = lambda: self.service
        self.addCleanup(app.dependency_overrides.clear)

    def test_route_response_openapi_and_request_id(self):
        with TestClient(app) as client, patch('literature_review.service.stage'):
            result = client.post('/v1/literature-reviews/generate', json={'topic': 'AI assessment', 'max_papers': 2,
                'min_papers': 1, 'verify_claims': False, 'target_words': 500})
            self.assertEqual(result.status_code, 200, result.text)
            self.assertEqual(result.headers['X-Request-ID'], result.json()['request_id'])
            operation = client.get('/openapi.json').json()['paths']['/v1/literature-reviews/generate']['post']
            self.assertEqual(operation['tags'], ['Literature reviews'])
            self.assertIn('424', operation['responses'])

    def test_input_validation_and_busy_budget(self):
        with TestClient(app) as client:
            self.assertEqual(client.post('/v1/literature-reviews/generate', json={}).status_code, 422)
            app.state.slots = asyncio.Semaphore(0)
            response = client.post('/v1/literature-reviews/generate', json={'query': 'AI assessment'})
            self.assertEqual(response.status_code, 429)
            self.assertEqual(response.headers['Retry-After'], '2')

    def test_service_failure_sets_correlation_header(self):
        self.service.retriever = FakeRetriever(failed=True)
        with TestClient(app) as client, patch('literature_review.service.stage'):
            response = client.post('/v1/literature-reviews/generate', json={'query': 'AI assessment'})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.headers['X-Request-ID'], response.json()['detail']['request_id'])


if __name__ == '__main__':
    unittest.main()
