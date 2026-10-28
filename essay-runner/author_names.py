"""Normalize author lists without silently preserving duplicate bylines."""
import re


TITLES = r'(?:dr|prof|professor|mr|mrs|ms|miss|mx|sir|dame|rev|hon)'
POST_NOMINALS = r'(?:ph\.?d|dphil|msc|mba|mphil|bsc|esq)'


def strip_honorifics(name):
    """Drop a leading title ("Dr", "Prof.") and trailing post-nominals (", PhD"); neither belongs in a reference or a citation."""
    for _ in range(2):
        name = re.sub(rf'^\s*{TITLES}\.?\s+', '', name, flags=re.I)
    return re.sub(rf'\s*,?\s*{POST_NOMINALS}\.?\s*$', '', name, flags=re.I).strip(' ,')


def clean_authors(authors):
    """One entry per person: a byline such as "Ritu Solanki and Dr Rajesh Kumar" becomes two authors, titles are removed, duplicates collapse."""
    result, seen = [], set()
    for value in authors:
        for name in re.split(r';|\s+(?:and|&)\s+', value, flags=re.I):
            name = strip_honorifics(re.sub(r'\s+', ' ', name).strip().rstrip(';'))
            key = name.casefold()
            if name and key not in seen:
                result.append(name)
                seen.add(key)
    return result


def surname(author):
    author = clean_authors([author])
    if not author:
        return ''
    name = author[0]
    return name.split(',')[0].strip() if ',' in name else name.split()[-1]


def apa_author(author):
    name = author.strip()
    if ',' in name:
        family, given = name.split(',', 1)
    else:
        parts = name.split()
        family, given = parts[-1], ' '.join(parts[:-1])
    initials = ' '.join(word[0].upper() + '.' for word in re.findall(r'[^\W\d_]+', given, re.UNICODE))
    return family.strip() + (', ' + initials if initials else '')


def apa_authors(authors):
    names = [apa_author(name) for name in clean_authors(authors)]
    if len(names) > 20:
        return ', '.join(names[:19]) + ', ... ' + names[-1]
    return ', '.join(names[:-1]) + ', & ' + names[-1] if len(names) > 1 else names[0] if names else ''


def apa_reference(source, *, venue='', volume='', issue='', pages=''):
    author = apa_authors(source.get('authors') or [])
    year, title = source.get('year') or 'n.d.', source['title'].rstrip('.')
    reference = (author.rstrip('.') + f'. ({year}). {title}.' if author else f'{title}. ({year}).')
    publication = venue or source.get('venue') or source.get('publisher') or ''
    if publication:
        publication += (f', {volume}' if volume else '') + (f'({issue})' if issue else '') + (f', {pages}' if pages else '')
        reference += ' ' + publication.rstrip('.') + '.'
    link = ('https://doi.org/' + re.sub(r'^https?://(?:dx\.)?doi\.org/', '', source['doi'], flags=re.I)) if source.get('doi') else source.get('url') or ''
    return (reference + (' ' + link if link else '')).strip()
