"""FastAPI dependency boundary; replace this dependency in route-level tests."""
from fastapi import HTTPException, Request
from .service import LiteratureReviewService


def get_literature_review_service(request: Request) -> LiteratureReviewService:
    service = getattr(request.app.state, 'literature_review_service', None)
    if service is None:
        raise HTTPException(503, 'Literature review service is not initialized.')
    return service
