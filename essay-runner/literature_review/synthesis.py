"""Schema validation, evidence extraction and thematic synthesis using an injected LLM."""
import asyncio
import json
import logging
import math
from collections import defaultdict

from fastapi import HTTPException
from argument_planning import evidence_catalogue, normalize_prose
from . import prompts
from .models import ScreeningBatch, EvidenceExtraction, Synthesis, DraftSynthesis, PaperEvidence, EvidencePassage
from .diagnostics import EvidenceValidationError, constrained_schema, validation_issues, repair_message, review_request_id

logger = logging.getLogger('humaniser.literature_review')


def source_record(paper):
    return {'source_id': paper.paper_id, 'title': paper.title, 'authors': paper.authors,
            'year': str(paper.year) if paper.year else None, 'details': paper.abstract,
            'publication_type': paper.publication_type, 'venue': paper.journal, 'doi': paper.doi,
            'citation_label': paper.citation_label, 'citation_year': paper.citation_year}


def balanced_selection(papers, decisions, maximum):
    by_id = {paper.paper_id: paper for paper in papers}
    groups = defaultdict(list)
    for decision in decisions:
        if decision.include and decision.score >= 3:
            paper = by_id[decision.paper_id].model_copy(update={'relevance_score': decision.score,
                'relevance_reason': decision.reason, 'subtopic': decision.subtopic})
            groups[decision.subtopic.casefold()].append(paper)
    for group in groups.values():
        group.sort(key=lambda paper: (paper.relevance_score, paper.year or 0), reverse=True)
    ordered = sorted(groups.values(), key=lambda group: group[0].relevance_score, reverse=True)
    selected = []
    while len(selected) < maximum and any(ordered):
        for group in ordered:
            if group and len(selected) < maximum:
                selected.append(group.pop(0))
    return selected


def synthesis_blocks(synthesis):
    return [block for block in [synthesis.summary, synthesis.evidence_base, synthesis.conclusion] if block is not None] + [paragraph for section in synthesis.sections for paragraph in section.paragraphs] + [synthesis.methodology_comparison] + synthesis.evidence_gaps + synthesis.contradictions


class ReviewSynthesizer:
    def __init__(self, complete):
        self.complete = complete
        self.slots = asyncio.Semaphore(3)

    async def structured(self, prompt, model, payload, *, tokens=5000, validate=None, stage='model'):
        message = prompt + '\nJSON schema:\n' + json.dumps(constrained_schema(model, payload)) + '\nDATA:\n' + json.dumps(payload, ensure_ascii=False)
        async with self.slots:
            for attempt in range(2):
                raw = await self.complete(message, tokens=tokens, structured=True, purpose='literature')
                try:
                    value = model.model_validate_json(raw)
                    if validate:
                        validate(value)
                    return value
                except ValueError as exc:
                    issues = validation_issues(exc)
                    logger.warning(json.dumps({'event': 'literature_review_model_validation', 'request_id': review_request_id.get(),
                        'stage': stage, 'model_schema': model.__name__, 'attempt': attempt + 1,
                        'paper_id': payload.get('paper', {}).get('paper_id'), 'validation_errors': issues}))
                    if attempt:
                        raise HTTPException(502, {'code': 'review_model_validation_failed',
                            'message': 'Literature review model returned invalid or unbound evidence after validation retry.',
                            'stage': stage, 'model_schema': model.__name__,
                            'paper_id': payload.get('paper', {}).get('paper_id'), 'validation_errors': issues}) from exc
                    message += repair_message(raw, issues)

    async def screen(self, papers, request):
        async def batch_screen(batch):
            expected = {paper.paper_id for paper in batch}
            def validate(value):
                ids = [row.paper_id for row in value.decisions]
                if set(ids) != expected or len(ids) != len(expected):
                    raise EvidenceValidationError([{'code': 'screening_id_mismatch', 'path': ['decisions'], 'expected_paper_ids': sorted(expected)}])
            value = await self.structured(prompts.SCREEN, ScreeningBatch,
                {'question': request.question, 'domain_filters': request.domain_filters,
                 'papers': [paper.model_dump() for paper in batch]}, validate=validate, stage='screening')
            return value.decisions
        batches = await asyncio.gather(*(batch_screen(papers[index:index + 12]) for index in range(0, len(papers), 12)))
        return [decision for batch in batches for decision in batch]

    async def extract(self, paper):
        catalogue = evidence_catalogue([source_record(paper)])
        allowed = {row['passage_id']: row['text'] for row in catalogue}
        def validate(value):
            ids = value.method_passage_ids + value.classification_passage_ids + [pid for finding in value.key_findings + value.reported_limitations + value.author_stated_gaps for pid in finding.passage_ids]
            if any(pid not in allowed for pid in ids):
                raise EvidenceValidationError([{'code': 'unknown_or_cross_paper_passage', 'path': ['passage_ids'],
                    'paper_id': paper.paper_id, 'allowed_passage_ids': sorted(allowed)}])
            if any([value.study_design, value.population, value.sample_size, value.methodology, value.setting]) and not value.method_passage_ids:
                raise EvidenceValidationError([{'code': 'missing_method_evidence', 'path': ['method_passage_ids'],
                    'paper_id': paper.paper_id, 'allowed_passage_ids': sorted(allowed)}])
            if value.evidence_type != 'unknown' and not value.classification_passage_ids:
                raise EvidenceValidationError([{'code': 'missing_classification_evidence', 'path': ['classification_passage_ids']}])
            if value.independent_competence_test != 'unknown' and not value.method_passage_ids:
                raise EvidenceValidationError([{'code': 'missing_competence_evidence', 'path': ['method_passage_ids']}])
        extraction = await self.structured(prompts.EXTRACT, EvidenceExtraction,
            {'paper': paper.model_dump(), 'passages': catalogue}, tokens=3200, validate=validate, stage='extraction')
        return PaperEvidence(metadata=paper, extraction=extraction,
            passages=[EvidencePassage(passage_id=pid, text=text) for pid, text in allowed.items()])

    async def synthesize(self, papers, request, audit_feedback=None):
        passage_sources = {passage.passage_id: paper.metadata.paper_id for paper in papers for passage in paper.passages}
        omitted_contradictions = []
        def validate(value):
            if not value.evidence_base or not value.conclusion:
                raise EvidenceValidationError([{'code': 'missing_evidence_base_or_conclusion', 'path': ['synthesis']}])
            for index, block in enumerate(synthesis_blocks(value)):
                if any(pid not in passage_sources for pid in block.passage_ids):
                    raise EvidenceValidationError([{'code': 'unknown_passage', 'path': ['blocks', index, 'passage_ids'],
                        'allowed_passage_ids': sorted(passage_sources)}])
            # A one-source tension is not a cross-study contradiction. It is
            # optional content: omit it explicitly rather than invent a second
            # citation or discard otherwise valid, bound review paragraphs.
            invalid = [block for block in value.contradictions if len({passage_sources[pid] for pid in block.passage_ids}) < 2]
            omitted_contradictions[:] = invalid
            value.contradictions = [block for block in value.contradictions if block not in invalid]
        section_count = 4 if request.target_words >= 1200 else 3 if request.target_words >= 800 else 2
        summary_words = round(request.target_words * .08)
        comparison_words = round(request.target_words * .10)
        evidence_words = round(request.target_words * .12)
        conclusion_words = round(request.target_words * .08)
        paragraph_words = max(60, math.ceil((request.target_words - summary_words - comparison_words - evidence_words - conclusion_words) / section_count / 2))
        length_instructions = (f'\nWord allocation: summary about {summary_words} words; '
            f'evidence base about {evidence_words} words; conclusion about {conclusion_words} words; '
            f'{section_count} thematic sections, each with 2 developed paragraphs of about {paragraph_words} words; '
            f'methodology comparison about {comparison_words} words. Source/passage IDs do not count as prose words. '
            'Use this space for supported comparison and analysis, not padding or repeated claims. '
            'Contradictions are optional and require passages from at least two DISTINCT supplied papers, '
            'not two passages from one paper; otherwise leave contradictions empty.')
        from .serialization import evidence_counts
        payload_evidence = [paper.model_dump(exclude={'extraction': {'unreported_in_abstract'}}) for paper in papers]
        draft = await self.structured(prompts.SYNTHESIZE + length_instructions, DraftSynthesis,
            {'question': request.question, 'domain_filters': request.domain_filters,
             'target_words': request.target_words, 'evidence': payload_evidence,
             'evidence_counts': evidence_counts(papers), 'audit_feedback': audit_feedback},
            tokens=min(14000, request.target_words * 5 + 2000), validate=validate, stage='synthesis')
        data = draft.model_dump()
        blocks = [data[key] for key in ['summary', 'evidence_base', 'conclusion'] if data.get(key)] + [paragraph for section in data['sections'] for paragraph in section['paragraphs']] + [data['methodology_comparison']] + data['evidence_gaps'] + data['contradictions']
        for block in blocks:
            block['source_ids'] = list(dict.fromkeys(passage_sources[pid] for pid in block['passage_ids']))
        result = Synthesis.model_validate(data)
        if omitted_contradictions:
            result.validation_warnings.append(f'Omitted {len(omitted_contradictions)} proposed cross-study contradiction(s) because their passages came from only one source.')
        for block in synthesis_blocks(result):
            block.text = normalize_prose(block.text)
        return result

    async def repair(self, papers, request, synthesis, audit_results):
        # Rewrite against original evidence, never trust an auditor's suggested fact.
        feedback = {'previous_synthesis': synthesis.model_dump(), 'issues': [
            {key: row.get(key) for key in ['id', 'sentence', 'paper_id', 'label', 'flags', 'suggested_fix']}
            for row in audit_results if row['label'] != 'supported']}
        return await self.synthesize(papers, request, audit_feedback=feedback)
