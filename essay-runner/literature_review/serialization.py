"""Server-owned citation labels, evidence summaries and actual search methods."""
import re
from collections import Counter, defaultdict
from urllib.parse import urlsplit
from author_names import apa_reference, surname
from .models import Citation
from .synthesis import synthesis_blocks
from .retrieval import is_preprint


def author_label(paper):
    author = surname(paper.authors[0]) if paper.authors else paper.title
    if len(paper.authors) == 2:
        author += ' & ' + surname(paper.authors[1])
    elif len(paper.authors) > 2:
        author += ' et al.'
    return author


def assign_citation_labels(papers):
    groups = defaultdict(list)
    for paper in papers:
        groups[(author_label(paper).casefold(), paper.year)].append(paper)
    for group in groups.values():
        ordered = sorted(group, key=lambda p: (p.title.casefold(), p.doi or '', p.paper_id))
        for index, paper in enumerate(ordered):
            suffix = chr(97 + index) if len(group) > 1 else ''
            paper.citation_year = str(paper.year or 'n.d.') + suffix
            paper.citation_label = f'{author_label(paper)}, {paper.citation_year}'


def paper_url(paper):
    if paper.doi:
        return 'https://doi.org/' + paper.doi
    url = (paper.url or '').strip().rstrip('>.,;')
    parsed = urlsplit(url)
    if parsed.scheme not in {'http', 'https'} or not parsed.netloc:
        return None
    if re.search(r'/(?:authors?|profiles?)(?:/|$)', parsed.path, re.I):
        return None
    return url or None


def publication_label(paper):
    if is_preprint(paper):
        return 'preprint'
    if (paper.publication_type or '').casefold() in {'dissertation', 'thesis'}:
        return 'dissertation'
    return paper.publication_type or 'unknown'


def citation_for(paper):
    url = paper_url(paper)
    kind = publication_label(paper)
    title = paper.title + (f' [{kind.capitalize()}]' if kind in {'preprint', 'dissertation'} else '')
    return Citation(paper_id=paper.paper_id, formatted=apa_reference({
        'title': title, 'authors': paper.authors, 'year': paper.citation_year or paper.year, 'doi': paper.doi,
        'url': url, 'venue': paper.journal}), title=paper.title, authors=paper.authors,
        year=paper.year, doi=paper.doi, url=url)


def cite_text(text, source_ids, papers):
    labels = [papers[pid].citation_label or f'{author_label(papers[pid])}, {papers[pid].year or "n.d."}'
              for pid in dict.fromkeys(source_ids)]
    text = text.rstrip()
    if text.endswith('.'):
        text = text[:-1]
    return text + ' (' + '; '.join(labels) + ').'


def evidence_counts(evidence):
    # Publication status and study design are independent dimensions.
    counts = Counter(item.extraction.evidence_type for item in evidence)
    return {kind: counts[kind] for kind in ['direct_empirical', 'self_report', 'conceptual', 'review', 'unknown']}


def study_characteristics(evidence):
    rows = ['| Study | Design | n | Setting/population | Evidence type | Publication type |',
            '|---|---|---|---|---|---|']
    def cell(value):
        return str(value or 'unknown').replace('|', '/').replace('\n', ' ')
    for item in evidence:
        paper, extraction = item.metadata, item.extraction
        rows.append('| ' + ' | '.join(cell(value) for value in [paper.citation_label, extraction.study_design,
            extraction.sample_size, extraction.setting or extraction.population, extraction.evidence_type,
            publication_label(paper)]) + ' |')
    return rows


def render_review(synthesis, papers, methodology, evidence=None, question=None):
    assign_citation_labels(papers)
    by_id = {paper.paper_id: paper for paper in papers}
    def render(block):
        return cite_text(block.text, block.source_ids, by_id)
    summary = render(synthesis.summary)
    narrative = [summary]
    providers = ', '.join(dict.fromkeys(run.provider for run in methodology.search_runs))
    queries = '; '.join(dict.fromkeys(run.query for run in methodology.search_runs))
    rows = ['# Literature review', '', '## Scope', '', question or 'Rapid narrative literature review.', '',
        '## Summary', '', summary, '', '## Search methodology', '',
        f'This rapid narrative review searched {providers} on {methodology.searched_at.date().isoformat()}. '
        f'Queries: {queries}. Publication year range: {methodology.year_from or "unbounded"} to {methodology.year_to or "unbounded"}. '
        f'The bounded search returned {methodology.records_retrieved} parsed records, '
        f'{methodology.unique_records} unique works, {methodology.screened} screened records and {methodology.included} included papers. '
        'Evidence extraction used indexed abstracts, not full-text appraisal.', '']
    rows += [f'{methodology.unscreened} eligible metadata records were not screened because the screening budget was reached. '
             + methodology.selection_method, '']
    for run in methodology.search_runs:
        if run.status != 'ok':
            rows += [f'Incomplete search: {run.provider}; query: {run.query}; status: {run.status}. '
                     'This limits search coverage.', '']
    if evidence is not None:
        rows += ['## Evidence base', '', '; '.join(f'{key}: {value}' for key, value in evidence_counts(evidence).items()) + '.', '']
        if synthesis.evidence_base:
            text = render(synthesis.evidence_base)
            rows += [text, '']
            narrative.append(text)
        if all(item.extraction.independent_competence_test != 'yes' for item in evidence) and question and re.search(
                r'assessment|competence', question, re.I):
            rows += ['The included evidence does not establish a validated assessment redesign that measures independent competence. '
                     'This describes the included corpus, not the absence of such research elsewhere.', '']
        rows += ['## Study characteristics', ''] + study_characteristics(evidence) + ['']
        for item in evidence:
            if any(version.get('publication_type') in {'preprint', 'posted-content'} for version in item.metadata.alternate_versions):
                rows += [f'{item.metadata.citation_label}: an alternate preprint was merged into this published work and was not counted separately.', '']
    for section in synthesis.sections:
        rows += ['## ' + section.heading, '']
        for paragraph in section.paragraphs:
            text = render(paragraph)
            rows += [text, '']
            narrative.append(text)
    rows += ['## Comparison of methods', '', render(synthesis.methodology_comparison), '']
    narrative.append(render(synthesis.methodology_comparison))
    for heading, blocks in [('Evidence gaps in the retrieved corpus', synthesis.evidence_gaps), ('Agreements and tensions', synthesis.contradictions)]:
        rows += ['## ' + heading, '']
        for block in blocks:
            text = render(block)
            rows += [text, '']
            narrative.append(text)
        if not blocks:
            rows += ['No passage-grounded ' + ('cross-study tension was established; different designs or populations alone do not establish disagreement.'
                if synthesis.contradictions is blocks else 'research gap was established from author statements or cross-paper comparison.'), '']
    if synthesis.conclusion:
        text = render(synthesis.conclusion)
        rows += ['## Conclusion', '', text, '']
        narrative.append(text)
    rows += ['## Limitations', ''] + [text + '\n' for text in methodology.limitations]
    used = {pid for block in synthesis_blocks(synthesis) for pid in block.source_ids}
    citations = sorted([citation_for(p) for p in papers if p.paper_id in used], key=lambda c: c.formatted.casefold())
    rows += ['## References', ''] + [citation.formatted + '\n' for citation in citations]
    return summary, '\n'.join(rows).strip(), '\n\n'.join(narrative), citations, used
