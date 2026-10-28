"""Async provider adapters, metadata parsing, deterministic filtering and DOI checks."""
import asyncio
import json
import html
import re
from difflib import SequenceMatcher
from urllib.parse import quote

import httpx
from openalex_search import reconstruct_abstract
from .models import Paper, SearchRun, Exclusion
from author_names import surname
from difflib import SequenceMatcher
from collections import Counter
import math


def normalize_doi(value):
    return re.sub(r'^(?:https?://(?:dx\.)?doi\.org/|doi:\s*)', '', value or '', flags=re.I).strip().lower() or None


def clean_text(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]*>', ' ', value or ''))).strip()


def title_key(value):
    return re.sub(r'[^\w]+', '', value.casefold())


def parse_openalex(work, query):
    if work.get('is_retracted'):
        return None
    title = clean_text(work.get('title'))
    if not title:
        return None
    location = work.get('primary_location') or {}
    doi = normalize_doi(work.get('doi'))
    return Paper(title=title[:2000], authors=[author['author']['display_name'] for author in (work.get('authorships') or [])[:100]
        if (author.get('author') or {}).get('display_name')], year=work.get('publication_year'), doi=doi,
        url=location.get('landing_page_url') or ('https://doi.org/' + doi if doi else work.get('id')),
        openalex_id=work.get('id'), journal=(location.get('source') or {}).get('display_name'),
        publication_type=('preprint' if work.get('type') not in {'dissertation', 'thesis'} and location.get('version') == 'submittedVersion' else work.get('type')), abstract=reconstruct_abstract(work.get('abstract_inverted_index'))[:20000],
        providers=['openalex'], matched_queries=[query])


def parse_crossref(work, query):
    titles = work.get('title') or []
    if not titles or not clean_text(titles[0]):
        return None
    authors = []
    for author in (work.get('author') or [])[:100]:
        name = ', '.join(filter(None, [author.get('family'), author.get('given')])) or author.get('name')
        if name:
            authors.append(name)
    dates = (work.get('published') or work.get('issued') or {}).get('date-parts') or [[]]
    year = dates[0][0] if dates and dates[0] else None
    doi = normalize_doi(work.get('DOI'))
    return Paper(title=clean_text(titles[0])[:2000], authors=authors, year=year, doi=doi,
        url=work.get('URL') or ('https://doi.org/' + doi if doi else None),
        journal=(work.get('container-title') or [None])[0], publication_type=work.get('type'),
        abstract=clean_text(work.get('abstract'))[:20000], providers=['crossref'], matched_queries=[query],
        related_dois=[normalize_doi(item.get('id')) for relation in (work.get('relation') or {}).values()
                      if isinstance(relation, list) for item in relation
                      if isinstance(item, dict) and item.get('id-type') == 'doi' and normalize_doi(item.get('id'))])


def words(text):
    return re.findall(r"[^\W_]+", text.casefold())


def shingles(text):
    tokens = words(text)
    return {tuple(tokens[i:i + 5]) for i in range(len(tokens) - 4)}


def is_preprint(paper):
    return (paper.publication_type or '').casefold() in {'preprint', 'posted-content'} or bool(
        re.search(r'(?:osf\.io|arxiv\.org|biorxiv\.org|medrxiv\.org)', paper.url or '', re.I))


def same_work(left, right):
    a, b = normalize_doi(left.doi), normalize_doi(right.doi)
    if a and b and a == b:
        return True
    authors_a = {surname(name).casefold() for name in left.authors}
    authors_b = {surname(name).casefold() for name in right.authors}
    author_match = bool(authors_a & authors_b) and len(authors_a & authors_b) / max(1, min(len(authors_a), len(authors_b))) >= .5
    if not author_match:
        return False
    related = (a and a in right.related_dois) or (b and b in left.related_dois)
    if related:
        return True
    title_match = title_key(left.title) == title_key(right.title)
    if (not a or not b) and title_match and left.year == right.year:
        return True
    # Different DOI identities require version evidence, not merely similar prose.
    version_pair = is_preprint(left) != is_preprint(right)
    years_close = left.year is not None and right.year is not None and abs(left.year - right.year) <= 3
    first, second = shingles(left.abstract), shingles(right.abstract)
    overlap = len(first & second) / len(first | second) if first and second else 0
    similar_title = SequenceMatcher(None, ' '.join(words(left.title)), ' '.join(words(right.title))).ratio() >= .7
    return version_pair and years_close and (title_match or similar_title) and overlap >= .8 and min(len(first), len(second)) >= 12


def deduplicate(papers):
    result = []
    for paper in papers:
        matches = [other for other in result if same_work(paper, other)]
        if not matches:
            result.append(paper.model_copy(deep=True))
            continue
        # Merge every match: a later provider record may connect earlier versions.
        versions = matches + [paper]
        best = max(versions, key=lambda item: (not is_preprint(item), len(item.abstract)))
        merged = best.model_copy(deep=True)
        merged.providers = sorted({provider for item in versions for provider in item.providers})
        merged.matched_queries = list(dict.fromkeys(query for item in versions for query in item.matched_queries))
        merged.related_dois = sorted({doi for item in versions for doi in item.related_dois})
        alternates = []
        for item in versions:
            alternates.extend(item.alternate_versions)
            if item is not best and (item.doi != best.doi or item.publication_type != best.publication_type):
                alternates.append({key: getattr(item, key) for key in ['paper_id', 'title', 'doi', 'year', 'url', 'publication_type']})
        merged.alternate_versions = list({json.dumps(item, sort_keys=True): item for item in alternates}.values())
        # Same-identity provider copies can supply missing metadata, never transfer
        # an alternate version's abstract or DOI onto a different published work.
        for item in versions:
            if not merged.doi or normalize_doi(item.doi) == normalize_doi(merged.doi):
                merged.doi = merged.doi or item.doi
                merged.authors = merged.authors or item.authors
                merged.journal = merged.journal or item.journal
                merged.publication_type = merged.publication_type or item.publication_type
                merged.openalex_id = merged.openalex_id or item.openalex_id
        position = min(result.index(item) for item in matches)
        result = [item for item in result if item not in matches]
        result.insert(position, merged)
    return result


STOPWORDS = set('a an the and or of in to for with on is are how what this review literature'.split())


def rank_candidates(papers, request):
    """Local TF-IDF cosine plus question-concept coverage; stable retrieval ties."""
    terms = lambda text: [word for word in words(text) if word not in STOPWORDS]
    query = Counter(terms(request.question + ' ' + ' '.join(request.domain_filters)))
    documents = [Counter(terms(p.title + ' ' + p.title + ' ' + p.abstract)) for p in papers]
    df = Counter(term for document in documents for term in document)
    idf = {term: math.log((len(papers) + 1) / (df[term] + 1)) + 1 for term in set(query) | set(df)}
    vector = lambda counts: {term: (1 + math.log(count)) * idf[term] for term, count in counts.items()}
    q = vector(query)
    q_norm = math.sqrt(sum(v * v for v in q.values()))
    for paper, document in zip(papers, documents):
        d = vector(document)
        norm = math.sqrt(sum(v * v for v in d.values()))
        cosine = sum(value * d.get(term, 0) for term, value in q.items()) / (q_norm * norm) if q_norm and norm else 0
        coverage = len(set(query) & set(document)) / max(1, len(query))
        paper.prescreen_score = round(.7 * cosine + .3 * coverage, 6)
    return sorted(papers, key=lambda paper: paper.prescreen_score, reverse=True)


def filter_metadata(papers, request):
    kept, excluded = [], []
    for paper in papers:
        reason = None
        if paper.publication_type in {'dataset', 'peer-review', 'peer-review-report', 'paratext', 'retraction', 'erratum'} or re.search(
                r'\bPREreview\b|\bpeer[- ]review\s+(?:of|report|comment)', paper.title, re.I):
            reason = 'Excluded record type or peer-review comment.'
        elif len(paper.abstract.strip()) < 100:
            reason = 'No usable abstract (at least 100 characters required).'
        elif (request.search.year_from or request.search.year_to) and paper.year is None:
            reason = 'Publication year unavailable for requested date bounds.'
        elif request.search.year_from and paper.year < request.search.year_from:
            reason = 'Before requested publication range.'
        elif request.search.year_to and paper.year > request.search.year_to:
            reason = 'After requested publication range.'
        if reason:
            excluded.append(Exclusion(paper_id=paper.paper_id, title=paper.title, stage='metadata', reason=reason))
        else:
            kept.append(paper)
    return kept, excluded


class LiteratureRetriever:
    def __init__(self, client, openalex_settings):
        self.client = client
        self.settings = dict(openalex_settings)
        self.network_slots = asyncio.Semaphore(4)

    async def _search(self, provider, query, request, limit):
        if provider == 'openalex' and not self.settings['enabled']:
            return [], SearchRun(provider=provider, query=query, status='disabled', reason='Disabled in app configuration.')
        async with self.network_slots:
            try:
                headers = {'User-Agent': 'HumaniserLiteratureReview/1.0'}
                if provider == 'openalex':
                    if self.settings['key']:
                        headers['Authorization'] = 'Bearer ' + self.settings['key']
                    filters = ['has_abstract:true', 'is_retracted:false']
                    if request.search.year_from or request.search.year_to:
                        filters.append(f'publication_year:{request.search.year_from or 1800}-{request.search.year_to or 2100}')
                    params = {'search': query, 'filter': ','.join(filters), 'per_page': limit,
                        'select': 'id,doi,title,type,publication_year,authorships,abstract_inverted_index,primary_location,is_retracted'}
                    if self.settings['email']:
                        params['mailto'] = self.settings['email']
                    response = await self.client.get('https://api.openalex.org/works', params=params, headers=headers, timeout=25)
                    response.raise_for_status()
                    records = response.json()['results']
                    parser = parse_openalex
                else:
                    filters = ['has-abstract:true']
                    if request.search.year_from:
                        filters.append(f'from-pub-date:{request.search.year_from}-01-01')
                    if request.search.year_to:
                        filters.append(f'until-pub-date:{request.search.year_to}-12-31')
                    response = await self.client.get('https://api.crossref.org/works', params={
                        'query.bibliographic': query, 'rows': limit, 'filter': ','.join(filters),
                        'select': 'DOI,title,author,published,issued,abstract,container-title,type,URL,relation'}, headers=headers, timeout=25)
                    response.raise_for_status()
                    records = response.json()['message']['items']
                    parser = parse_crossref
                if not isinstance(records, list):
                    raise ValueError('Invalid provider results')
                papers = []
                for record in records:
                    try:
                        paper = parser(record, query)
                        if paper:
                            papers.append(paper)
                    except (ValueError, KeyError, TypeError, AttributeError, IndexError):
                        continue
                return papers, SearchRun(provider=provider, query=query, status='ok', returned=len(papers))
            except (httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError):
                return [], SearchRun(provider=provider, query=query, status='failed', reason='Provider failed, timed out or returned invalid metadata.')

    async def search(self, request):
        queries = request.search.queries or [request.query or request.topic]
        limit = min(60, max(10, request.max_papers * 3))
        batches = await asyncio.gather(*(self._search(provider, query, request, limit)
            for provider in request.search.providers for query in queries))
        return [paper for papers, _ in batches for paper in papers], [run for _, run in batches]

    async def verify_dois(self, papers):
        async def verify(paper):
            result = paper.model_copy(deep=True)
            if not paper.doi:
                result.doi_status = 'missing'
                return result
            async with self.network_slots:
                try:
                    response = await self.client.get('https://api.crossref.org/works/' + quote(paper.doi, safe=''),
                        headers={'User-Agent': 'HumaniserLiteratureReview/1.0'}, timeout=12)
                    if response.status_code == 404:
                        result.doi_status = 'not_indexed_in_crossref'
                        return result
                    response.raise_for_status()
                    title = response.json()['message']['title'][0]
                    ratio = SequenceMatcher(None, title_key(title), title_key(paper.title)).ratio()
                    result.doi_status = 'confirmed' if ratio >= .65 else 'metadata_mismatch'
                except (httpx.HTTPError, ValueError, KeyError, TypeError, IndexError):
                    result.doi_status = 'unavailable'
            return result
        return await asyncio.gather(*(verify(paper) for paper in papers))
