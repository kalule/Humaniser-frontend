"""Conservative author-date citation matching and per-outline-section guards.

This detects presence, not evidential support. Ambiguous author/year identities
are flagged rather than counted as coverage of multiple papers.
"""
import re
import unicodedata
from collections import Counter
from author_names import clean_authors, surname


def normalized(text):
    return unicodedata.normalize('NFKC', text).replace('\u2019', "'").casefold()


def identity(source):
    authors = clean_authors(source.get('authors') or [])
    name = surname(authors[0]) if authors else source['title'].strip()
    return name, str(source.get('year') or 'n.d.')


def ambiguous_sources(sources):
    counts = Counter((normalized(name), normalized(year)) for name, year in map(identity, sources))
    return [s['source_id'] for s in sources if counts[tuple(map(normalized, identity(s)))] > 1]


def cited_keys(text, sources):
    text = normalized(text)
    ambiguous = set(ambiguous_sources(sources))
    found = set()
    groups = re.findall(r'\([^()]*\)', text)
    for source in sources:
        key = source['source_id']
        if key in ambiguous:
            continue
        name, year = map(normalized, identity(source))
        author = rf'(?<!\w){re.escape(name)}(?!\w)'
        date = rf'{re.escape(year)}(?!\w)'
        narrative = author + rf'(?:\s+(?:&|and)\s+[^()\n,;]{{1,60}}|\s+et\s+al\.?)?\s*\(\s*{date}\s*\)'
        parenthetical = author + rf'[^();\n]{{0,100}}?\b{date}'
        if re.search(narrative, text) or any(re.search(parenthetical, group) for group in groups):
            found.add(key)
    return found


def assigned_keys(section, sources):
    explicit = set(section.get('source_ids') or [])
    return explicit | cited_keys(section['main_idea'] + ' ' + ' '.join(section.get('subtopics') or []), sources)


def accept_refinement(draft, refined, section, sources):
    before, after = cited_keys(draft, sources), cited_keys(refined, sources)
    assigned = assigned_keys(section, sources)
    problems = []
    lost = (before | assigned) - after
    extra = after - (before | assigned)
    if lost:
        problems.append('refinement dropped drafted or assigned sources: ' + ', '.join(sorted(lost)))
    if extra:
        problems.append('refinement added unassigned sources: ' + ', '.join(sorted(extra)))
    if len(refined.split()) < .7 * len(draft.split()):
        problems.append('refinement shortened section by more than 30%')
    # Preserve unknown/changed citations too, without rejecting harmless rewording
    # of known narrative author-date forms. Added unknown citations are audited as well.
    dates = lambda value: set(re.findall(r'\b(?:19|20)\d{2}[a-z]?\b', value))
    added, removed = dates(refined) - dates(draft), dates(draft) - dates(refined)
    if added or removed:
        problems.append(f'refinement changed year values (added: {sorted(added)}; removed: {sorted(removed)})')
    return not problems, problems


def reference_coverage(essay, sources):
    cited = cited_keys(essay.split('\n\nReferences')[0], sources)
    return [s['source_id'] for s in sources if s['source_id'] not in cited]


def tag_citations(text, sources):
    """Rewrite author-date citations as the application's source tokens.

    Narrative "Ngari (2026)" becomes [N:S1]; a parenthetical group made only of citations, such as
    "(Agovic et al., 2025; Ngari, 2026)", becomes [S2][S1]. Ambiguous author/year pairs are never
    tagged, and a group that mixes citations with other words is left as written and counted, so the
    caller can see what was not converted instead of receiving a guess.
    Returns (tagged_text, untagged_group_count).
    """
    ambiguous = set(ambiguous_sources(sources))
    entries = []
    for source in sources:
        if source['source_id'] in ambiguous:
            continue
        name, year = identity(source)
        author = rf'(?<!\w){re.escape(name)}(?!\w)'
        date = rf'{re.escape(year)}(?!\w)'
        narrative = re.compile(author + rf'(?:\s+(?:&|and)\s+[^()\n,;]{{1,60}}|\s+et\s+al\.?)?\s*\(\s*{date}\s*\)', re.I)
        part = re.compile(author + rf'[^();\n]{{0,100}}?\b{date}', re.I)
        entries.append((source['source_id'], narrative, part))
    for key, narrative, _ in entries:
        text = narrative.sub(f'[N:{key}]', text)
    untagged = 0

    def group(match):
        nonlocal untagged
        keys = []
        for piece in match.group(0)[1:-1].split(';'):
            hits = [key for key, _, part in entries if part.search(piece)]
            if len(hits) != 1:
                untagged += 1 if re.search(r'(?:19|20)\d{2}', piece) else 0
                return match.group(0)
            keys.append(hits[0])
        return ''.join(f'[{key}]' for key in dict.fromkeys(keys))

    return re.sub(r'\([^()]*\)', group, text), untagged
