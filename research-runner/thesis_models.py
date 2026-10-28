"""Explicit long-form thesis contract; paths and provider settings stay server-side."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

KINDS = ['abstract', 'introduction', 'literature_review', 'methodology', 'results', 'discussion', 'conclusion']
TITLES = ['Abstract', 'Introduction', 'Literature Review', 'Methodology', 'Implementation and Results', 'Discussion', 'Conclusion']


class Chapter(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    kind: Literal['abstract', 'introduction', 'literature_review', 'methodology', 'results', 'discussion', 'conclusion']
    title: str = Field(min_length=3, max_length=200)
    sections: list[str] = Field(min_length=1, max_length=12)
    min_sources: int = Field(default=3, ge=0, le=30)

    @model_validator(mode='after')
    def validate_sections(self):
        if any(not s.strip() or len(s) > 300 for s in self.sections):
            raise ValueError('Section headings must contain 1–300 characters')
        if self.kind != 'abstract' and self.min_sources < 1:
            raise ValueError('Each substantive chapter requires at least one source')
        return self


def default_chapters():
    return [Chapter(kind=k, title=t, sections=[t], min_sources=0 if k == 'abstract' else 3)
            for k, t in zip(KINDS, TITLES)]


class ThesisRequest(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    topic: str = Field(min_length=10, max_length=2000)
    degree_level: Literal['bachelor', 'master', 'phd'] = 'master'
    field: str = Field(min_length=2, max_length=200)
    institution: str = Field(min_length=2, max_length=300)
    university_guidelines: str = Field(default='', max_length=15000)
    author_name: str | None = Field(default=None, max_length=200)
    language: str = Field(default='en', pattern=r'^[a-z]{2}(?:-[A-Za-z]{2})?$')
    citation_style: Literal['apa', 'ieee'] = 'apa'
    target_pages: int = Field(default=50, ge=30, le=80)
    chapters: list[Chapter] = Field(default_factory=default_chapters, min_length=7, max_length=7)
    peer_reviewed_dois: list[str] = Field(min_length=1, max_length=150,
        description='Curated DOIs attested by the caller as peer reviewed; the pipeline must independently confirm their metadata.')
    research_material: str = Field(default='', max_length=50000,
        description='Actual methods, observations or results. Missing empirical results must be identified as proposed work, never invented.')

    @model_validator(mode='after')
    def validate_outline(self):
        if [c.kind for c in self.chapters] != KINDS:
            raise ValueError('Provide the seven chapter kinds in the documented order')
        import re
        self.peer_reviewed_dois = list(dict.fromkeys(d.lower().strip().removeprefix('https://doi.org/') for d in self.peer_reviewed_dois))
        if any(not re.fullmatch(r'10\.\d{4,9}/\S+', d) for d in self.peer_reviewed_dois):
            raise ValueError('Provide DOI identifiers, for example 10.1234/example')
        if len(self.peer_reviewed_dois) < max(c.min_sources for c in self.chapters):
            raise ValueError('The curated DOI list must meet the highest chapter source threshold')
        return self
