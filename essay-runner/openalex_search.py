"""OpenAlex discovery adapter. All evidence is an indexed abstract, never full text."""
import re


class Discovery(list):
    def __init__(self, sources=(), warnings=()):
        super().__init__(sources)
        self.warnings = list(warnings)


def reconstruct_abstract(index):
    if not isinstance(index, dict):
        return ''
    positions = {}
    for word, offsets in index.items():
        if not isinstance(word, str) or not isinstance(offsets, list):
            return ''
        for offset in offsets:
            if type(offset) is not int or offset < 0 or offset >= 10000 or offset in positions:
                return ''
            positions[offset] = word
    if not positions or sorted(positions) != list(range(len(positions))):
        return ''
    return ' '.join(positions[i] for i in range(len(positions)))


async def search_openalex(client, title, count, settings):
    # Remove question scaffolding, not subject terms. OpenAlex's lexical search
    # treats remaining words as AND terms, so "should"/"offer" can hide relevant papers.
    stopwords = {'should', 'could', 'would', 'does', 'what', 'which', 'why', 'how', 'can',
                 'the', 'a', 'an', 'to', 'of', 'for', 'and', 'or', 'is', 'are', 'do', 'offer'}
    terms = [word for word in re.findall(r"[\w'-]+", title) if word.casefold() not in stopwords]
    query = ' '.join(terms) or title
    # A hit can mention the query incidentally. Require title-level topic overlap
    # as a conservative screen, allowing common endings such as flexible/flexibility.
    topic_terms = {word.casefold()[:6] for word in terms if len(word) >= 4}
    headers = {'User-Agent': 'HumaniserEssayRunner/1.0'}
    if settings['key']:
        headers['Authorization'] = 'Bearer ' + settings['key']
    params = {'search.title_and_abstract': query,
              'filter': 'has_abstract:true,is_retracted:false',
              'per_page': min(count * 6, 60),
              'select': 'id,doi,title,type,publication_year,authorships,abstract_inverted_index,primary_location,is_retracted'}
    if settings['email']:
        params['mailto'] = settings['email']
    response = await client.get('https://api.openalex.org/works', params=params, headers=headers, timeout=30)
    response.raise_for_status()
    works = response.json()['results']
    if not isinstance(works, list):
        raise ValueError('Invalid OpenAlex results')
    sources, seen = [], set()
    for work in works:
        if not isinstance(work, dict) or work.get('is_retracted'):
            continue
        name = (work.get('title') or '').strip()
        title_terms = {word.casefold()[:6] for word in re.findall(r"[\w'-]+", name) if len(word) >= 4}
        if len(topic_terms & title_terms) < min(2, len(topic_terms)):
            continue
        abstract = reconstruct_abstract(work.get('abstract_inverted_index'))
        if not name or len(abstract) < 100:
            continue
        doi = re.sub(r'^https?://(?:dx\.)?doi\.org/', '', work.get('doi') or '', flags=re.I).strip() or None
        work_id = work.get('id')
        identity = (doi or work_id or name).casefold()
        if identity in seen:
            continue
        seen.add(identity)
        authors = []
        for authorship in (work.get('authorships') or [])[:30]:
            author = (authorship.get('author') or {}).get('display_name')
            if author:
                authors.append(author)
        location = work.get('primary_location') or {}
        year = work.get('publication_year')
        sources.append({'title': name[:1000], 'authors': authors,
            'year': str(year) if year is not None else None, 'doi': doi,
            'url': ('https://doi.org/' + doi) if doi else location.get('landing_page_url') or work_id,
            'details': 'OpenAlex-indexed abstract (not full text): ' + abstract[:19000],
            'discovery_provider': 'OpenAlex', 'openalex_id': work_id,
            'publication_type': work.get('type'),
            'venue': (location.get('source') or {}).get('display_name')})
        if len(sources) >= count:
            break
    return sources
