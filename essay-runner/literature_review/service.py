"""Stateless per-request orchestration with bounded work and structured stage logs."""
import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException
from citation_audit import render_audit_table
from .audit import verify_citations, audit_summary
from .models import LiteratureReviewResponse, MethodologyBreakdown, Exclusion, QualityChecks, ReviewFinding
from .retrieval import deduplicate, filter_metadata, rank_candidates
from .serialization import render_review, assign_citation_labels, evidence_counts
from .synthesis import balanced_selection, source_record
from .diagnostics import review_request_id

logger = logging.getLogger('humaniser.literature_review')


def configure_logging():
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter('%(message)s'))
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False


def stage(request_id, name, **values):
    logger.info(json.dumps({'event': 'literature_review_stage', 'request_id': request_id, 'stage': name, **values}))


class LiteratureReviewService:
    def __init__(self, retriever, synthesizer, complete, ensure_configured=None):
        self.retriever = retriever
        self.synthesizer = synthesizer
        self.complete = complete
        self.ensure_configured = ensure_configured

    async def generate(self, request):
        request_id = uuid4().hex
        started = time.monotonic()
        searched_at = datetime.now(timezone.utc)
        stage(request_id, 'start', max_papers=request.max_papers)
        request_token = review_request_id.set(request_id)
        try:
            if self.ensure_configured:
                self.ensure_configured()
            async with asyncio.timeout(300):
                response = await self._run(request, request_id, searched_at)
            stage(request_id, 'complete', included=len(response.papers), status=response.quality_checks.status,
                  elapsed_ms=round((time.monotonic() - started) * 1000))
            return response
        except TimeoutError as exc:
            stage(request_id, 'timeout')
            raise HTTPException(504, {'code': 'review_timeout', 'request_id': request_id, 'message': 'Literature review exceeded its 300-second deadline.'}) from exc
        except HTTPException as exc:
            stage(request_id, 'failed', http_status=exc.status_code)
            detail = dict(exc.detail) if isinstance(exc.detail, dict) else {'code': 'review_upstream_failure', 'message': exc.detail}
            detail['request_id'] = request_id
            raise HTTPException(exc.status_code, detail, headers=exc.headers) from exc
        except Exception as exc:
            # Exception strings and tracebacks can contain provider URLs or credentials.
            stage(request_id, 'failed', error_type=type(exc).__name__)
            raise HTTPException(500, {'code': 'review_failed', 'request_id': request_id,
                                    'message': 'Literature review failed unexpectedly.'}) from exc
        finally:
            review_request_id.reset(request_token)

    async def _run(self, request, request_id, searched_at):
        raw, search_runs = await self.retriever.search(request)
        stage(request_id, 'retrieval', records=len(raw), failed_searches=sum(run.status == 'failed' for run in search_runs))
        if not any(run.status == 'ok' for run in search_runs):
            raise HTTPException(503, {'code': 'providers_unavailable', 'request_id': request_id,
                'message': 'No selected search provider completed successfully.', 'search_runs': [run.model_dump() for run in search_runs]})
        unique = deduplicate(raw)
        for number, paper in enumerate(unique, 1):
            paper.paper_id = f'P{number}'
        candidates, exclusions = filter_metadata(unique, request)
        candidates = rank_candidates(candidates, request)
        ranking = [{'paper_id': paper.paper_id, 'score': paper.prescreen_score} for paper in candidates]
        # Cap LLM screening costs AFTER ranking the entire metadata-eligible pool.
        cap = min(60, max(12, request.max_papers * 3))
        for paper in candidates[cap:]:
            exclusions.append(Exclusion(paper_id=paper.paper_id, title=paper.title, stage='selection', reason='Candidate screening budget reached.'))
        unscreened = max(0, len(candidates) - cap)
        candidates = candidates[:cap]
        decisions = await self.synthesizer.screen(candidates, request) if candidates else []
        eligible = [decision for decision in decisions if decision.include and decision.score >= 3]
        accepted_ids = {decision.paper_id for decision in eligible}
        reasons = {decision.paper_id: decision.reason for decision in decisions}
        for paper in candidates:
            if paper.paper_id not in accepted_ids:
                exclusions.append(Exclusion(paper_id=paper.paper_id, title=paper.title, stage='relevance', reason=reasons[paper.paper_id]))
        selectable = [paper for paper in candidates if paper.paper_id in accepted_ids]
        if request.search.verify_dois:
            selectable = await self.retriever.verify_dois(selectable)
            valid = []
            for paper in selectable:
                if paper.doi_status == 'metadata_mismatch':
                    exclusions.append(Exclusion(paper_id=paper.paper_id, title=paper.title, stage='doi', reason='Crossref DOI title mismatched retrieved metadata.'))
                else:
                    valid.append(paper)
            selectable = valid
        selectable_ids = {paper.paper_id for paper in selectable}
        selected = balanced_selection(selectable, [decision for decision in decisions if decision.paper_id in selectable_ids], request.max_papers)
        selected_ids = {paper.paper_id for paper in selected}
        for paper in selectable:
            if paper.paper_id not in selected_ids:
                exclusions.append(Exclusion(paper_id=paper.paper_id, title=paper.title, stage='selection', reason='Not selected within balanced paper limit.'))
        stage(request_id, 'screening', unique=len(unique), screened=len(candidates), eligible=len(eligible), included=len(selected))
        if len(selected) < request.min_papers:
            raise HTTPException(424, {'code': 'insufficient_evidence', 'request_id': request_id,
                'message': f'Found {len(selected)} usable relevant papers; minimum is {request.min_papers}. Adjust queries or filters.',
                'search_runs': [run.model_dump() for run in search_runs],
                'exclusions': [exclusion.model_dump() for exclusion in exclusions],
                'screening': [decision.model_dump() for decision in decisions]})
        assign_citation_labels(selected)
        extraction_results = await asyncio.gather(*(self.synthesizer.extract(paper) for paper in selected), return_exceptions=True)
        evidence, extraction_failures = [], []
        for paper, result in zip(selected, extraction_results):
            if isinstance(result, HTTPException) and result.status_code in {502, 504}:
                detail = result.detail if isinstance(result.detail, dict) else {}
                failure = {'paper_id': paper.paper_id, 'code': detail.get('code', 'extraction_upstream_failure'),
                           'validation_errors': detail.get('validation_errors', [])}
                extraction_failures.append(failure)
                exclusions.append(Exclusion(paper_id=paper.paper_id, title=paper.title, stage='extraction',
                    reason='Evidence extraction failed validation or timed out; paper was not used for synthesis.'))
            elif isinstance(result, BaseException):
                raise result
            else:
                evidence.append(result)
        selected = [paper.metadata for paper in evidence]
        stage(request_id, 'extraction', papers=len(evidence), excluded=len(extraction_failures))
        if len(evidence) < request.min_papers:
            raise HTTPException(502, {'code': 'review_extraction_failed', 'stage': 'extraction',
                'message': 'Too few papers have valid extracted evidence after bounded retries; no unbound review was returned.',
                'minimum_required': request.min_papers, 'usable_papers': len(evidence),
                'failures': extraction_failures, 'exclusions': [exclusion.model_dump() for exclusion in exclusions]})
        synthesis = await self.synthesizer.synthesize(evidence, request)
        limitations = ['Rapid, bounded narrative search; not a comprehensive or PRISMA-compliant systematic review.',
            'Only indexed abstracts were read. Missing abstract details do not establish omissions in the full research.',
            'Model relevance screening and evidence extraction require human review; formal risk-of-bias appraisal was not performed.']
        methodology = MethodologyBreakdown(searched_at=searched_at, search_runs=search_runs,
            year_from=request.search.year_from, year_to=request.search.year_to, domain_filters=request.domain_filters,
            records_retrieved=len(raw), unique_records=len(unique), duplicates_removed=len(raw) - len(unique),
            screened=len(candidates), eligible=len(eligible), included=len(evidence), cited=0,
            exclusions=exclusions, screening=decisions,
            selection_method='Local TF-IDF similarity and question-concept coverage rank all candidates before the screening budget; relevance threshold >=3/4, then round-robin selection across model-assigned subtopics.',
            candidate_ranking=ranking, unscreened=unscreened, evidence_counts=evidence_counts(evidence),
            extraction_method='Structured abstract extraction with server-owned passage IDs and validated source bindings.',
            quality_assessment='No journal quality metrics or formal risk-of-bias scores were inferred. DOI status refers to Crossref metadata only.',
            limitations=limitations)
        summary, review_text, narrative, citations, used = render_review(synthesis, selected, methodology, evidence, request.question)
        methodology.cited = len(citations)
        uncited = [paper.paper_id for paper in selected if paper.paper_id not in used]
        findings = [ReviewFinding(paper_id=paper.metadata.paper_id, **finding.model_dump())
                    for paper in evidence for finding in paper.extraction.key_findings]
        audit = None
        status = 'not_checked'
        if request.verify_claims:
            sources = [{**source_record(item.metadata), 'passages': [p.model_dump() for p in item.passages]} for item in evidence]
            audit_results = await verify_citations(narrative, sources, self.complete)
            audit_stats = audit_summary(audit_results, narrative, sources)
            repair_attempted = False
            if not audit_stats['pass'] and hasattr(self.synthesizer, 'repair'):
                repair_attempted = True
                stage(request_id, 'claim_repair', flagged=sum(row['label'] != 'supported' for row in audit_results))
                synthesis = await self.synthesizer.repair(evidence, request, synthesis, audit_results)
                summary, review_text, narrative, citations, used = render_review(synthesis, selected, methodology, evidence, request.question)
                methodology.cited = len(citations)
                uncited = [paper.paper_id for paper in selected if paper.paper_id not in used]
                audit_results = await verify_citations(narrative, sources, self.complete)
                audit_stats = audit_summary(audit_results, narrative, sources)
            audit = {'summary': audit_stats, 'results': audit_results, 'table': render_audit_table(audit_results),
                     'repair_attempted': repair_attempted, 'audited_text': 'final_synthesized_narrative'}
            status = 'passed' if audit_stats['pass'] and not uncited and not extraction_failures else 'needs_review'
        warnings = []
        warnings.extend(synthesis.validation_warnings)
        if synthesis.validation_warnings:
            status = 'needs_review'
        if extraction_failures:
            warnings.append(f'{len(extraction_failures)} selected paper(s) failed evidence extraction and were excluded; search coverage and synthesis need review.')
            status = 'needs_review'
        if unscreened:
            warnings.append(f'{unscreened} metadata-eligible records were not screened after relevance ranking because the screening budget was reached.')
        if request.verify_claims and (unscreened or any(run.status != 'ok' for run in search_runs)):
            status = 'needs_review'
        if any(run.status != 'ok' for run in search_runs):
            warnings.append('Some selected provider searches failed or were disabled; search coverage is incomplete.')
        if any(paper.doi_status not in {'confirmed', 'not_checked'} for paper in selected):
            warnings.append('Some DOI metadata could not be confirmed in Crossref; non-indexing does not prove a DOI is invalid.')
        if uncited:
            warnings.append('Some selected papers were not represented in synthesis citations; inspect quality_checks.uncited_paper_ids.')
        word_count = len(narrative.split())
        if abs(word_count - request.target_words) > request.target_words * .15:
            warnings.append(f'Review narrative differs from requested length by more than 15% ({word_count}/{request.target_words}).')
        stage(request_id, 'verification', status=status, cited=len(citations), synthesis_omissions=len(synthesis.validation_warnings))
        return LiteratureReviewResponse(request_id=request_id, topic=request.question, query=request.query or request.topic,
            generated_at=datetime.now(timezone.utc), summary=summary, key_findings=findings, papers=evidence,
            citations=citations, synthesis=synthesis, synthesized_review_text=review_text, word_count=word_count,
            methodology=methodology, quality_checks=QualityChecks(status=status, evidence_bindings_valid=True,
                uncited_paper_ids=uncited, claim_audit=audit, limitations=['Binding checks establish source identity, not semantic entailment.',
                'Verbatim quotation validation proves quotation existence, not semantic entailment. Claim auditing is model-based; passed is not independent verification or a publication readiness certification.']), warnings=warnings)
