"""Synthetic regressions; scores here are not measured review-quality improvements."""
import json
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
import test_literature_review as fixtures
from test_literature_review import paper, FakeRetriever, FakeSynthesizer
from literature_review.models import LiteratureReviewRequest, SearchRun
from literature_review.retrieval import deduplicate, rank_candidates, parse_crossref
from literature_review.serialization import assign_citation_labels, citation_for, evidence_counts
from literature_review.synthesis import ReviewSynthesizer, source_record
from literature_review.service import LiteratureReviewService
from literature_review.audit import verify_citations, narrative_pairs, audit_summary


def version_pair():
    abstract = ('A controlled comparison examined student assessment validity in higher education. '
                'Students completed staged submissions and oral examinations across two courses. '
                'Scores were compared with an independent supervised demonstration of competence. '
                'The authors discuss measurement uncertainty and recommend further validation.')
    preprint = paper(paper_id='old').model_copy(update={'title': 'Assessment validity and independent competence',
        'doi': '10.1234/preprint', 'publication_type': 'preprint', 'year': 2025, 'abstract': abstract})
    article = preprint.model_copy(update={'paper_id': 'new', 'doi': '10.1234/article',
        'publication_type': 'journal-article', 'year': 2026})
    return preprint, article


class VersionAndRankingTests(unittest.TestCase):
    def test_versions_merge_and_prefer_published_in_both_orders(self):
        preprint, article = version_pair()
        for values in [[preprint, article], [article, preprint]]:
            merged = deduplicate(values)
            self.assertEqual(len(merged), 1)
            self.assertEqual(merged[0].doi, article.doi)
            self.assertEqual(merged[0].alternate_versions[0]['doi'], preprint.doi)

    def test_similar_abstracts_alone_do_not_merge_distinct_papers(self):
        first, second = version_pair()
        second.publication_type = 'preprint'
        self.assertEqual(len(deduplicate([first, second])), 2)
        second.publication_type = 'article'
        second.authors = ['Other, Person']
        self.assertEqual(len(deduplicate([first, second])), 2)

    def test_same_title_with_different_abstract_is_not_version_evidence(self):
        first, second = version_pair()
        second.abstract = 'A different experiment on an unrelated population and outcome.'
        self.assertEqual(len(deduplicate([first, second])), 2)

    def test_explicit_version_relationship_survives_title_changes(self):
        first, second = version_pair()
        second.title = 'Revised title'
        second.abstract = 'Rewritten abstract'
        second.related_dois = [first.doi]
        self.assertEqual(len(deduplicate([first, second])), 1)

    def test_crossref_parses_version_relationship(self):
        value = parse_crossref({'title': ['Study'], 'relation': {'is-preprint-of': [
            {'id-type': 'doi', 'id': 'https://doi.org/10.1234/Published'}]}}, 'query')
        self.assertEqual(value.related_dois, ['10.1234/published'])

    def test_late_relevant_candidate_precedes_retrieval_order(self):
        irrelevant = [paper(paper_id=f'P{i}').model_copy(update={
            'title': 'Ocean currents', 'abstract': 'Ocean temperatures and marine circulation.'}) for i in range(30)]
        relevant = paper(paper_id='P31')
        ranked = rank_candidates(irrelevant + [relevant], LiteratureReviewRequest(query='AI assessment design'))
        self.assertEqual(ranked[0].paper_id, 'P31')
        self.assertEqual([p.paper_id for p in ranked[1:]], [p.paper_id for p in irrelevant])

    def test_collision_suffixes_are_deterministic_and_match_references(self):
        first = paper(paper_id='P1').model_copy(update={'title': 'Zebra', 'doi': '10.1234/z'})
        second = paper(paper_id='P2').model_copy(update={'title': 'Alpha', 'doi': '10.1234/a'})
        assign_citation_labels([first, second])
        self.assertEqual(second.citation_label, 'Smith, 2024a')
        self.assertEqual(first.citation_label, 'Smith, 2024b')
        self.assertIn('(2024a)', citation_for(second).formatted)
        assign_citation_labels([second, first])
        self.assertEqual(second.citation_year, '2024a')

    def test_reference_urls_and_publication_labels(self):
        value = paper().model_copy(update={'doi': None, 'url': 'https://example.test/authors/person>',
                                          'publication_type': 'dissertation'})
        reference = citation_for(value)
        self.assertIsNone(reference.url)
        self.assertIn('[Dissertation]', reference.formatted)
        value.url = 'https://example.test/paper/study>'
        self.assertEqual(citation_for(value).url, 'https://example.test/paper/study')


class EvidenceAndPipelineTests(unittest.IsolatedAsyncioTestCase):
    async def test_synthesis_omits_access_diagnostics_and_retains_author_gaps(self):
        evidence = [await FakeSynthesizer().extract(paper(paper_id='P1'))]
        value = await FakeSynthesizer().synthesize(evidence, LiteratureReviewRequest(query='AI assessment'))
        complete = AsyncMock(return_value=json.dumps(fixtures.SynthesisTests.draft(value)))
        await ReviewSynthesizer(complete).synthesize(evidence, LiteratureReviewRequest(query='AI assessment'))
        payload = json.loads(complete.call_args.args[0].split('\nDATA:\n')[1])
        extraction = payload['evidence'][0]['extraction']
        self.assertNotIn('unreported_in_abstract', extraction)
        self.assertIn('author_stated_gaps', extraction)

    async def test_evidence_type_requires_owned_classification_passages(self):
        evidence = await FakeSynthesizer().extract(paper(paper_id='P1'))
        extraction = evidence.extraction.model_dump()
        extraction['evidence_type'] = 'self_report'
        complete = AsyncMock(return_value=json.dumps(extraction))
        with self.assertRaises(HTTPException):
            await ReviewSynthesizer(complete).extract(evidence.metadata)

    async def test_deduplicated_pipeline_counts_and_ids_use_canonical_work(self):
        preprint, article = version_pair()
        retriever = FakeRetriever()
        retriever.search = AsyncMock(return_value=([preprint, article], [
            SearchRun(provider='openalex', query='assessment', status='ok', returned=2)]))
        service = LiteratureReviewService(retriever, FakeSynthesizer(), AsyncMock())
        with patch('literature_review.service.stage'):
            result = await service.generate(LiteratureReviewRequest(query='Assessment validity', min_papers=1, verify_claims=False))
        self.assertEqual(result.methodology.unique_records, 1)
        self.assertEqual(sum(result.methodology.evidence_counts.values()), 1)
        self.assertEqual(result.papers[0].metadata.doi, article.doi)
        self.assertEqual(result.citations[0].paper_id, 'P1')
        self.assertTrue(all('old' not in p.passage_id and 'new' not in p.passage_id for p in result.papers[0].passages))
        self.assertIn('alternate preprint was merged', result.synthesized_review_text)

    async def test_failed_query_scope_table_and_conclusion_are_rendered(self):
        service = LiteratureReviewService(FakeRetriever(partial=True), FakeSynthesizer(), AsyncMock())
        with patch('literature_review.service.stage'):
            result = await service.generate(LiteratureReviewRequest(query='AI assessment', min_papers=1, verify_claims=False))
        text = result.synthesized_review_text
        for phrase in ['## Scope', '## Evidence base', '## Study characteristics', '## Conclusion',
                       'Incomplete search: crossref', 'query: AI assessment', '## Limitations']:
            self.assertIn(phrase, text)

    async def test_screening_budget_uses_ranked_candidates_and_records_unscreened(self):
        values = [paper(paper_id=f'original{i}').model_copy(update={'doi': f'10.1234/{i}',
            'title': f'Ocean circulation {i}', 'abstract': 'Ocean temperature and marine circulation. ' * 5}) for i in range(30)]
        relevant = paper().model_copy(update={'doi': '10.1234/relevant'})
        retriever = FakeRetriever()
        retriever.search = AsyncMock(return_value=(values + [relevant], [
            SearchRun(provider='openalex', query='assessment', status='ok', returned=31)]))
        synth = FakeSynthesizer()
        original = synth.screen
        screened = []
        async def screen(candidates, request):
            screened.extend(candidates)
            return await original(candidates, request)
        synth.screen = screen
        with patch('literature_review.service.stage'):
            result = await LiteratureReviewService(retriever, synth, AsyncMock()).generate(
                LiteratureReviewRequest(query='AI assessment design', min_papers=1, max_papers=1, verify_claims=False))
        self.assertEqual(screened[0].doi, relevant.doi)
        self.assertEqual(len(screened), 12)
        self.assertEqual(result.methodology.unscreened, 19)
        self.assertEqual(len(result.methodology.candidate_ranking), 31)
        self.assertIn('19 eligible metadata records were not screened', result.synthesized_review_text)

    async def test_publication_type_is_separate_from_evidence_design(self):
        value = await FakeSynthesizer().extract(paper(paper_id='P1').model_copy(update={'publication_type': 'dissertation'}))
        value.extraction.evidence_type = 'self_report'
        self.assertEqual(evidence_counts([value])['self_report'], 1)
        self.assertEqual(evidence_counts([value])['direct_empirical'], 0)

    async def test_repair_is_reaudited_and_returned_audit_matches_final_text(self):
        synthesizer = FakeSynthesizer()
        async def repair(evidence, request, old, results):
            value = await synthesizer.synthesize(evidence, request)
            for section in value.sections:
                for block in section.paragraphs:
                    block.text = 'Students reported mixed views after revision.'
            return value
        synthesizer.repair = AsyncMock(side_effect=repair)
        texts = []
        async def audit(text, sources, complete):
            texts.append(text)
            label = 'unsupported' if len(texts) == 1 else 'supported'
            return [{**row, 'label': label, 'flags': [], 'issue': None,
                     'what_abstract_supports': 'Students reported mixed views', 'suggested_fix': None}
                    for row in narrative_pairs(text, sources)]
        service = LiteratureReviewService(FakeRetriever(), synthesizer, AsyncMock())
        with patch('literature_review.service.stage'), patch('literature_review.service.verify_citations', side_effect=audit):
            result = await service.generate(LiteratureReviewRequest(query='AI assessment', min_papers=1))
        self.assertEqual(len(texts), 2)
        self.assertNotEqual(texts[0], texts[1])
        self.assertIn('after revision', result.synthesized_review_text)
        self.assertTrue(result.quality_checks.claim_audit['repair_attempted'])
        self.assertTrue(all(row['sentence'] in texts[1] for row in result.quality_checks.claim_audit['results']))
        self.assertEqual(result.quality_checks.status, 'passed')

    async def test_extracted_findings_are_not_added_to_audit(self):
        seen = []
        async def audit(text, sources, complete):
            seen.append(text)
            return [{**row, 'label': 'supported', 'flags': [], 'issue': None,
                     'what_abstract_supports': 'Mixed views.', 'suggested_fix': None}
                    for row in narrative_pairs(text, sources)]
        synth = FakeSynthesizer()
        original = synth.extract
        async def extract(p):
            value = await original(p)
            value.extraction.key_findings[0].text = 'EXTRACTION_ONLY_SENTINEL'
            return value
        synth.extract = extract
        with patch('literature_review.service.stage'), patch('literature_review.service.verify_citations', side_effect=audit):
            result = await LiteratureReviewService(FakeRetriever(), synth, AsyncMock()).generate(
                LiteratureReviewRequest(query='AI assessment', min_papers=1))
        self.assertNotIn('EXTRACTION_ONLY_SENTINEL', seen[0])
        self.assertEqual(result.key_findings[0].text, 'EXTRACTION_ONLY_SENTINEL')


class StrictAuditTests(unittest.IsolatedAsyncioTestCase):
    def sources(self):
        return [{'source_id': 'P1', 'citation_label': 'Smith, 2024a', 'passages': [
                    {'passage_id': 'P1:E1', 'text': 'Students reported mixed views about assessment.'}]},
                {'source_id': 'P2', 'citation_label': 'Smith, 2024b', 'passages': [
                    {'passage_id': 'P2:E1', 'text': 'Lecturers proposed an assessment framework.'}]}]

    def finding(self, **updates):
        return {'id': 1, 'paper_id': 'P1', 'label': 'supported', 'flags': [], 'passage_id': 'P1:E1',
                'evidence_quote': 'Students reported mixed views', 'suggested_fix': None,
                'correct_source': None, **updates}

    async def test_verbatim_quote_passes_and_whitespace_only_normalization_allowed(self):
        complete = AsyncMock(return_value=json.dumps({'results': [self.finding(
            evidence_quote='Students  reported\nmixed views')]}))
        result = await verify_citations('Mixed views (Smith, 2024a).', self.sources(), complete)
        self.assertEqual(result[0]['label'], 'supported')

    async def test_invented_and_wrong_source_quotations_fail_closed(self):
        for update in [{'evidence_quote': 'Students demonstrated improved learning'},
                       {'passage_id': 'P2:E1', 'evidence_quote': 'Lecturers proposed'},
                       {'evidence_quote': None}, {'evidence_quote': 'students reported mixed views'}]:
            complete = AsyncMock(return_value=json.dumps({'results': [self.finding(**update)]}))
            with self.subTest(update=update):
                result = await verify_citations('Mixed views (Smith, 2024a).', self.sources(), complete)
                self.assertEqual(result[0]['label'], 'unverifiable')
                self.assertIsNone(result[0]['evidence_quote'])
                self.assertFalse(audit_summary(result, 'Mixed views (Smith, 2024a).', self.sources())['pass'])
            self.assertEqual(complete.await_count, 2)

    async def test_pair_coverage_requires_both_cited_sources(self):
        text = 'Different perspectives (Smith, 2024a; Smith, 2024b).'
        complete = AsyncMock(return_value=json.dumps({'results': [self.finding()]}))
        with self.assertRaises(HTTPException):
            await verify_citations(text, self.sources(), complete)

    async def test_quote_longer_than_fifteen_words_cannot_be_supported(self):
        sources = self.sources()[:1]
        quote = ' '.join(f'word{i}' for i in range(16))
        sources[0]['passages'][0]['text'] = quote
        complete = AsyncMock(return_value=json.dumps({'results': [self.finding(evidence_quote=quote)]}))
        result = await verify_citations('A claim (Smith, 2024a).', sources, complete)
        self.assertEqual(result[0]['label'], 'unverifiable')
        self.assertIn('invalid_evidence_quote', result[0]['flags'])

    def test_sentence_count_is_separate_from_pair_count_and_suffixes_resolve(self):
        text = 'Different perspectives (Smith, 2024a; Smith, 2024b).'
        pairs = narrative_pairs(text, self.sources())
        self.assertEqual([row['paper_id'] for row in pairs], ['P1', 'P2'])
        summary = audit_summary([{**row, 'label': 'supported'} for row in pairs], text, self.sources())
        self.assertEqual(summary['sentence_count'], 1)
        self.assertEqual(summary['sentence_source_pairs'], 2)

    def test_paragraph_citation_cannot_leak_into_uncited_paragraph(self):
        pairs = narrative_pairs('A finding (Smith, 2024a).\n\nAn uncited claim.', self.sources())
        self.assertEqual([row['paper_id'] for row in pairs], ['P1', None])

    async def test_failed_attempt_does_not_leave_partial_results(self):
        sources = self.sources()
        text = 'Views (Smith, 2024a; Smith, 2024b).'
        second = self.finding(paper_id='P2', passage_id='P2:E1', evidence_quote='invented')
        first_attempt = {'results': [self.finding(), second]}
        first_raw = json.dumps(first_attempt)
        second['evidence_quote'] = 'Lecturers proposed'
        complete = AsyncMock(side_effect=[first_raw, json.dumps({'results': [self.finding(), second]})])
        result = await verify_citations(text, sources, complete)
        self.assertEqual(len(result), 2)
        self.assertEqual(complete.await_count, 2)


if __name__ == '__main__':
    unittest.main()
