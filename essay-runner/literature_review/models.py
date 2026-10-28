"""Public API contracts and validated intermediate pipeline records."""
from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from author_names import clean_authors

Provider = Literal['openalex', 'crossref']


class DTO(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class SearchParameters(DTO):
    providers: list[Provider] = Field(default_factory=lambda: ['openalex', 'crossref'], min_length=1, max_length=2)
    queries: list[str] = Field(default_factory=list, max_length=3, description='Optional explicit search queries; otherwise query/topic is used.')
    year_from: int | None = Field(default=None, ge=1800)
    year_to: int | None = Field(default=None, ge=1800)
    verify_dois: bool = True

    @field_validator('queries')
    @classmethod
    def queries_valid(cls, values):
        if any(not value.strip() or len(value) > 500 for value in values):
            raise ValueError('Search queries must contain 1–500 characters.')
        return list(dict.fromkeys(value.strip() for value in values))

    @model_validator(mode='after')
    def bounds(self):
        self.providers = list(dict.fromkeys(self.providers))
        if self.year_from and self.year_to and self.year_from > self.year_to:
            raise ValueError('year_from must not exceed year_to.')
        if any(year and year > datetime.now(timezone.utc).year + 1 for year in [self.year_from, self.year_to]):
            raise ValueError('Publication years must not exceed next year.')
        return self


class LiteratureReviewRequest(DTO):
    query: str | None = Field(default=None, min_length=3, max_length=1000)
    topic: str | None = Field(default=None, min_length=3, max_length=1000)
    search: SearchParameters = Field(default_factory=SearchParameters)
    domain_filters: list[str] = Field(default_factory=list, max_length=5,
        description='Research subject constraints, e.g. higher education; enforced during abstract screening, not website hostnames.')
    max_papers: int = Field(default=8, ge=1, le=20)
    min_papers: int = Field(default=3, ge=1, le=20)
    target_words: int = Field(default=1500, ge=500, le=4000)
    verify_claims: bool = True

    @field_validator('domain_filters')
    @classmethod
    def domains_valid(cls, values):
        if any(not value.strip() or len(value) > 120 for value in values):
            raise ValueError('Domain filters must contain 1–120 characters.')
        return list(dict.fromkeys(value.strip() for value in values))

    @model_validator(mode='after')
    def request_valid(self):
        if not self.query and not self.topic:
            raise ValueError('Provide query or topic.')
        if self.min_papers > self.max_papers:
            raise ValueError('min_papers must not exceed max_papers.')
        return self

    @property
    def question(self):
        return self.topic or self.query


class Paper(DTO):
    paper_id: str = ''
    title: str = Field(min_length=1, max_length=2000)
    authors: list[str] = Field(default_factory=list)
    year: int | None = None
    doi: str | None = None
    url: str | None = None
    openalex_id: str | None = None
    journal: str | None = None
    publication_type: str | None = None
    abstract: str = Field(default='', max_length=20000)
    providers: list[Provider] = Field(default_factory=list)
    matched_queries: list[str] = Field(default_factory=list)
    doi_status: Literal['not_checked', 'confirmed', 'not_indexed_in_crossref', 'metadata_mismatch', 'unavailable', 'missing'] = 'not_checked'
    relevance_score: int | None = Field(default=None, ge=0, le=4)
    relevance_reason: str | None = None
    subtopic: str | None = None
    prescreen_score: float | None = None
    related_dois: list[str] = Field(default_factory=list)
    alternate_versions: list[dict] = Field(default_factory=list)
    citation_label: str | None = None
    citation_year: str | None = None

    @field_validator('authors')
    @classmethod
    def authors_valid(cls, values):
        return clean_authors(values)


class SearchRun(DTO):
    provider: Provider
    query: str
    status: Literal['ok', 'failed', 'disabled']
    returned: int = 0
    reason: str | None = None


class ScreeningDecision(DTO):
    paper_id: str
    include: bool
    score: int = Field(ge=0, le=4)
    subtopic: str = Field(min_length=1, max_length=150)
    reason: str = Field(min_length=1, max_length=1200)


class ScreeningBatch(DTO):
    decisions: list[ScreeningDecision]


class Exclusion(DTO):
    paper_id: str
    title: str
    stage: Literal['metadata', 'doi', 'relevance', 'selection', 'extraction']
    reason: str


class SupportedFinding(DTO):
    text: str = Field(min_length=1, max_length=2000)
    passage_ids: list[str] = Field(min_length=1, max_length=6)


class ReviewFinding(SupportedFinding):
    paper_id: str


class EvidenceExtraction(DTO):
    study_design: str | None
    population: str | None
    sample_size: str | None
    methodology: str | None
    method_passage_ids: list[str] = Field(max_length=10)
    key_findings: list[SupportedFinding] = Field(max_length=6)
    reported_limitations: list[SupportedFinding] = Field(max_length=6)
    unreported_in_abstract: list[str] = Field(max_length=8)
    setting: str | None = None
    evidence_type: Literal['direct_empirical', 'self_report', 'conceptual', 'review', 'unknown'] = 'unknown'
    classification_passage_ids: list[str] = Field(default_factory=list, max_length=10)
    author_stated_gaps: list[SupportedFinding] = Field(default_factory=list, max_length=6)
    independent_competence_test: Literal['yes', 'no', 'unknown'] = 'unknown'


class EvidencePassage(DTO):
    passage_id: str
    text: str


class PaperEvidence(DTO):
    metadata: Paper
    extraction: EvidenceExtraction
    passages: list[EvidencePassage]


class SupportedText(DTO):
    text: str = Field(min_length=1, max_length=14000)
    source_ids: list[str] = Field(min_length=1, max_length=20)
    passage_ids: list[str] = Field(min_length=1, max_length=40)


class ReviewSection(DTO):
    heading: str = Field(min_length=1, max_length=150)
    paragraphs: list[SupportedText] = Field(min_length=1, max_length=6)


class Synthesis(DTO):
    summary: SupportedText
    sections: list[ReviewSection] = Field(min_length=2, max_length=8)
    methodology_comparison: SupportedText
    evidence_gaps: list[SupportedText] = Field(max_length=8)
    contradictions: list[SupportedText] = Field(max_length=8)
    validation_warnings: list[str] = Field(default_factory=list, description='Server-generated notes about omitted optional claims.')
    evidence_base: SupportedText | None = None
    conclusion: SupportedText | None = None


# Internal model contract: citations are inferred from validated passage ownership.
# Public Synthesis remains unchanged and still contains source_ids in every block.
class DraftText(DTO):
    text: str = Field(min_length=1, max_length=14000)
    passage_ids: list[str] = Field(min_length=1, max_length=40)


class DraftSection(DTO):
    heading: str = Field(min_length=1, max_length=150)
    paragraphs: list[DraftText] = Field(min_length=1, max_length=6)


class DraftSynthesis(DTO):
    summary: DraftText
    sections: list[DraftSection] = Field(min_length=2, max_length=8)
    methodology_comparison: DraftText
    evidence_gaps: list[DraftText] = Field(max_length=8)
    contradictions: list[DraftText] = Field(max_length=8)
    evidence_base: DraftText | None = None
    conclusion: DraftText | None = None


class Citation(DTO):
    paper_id: str
    formatted: str
    title: str
    authors: list[str]
    year: int | None
    doi: str | None
    url: str | None


class MethodologyBreakdown(DTO):
    review_type: Literal['rapid_narrative'] = 'rapid_narrative'
    searched_at: datetime
    search_runs: list[SearchRun]
    year_from: int | None
    year_to: int | None
    domain_filters: list[str]
    records_retrieved: int
    unique_records: int
    duplicates_removed: int
    screened: int
    eligible: int
    included: int
    cited: int
    exclusions: list[Exclusion]
    screening: list[ScreeningDecision]
    selection_method: str
    extraction_method: str
    quality_assessment: str
    limitations: list[str]
    candidate_ranking: list[dict] = Field(default_factory=list)
    unscreened: int = 0
    evidence_counts: dict[str, int] = Field(default_factory=dict)


class QualityChecks(DTO):
    status: Literal['needs_review', 'passed', 'not_checked']
    evidence_bindings_valid: bool
    uncited_paper_ids: list[str]
    claim_audit: dict | None
    limitations: list[str]


class LiteratureReviewResponse(DTO):
    request_id: str
    topic: str
    query: str
    generated_at: datetime
    summary: str
    key_findings: list[ReviewFinding]
    papers: list[PaperEvidence]
    citations: list[Citation]
    synthesis: Synthesis
    synthesized_review_text: str
    word_count: int
    methodology: MethodologyBreakdown
    quality_checks: QualityChecks
    warnings: list[str]
