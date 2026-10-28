"""Dedicated controller for bounded literature-review requests."""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from .dependencies import get_literature_review_service
from .models import LiteratureReviewRequest, LiteratureReviewResponse
from .service import LiteratureReviewService

router = APIRouter(prefix='/v1/literature-reviews', tags=['Literature reviews'])


@router.post('/generate', response_model=LiteratureReviewResponse,
    summary='Generate an evidence-linked rapid narrative literature review',
    description='Search selected academic providers, deduplicate and screen abstracts, extract structured evidence, '
                'and synthesize themes with server-owned citations. Uses configured OpenAlex and LLM credentials. '
                'This is an abstract-based, bounded narrative workflow, not a certified systematic review.',
    responses={424: {'description': 'Too few relevant papers after screening/DOI checks.'},
               429: {'description': 'Shared generation concurrency limit reached.'},
               500: {'description': 'Unexpected pipeline failure; request ID is provided.'},
               502: {'description': 'Invalid upstream model output or evidence bindings.'},
               503: {'description': 'Provider unavailable, disabled, or LLM credentials missing.'},
               504: {'description': 'Provider or overall review deadline exceeded.'}},
    openapi_extra={'requestBody': {'content': {'application/json': {'examples': {'education': {
        'summary': 'Assessment design and generative AI', 'value': {
            'topic': 'Generative AI and assessment design in higher education',
            'search': {'providers': ['openalex', 'crossref'],
                       'queries': ['generative AI assessment higher education'],
                       'year_from': 2020, 'verify_dois': True},
            'domain_filters': ['higher education'], 'max_papers': 8, 'min_papers': 3,
            'target_words': 1500, 'verify_claims': True}}}}}}})
async def generate_literature_review(payload: LiteratureReviewRequest, request: Request, response: Response,
    service: Annotated[LiteratureReviewService, Depends(get_literature_review_service)]):
    # Share the established service-wide budget with essay and audit endpoints.
    slots = request.app.state.slots
    if slots.locked():
        raise HTTPException(429, 'Generation services are busy; retry later.', headers={'Retry-After': '2'})
    async with slots:
        try:
            result = await service.generate(payload)
        except HTTPException as exc:
            if isinstance(exc.detail, dict) and exc.detail.get('request_id'):
                exc.headers = {**(exc.headers or {}), 'X-Request-ID': exc.detail['request_id']}
            raise
    response.headers['X-Request-ID'] = result.request_id
    return result
