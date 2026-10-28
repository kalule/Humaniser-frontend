import asyncio
import copy
import json
import unittest
from unittest.mock import AsyncMock

from fastapi import HTTPException
from argument_planning import ArgumentPlan, ArgumentBrief, validate_bindings, normalize_prose, repair_reviewed_sections, structured_call, review_argument, evidence_catalogue, hydrate_bindings
from citation_guard import accept_refinement
from main import Section


SOURCES = [{'source_id': 'S1', 'title': 'Survey', 'authors': ['Ngari, A.'], 'year': '2026',
            'details': 'Students reported improved performance. This does not establish measured learning gains.'}]
OUTLINE = [Section(main_idea=name) for name in ['Introduction', 'Evidence', 'Conclusion']]
PLAN = {'thesis': 'Permit compatible assistance with independent checks.',
    'decision_principle': 'AI must not replace the assessed skill.',
    'alternatives_comparison': ['Bans can protect independent work but may be difficult to enforce.', 'Unrestricted use obscures competence.'],
    'permitted_uses': ['Grammar assistance where language proficiency is not assessed.'],
    'prohibited_uses': ['AI performing the language skill under examination.'],
    'independent_competence_checks': ['A short oral explanation.'],
    'decision_applications': [],
    'paragraphs': [{'section': 2, 'paragraph_purpose': 'Distinguish perceptions from learning gains.',
        'claim': 'Reported performance does not demonstrate learning.', 'claim_kind': 'interpretation',
        'supporting_source_ids': ['S1'], 'supporting_passages': [{'source_id': 'S1', 'text': 'Students reported improved performance.'}],
        'evidence_limits': 'Self-report, not demonstrated learning.',
        'explanation_linking_evidence_to_claim': 'The measure cannot establish independent competence.',
        'strongest_objection': 'Disclosure alone may not reveal competence.',
        'response_or_qualification': 'Require an independent demonstration of the assessed skill.',
        'connection_to_thesis': 'Permission depends on what the assessment measures.'}],
    'conclusion_source_bindings': [{'source_id': 'S1', 'text': 'Students reported improved performance.',
                                  'claim': 'Reported benefits do not establish independent competence.'}],
    'unresolved_evidence_needs': []}


class ArgumentTests(unittest.TestCase):
    def test_passage_ids_insert_server_evidence_and_reject_wrong_source(self):
        plan = ArgumentPlan.model_validate(PLAN)
        catalogue = evidence_catalogue(SOURCES)
        for binding in [plan.paragraphs[0].supporting_passages[0], plan.conclusion_source_bindings[0]]:
            binding.passage_id = catalogue[0]['passage_id']
            binding.text = 'Model-generated paraphrase is not trusted.'
        hydrate_bindings(plan, catalogue)
        self.assertEqual(plan.paragraphs[0].supporting_passages[0].text, catalogue[0]['text'])
        validate_bindings(plan, SOURCES, OUTLINE)
        plan.paragraphs[0].supporting_passages[0].source_id = 'S2'
        with self.assertRaises(ValueError):
            hydrate_bindings(plan, catalogue)

    def test_valid_plan_keeps_reviewable_decisions_and_exact_evidence(self):
        validate_bindings(ArgumentPlan.model_validate(PLAN), SOURCES, OUTLINE)

    def test_hallucinated_passages_and_conclusion_reattribution_are_rejected(self):
        wrong = copy.deepcopy(PLAN)
        wrong['paragraphs'][0]['supporting_passages'][0]['text'] = 'Objective performance increased significantly.'
        with self.assertRaises(ValueError):
            validate_bindings(ArgumentPlan.model_validate(wrong), SOURCES, OUTLINE)
        wrong = copy.deepcopy(PLAN)
        wrong['conclusion_source_bindings'][0]['text'] = 'This does not establish measured learning gains.'
        with self.assertRaises(ValueError):
            validate_bindings(ArgumentPlan.model_validate(wrong), SOURCES, OUTLINE)

    def test_conclusion_binding_not_used_in_body_is_dropped_not_fatal(self):
        plan = copy.deepcopy(PLAN)
        plan['conclusion_source_bindings'].append({'source_id': 'S1', 'text': 'This does not establish measured learning gains.',
                                                   'claim': 'Gains are unproven.'})
        parsed = ArgumentPlan.model_validate(plan)
        validate_bindings(parsed, SOURCES, OUTLINE)
        self.assertEqual([b.text for b in parsed.conclusion_source_bindings], ['Students reported improved performance.'])

    def test_all_conclusion_bindings_unsupported_by_body_still_rejected(self):
        plan = copy.deepcopy(PLAN)
        plan['conclusion_source_bindings'][0]['text'] = 'This does not establish measured learning gains.'
        with self.assertRaises(ValueError):
            validate_bindings(ArgumentPlan.model_validate(plan), SOURCES, OUTLINE)

    def test_empirical_claim_without_passage_cannot_pass(self):
        wrong = copy.deepcopy(PLAN)
        wrong['paragraphs'][0].update(claim_kind='empirical', supporting_source_ids=[], supporting_passages=[])
        with self.assertRaises(ValueError):
            validate_bindings(ArgumentPlan.model_validate(wrong), SOURCES, OUTLINE)

    def test_every_body_section_must_have_a_distinct_record(self):
        with self.assertRaises(ValueError):
            validate_bindings(ArgumentPlan.model_validate(PLAN), SOURCES,
                [Section(main_idea=name) for name in ['Intro', 'Evidence', 'Objection', 'Conclusion']])

    def test_escape_cleanup_does_not_decode_arbitrary_unicode(self):
        self.assertEqual(normalize_prose('First.\\n\\nSecond.'), 'First.\n\nSecond.')
        self.assertEqual(normalize_prose(r'Keep \u1234 unchanged.'), r'Keep \u1234 unchanged.')

    def test_argument_repair_cannot_drop_assigned_source(self):
        outline = [Section(main_idea='Body', source_ids=['S1'])]
        review = {'issues': [{'passage': 'Ngari (2026) proves gains.', 'replacement': 'Learning gains are uncertain.',
                              'category': 'causal_overreach'}]}
        sections, count, skipped = repair_reviewed_sections(['Ngari (2026) proves gains.'], review, outline, SOURCES, accept_refinement)
        self.assertEqual(count, 0)
        self.assertTrue(skipped)
        self.assertEqual(sections, ['Ngari (2026) proves gains.'])

    def test_structured_planner_retries_invalid_schema(self):
        brief = {'question_interpretation': 'Judge permission.', 'provisional_position': 'Conditional permission.',
                 'decision_principle': 'Preserve assessed competence.', 'alternatives': ['Ban', 'Permit by task'],
                 'strongest_objection': 'Independent competence becomes unclear.',
                 'evidence_needed': ['Student assessment outcomes'], 'search_queries': ['AI assessment', 'assessment integrity']}
        complete = AsyncMock(side_effect=['not json', json.dumps(brief)])
        result = asyncio.run(structured_call('Plan', ArgumentBrief, complete, 2000))
        self.assertEqual(complete.await_count, 2)
        self.assertEqual(result.decision_principle, 'Preserve assessed competence.')

    def test_review_rejects_invented_essay_passage(self):
        raw = {'issues': [{'category': 'causal_overreach', 'severity': 'major', 'passage': 'Invented quotation.',
                'explanation': 'Unjustified cause.', 'suggested_fix': 'Qualify it.', 'replacement': None}], 'judgment': 'Review needed.'}
        with self.assertRaises(HTTPException):
            asyncio.run(review_argument('An actual sentence.', PLAN, SOURCES, AsyncMock(return_value=json.dumps(raw))))

    def test_review_drops_only_the_misquoted_issue(self):
        issue = lambda passage: {'category': 'causal_overreach', 'severity': 'major', 'passage': passage,
            'explanation': 'Unjustified cause.', 'suggested_fix': 'Qualify it.', 'replacement': None}
        raw = {'issues': [issue('Invented quotation.'), issue("It’s a “clear” gain")], 'judgment': 'Review needed.'}
        essay = "Intro. It's a \"clear\" gain, the authors say."
        result = asyncio.run(review_argument(essay, PLAN, SOURCES, AsyncMock(return_value=json.dumps(raw))))
        self.assertEqual([i['passage'] for i in result['issues']], ["It’s a “clear” gain"])
        self.assertEqual(result['status'], 'needs_review')


if __name__ == '__main__':
    unittest.main()
