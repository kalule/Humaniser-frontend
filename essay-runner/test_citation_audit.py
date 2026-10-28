import asyncio
import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

from citation_guard import accept_refinement, cited_keys, reference_coverage
from citation_audit import audit_summary, verify_citations, repair_by_index, sentence_spans
from main import app


SOURCES = [
    {'source_id': 'S1', 'title': 'Flexible deadlines', 'authors': ['Hills, A.', 'Peacock, B.'], 'year': '2022',
     'details': 'Students unanimously valued the policy and frequently described reduced stress.'},
    {'source_id': 'S2', 'title': 'Coupons', 'authors': ['Zannella, A.', 'Sutherland, B.'], 'year': '2025',
     'details': 'Students reported improved mental health and engagement.'},
    {'source_id': 'S3', 'title': 'Perceptions', 'authors': ['Kennette, A.', 'Rivers, B.'], 'year': '2024',
     'details': 'Students reported they would have a more positive view of instructors.'},
    {'source_id': 'S4', 'title': 'Flexible education', 'authors': ['Rogowski, A.'], 'year': '2025',
     'details': 'A caution about flexible education generally; not specific to deadlines.'},
]


class GuardTests(unittest.TestCase):
    def test_narrative_parenthetical_multiple_and_unicode(self):
        text = 'Hills and Peacock (2022) discuss stress. Others disagree (Zannella & Sutherland, 2025; Rogowski, 2025).'
        self.assertEqual(cited_keys(text, SOURCES), {'S1', 'S2', 'S4'})
        self.assertEqual(cited_keys('Zannella et al. (2025) discuss coupons.', SOURCES), {'S2'})

    def test_assigned_and_drafted_sources_cannot_disappear(self):
        ok, problems = accept_refinement('Rogowski (2025) offers a caution.', 'Some critics offer a caution.',
            {'main_idea': 'Objection', 'source_ids': ['S4']}, SOURCES)
        self.assertFalse(ok)
        self.assertIn('S4', ';'.join(problems))
        self.assertEqual(reference_coverage('Hills & Peacock (2022) discuss stress.', SOURCES), ['S2', 'S3', 'S4'])

    def test_extra_sources_and_large_shortening_rejected(self):
        ok, problems = accept_refinement('This is an extended section explaining several distinct points clearly.',
            'Rogowski (2025) disagrees.', {'main_idea': 'Body'}, SOURCES)
        self.assertFalse(ok)
        self.assertTrue(any('unassigned' in p for p in problems))
        self.assertTrue(any('30%' in p for p in problems))

    def test_ambiguous_author_year_not_counted_as_two_sources(self):
        duplicate = {**SOURCES[0], 'source_id': 'S5', 'title': 'Another Hills paper'}
        sources = [SOURCES[0], duplicate]
        self.assertEqual(cited_keys('Hills (2022) reports a finding.', sources), set())
        summary = audit_summary([], '', sources)
        self.assertEqual(summary['ambiguous_sources'], ['S1', 'S5'])
        self.assertFalse(summary['pass'])

    def test_title_only_and_no_date(self):
        source = {'source_id': 'T', 'title': 'Policy Report', 'authors': [], 'year': None}
        self.assertEqual(cited_keys('The report discusses policy (Policy Report, n.d.).', [source]), {'T'})


class AuditTests(unittest.TestCase):
    def setUp(self):
        for name, value in [('build_brief', SimpleNamespace(model_dump=lambda: {})),
                            ('build_argument_plan', {}), ('review_argument', {'status': 'passed', 'issues': [], 'judgment': 'Test review.'})]:
            task_patch = patch('main.' + name, new=AsyncMock(return_value=value))
            task_patch.start()
            self.addCleanup(task_patch.stop)
        async def accepted(question, sources, complete):
            return sources, []
        screening = patch('main.screen_sources', side_effect=accepted)
        screening.start()
        self.addCleanup(screening.stop)

    def test_long_audit_batches_cover_every_sentence(self):
        essay = ' '.join(f'Sentence {number} makes a claim.' for number in range(25))
        async def completion(prompt, **kwargs):
            batch = json.loads(prompt.rsplit('\n', 1)[1])['sentences']
            return json.dumps({'results': [{'id': row['id'], 'label': 'supported', 'issue': None,
                'what_abstract_supports': 'Supplied test evidence.', 'suggested_fix': None,
                'correct_source': None} for row in batch]})
        async def check():
            complete = AsyncMock(side_effect=completion)
            results = await verify_citations(essay, SOURCES, complete)
            self.assertEqual([row['id'] for row in results], list(range(1, 26)))
            self.assertEqual(complete.await_count, 2)
        asyncio.run(check())

    def test_repair_that_drops_assigned_source_remains_needs_review(self):
        async def fake_audit(essay, sources, complete):
            return [{**row, 'label': 'unsupported' if 'Strong claim' in row['sentence'] else 'supported',
                'issue': 'overstated_strength' if 'Strong claim' in row['sentence'] else None,
                'what_abstract_supports': 'Perceptions only.', 'suggested_fix': 'Students described perceptions.',
                'correct_source': None} for row in sentence_spans(essay)]
        with patch.dict('os.environ', {'ESSAY_API_KEY': 'test', 'ESSAY_MODEL': 'test-model'}), TestClient(app) as client:
            with patch('main.complete', new=AsyncMock(return_value='Strong claim (Hills, 2022).')), patch('main.verify_citations', side_effect=fake_audit):
                response = client.post('/v1/essays/generate', json={
                    'title': 'Test', 'refine': False, 'resolve_references': False,
                    'outline': [{'main_idea': s, 'source_ids': ['S1']} for s in ['Intro', 'Body', 'Conclusion']],
                    'sources': [SOURCES[0]]})
        report = response.json()['citation_audit']
        self.assertEqual(report['status'], 'needs_review')
        self.assertEqual(report['summary']['unused_accepted_sources'], ['S1'])
        self.assertEqual(len(report['summary']['missing_assignments']), 3)
        self.assertFalse(report['summary']['pass'])

    def test_absent_support_is_not_treated_as_supported_and_issue_is_normalized(self):
        async def check():
            raw = {'results': [{'id': 1, 'label': 'unsupported', 'issue': 'missing_evidence',
                'what_abstract_supports': None, 'suggested_fix': None, 'correct_source': None}]}
            results = await verify_citations('Zannella and Sutherland (2025) required justification.', SOURCES,
                AsyncMock(return_value=json.dumps(raw)))
            self.assertEqual(results[0]['label'], 'unsupported')
            self.assertEqual(results[0]['issue'], 'invented_detail')
            self.assertEqual(results[0]['reported_issue'], 'missing_evidence')
            self.assertFalse(audit_summary(results, '', SOURCES)['pass'])
        asyncio.run(check())

    def test_existing_essay_audit_does_not_edit_unless_requested(self):
        essay = 'Students justified extensions (Zannella & Sutherland, 2025).'
        async def fake_audit(essay, sources, complete):
            return [{**row, 'label': 'unsupported', 'issue': 'invented_detail',
                'what_abstract_supports': 'No such requirement.', 'suggested_fix': None,
                'correct_source': None} for row in sentence_spans(essay)]
        with patch.dict('os.environ', {'ESSAY_API_KEY': 'test', 'ESSAY_MODEL': 'test-model'}), TestClient(app) as client:
            with patch('main.verify_citations', side_effect=fake_audit) as verifier:
                result = client.post('/v1/essays/audit', json={'essay': essay, 'sources': SOURCES})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()['essay'], essay)
        self.assertEqual(result.json()['citation_audit']['status'], 'needs_review')
        self.assertEqual(verifier.await_count, 1)

    def test_sentence_offsets_preserve_initials_and_narrative_citations(self):
        text = 'A. Smith describes a policy. Hills et al. (2022) discuss stress.\n\nThe survey measures perceptions.'
        spans = sentence_spans(text)
        self.assertEqual(len(spans), 3)
        for row in spans:
            self.assertEqual(text[row['start']:row['end']], row['sentence'])

    def test_repair_changes_only_target_occurrence(self):
        text = 'This claim is repeated. This claim is repeated.'
        spans = sentence_spans(text)
        result = {**spans[1], 'label': 'unsupported', 'suggested_fix': 'A corrected claim.'}
        repaired, count = repair_by_index(text, [result])
        self.assertEqual(repaired, 'This claim is repeated. A corrected claim.')
        self.assertEqual(count, 1)

    def test_incomplete_or_duplicate_audit_fails_closed(self):
        async def check():
            for raw in ['{"results":[]}', '{"results":[{"id":999}]}', 'not json']:
                with self.assertRaises(HTTPException) as exc:
                    await verify_citations('Hills (2022) reports stress.', SOURCES, AsyncMock(return_value=raw))
                self.assertEqual(exc.exception.status_code, 502)
        asyncio.run(check())

    def test_unsupported_and_partial_results_are_kept_in_table_data(self):
        essay = ('Students justified their need for extensions (Zannella & Sutherland, 2025). '
                 'Kennette and Rivers (2024) found a strong link between flexibility and positive instructor views.')
        async def check():
            results = [
                {'id': 1, 'label': 'unsupported', 'issue': 'invented_detail',
                 'what_abstract_supports': 'Mental health and engagement were reported, not justification requirements.',
                 'suggested_fix': None, 'correct_source': None},
                {'id': 2, 'label': 'partial', 'issue': 'overstated_strength',
                 'what_abstract_supports': 'Students described hypothetical positive perceptions.',
                 'suggested_fix': 'Students reported they would view instructors more positively (Kennette & Rivers, 2024).',
                 'correct_source': None}]
            completion = AsyncMock(return_value=json.dumps({'results': results}))
            audited = await verify_citations(essay, SOURCES, completion)
            self.assertEqual(audited[0]['sentence'], sentence_spans(essay)[0]['sentence'])
            self.assertFalse(audit_summary(audited, essay, SOURCES)['pass'])
        asyncio.run(check())

    def test_endpoint_repairs_once_and_reaudits_without_hiding_initial_findings(self):
        async def fake_audit(essay, sources, complete):
            return [{**row, 'label': 'unsupported' if 'strong link' in row['sentence'] else 'supported',
                     'issue': 'overstated_strength' if 'strong link' in row['sentence'] else None,
                     'what_abstract_supports': 'Reported perceptions only.',
                     'suggested_fix': 'Students reported positive perceptions (Hills, 2022).',
                     'correct_source': None} for row in sentence_spans(essay)]
        with patch.dict('os.environ', {'ESSAY_API_KEY': 'test', 'ESSAY_MODEL': 'test-model'}), TestClient(app) as client:
            with patch('main.complete', new=AsyncMock(return_value='A strong link was found (Hills, 2022).')), patch('main.verify_citations', side_effect=fake_audit) as verifier:
                result = client.post('/v1/essays/generate', json={
                    'title': 'Test', 'refine': False, 'resolve_references': False,
                    'outline': [{'main_idea': s, 'source_ids': ['S1']} for s in ['Intro', 'Body', 'Conclusion']],
                    'sources': [SOURCES[0]]})
        self.assertEqual(result.status_code, 200)
        data = result.json()
        self.assertEqual(verifier.await_count, 2)
        self.assertEqual(data['citation_audit']['repair_count'], 3)
        self.assertIn('strong link', data['citation_audit']['initial_table'])
        self.assertNotIn('strong link', data['essay'])
        self.assertTrue(data['citation_audit']['summary']['pass'])


if __name__ == '__main__':
    unittest.main()
