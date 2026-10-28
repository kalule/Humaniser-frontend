"""Deterministic checks on a finished essay: cheap, no model, and each one names what is wrong so the student can fix it.

They add warnings, never edit the text: the audit's sentence offsets refer to this exact text, and a silent rewrite here would shift them.
"""
import re

from citation_guard import cited_keys

# "(Ali, 2024) The next sentence": a closing citation bracket followed by a capital, with no full stop between, is a lost sentence end.
_LOST_STOP = re.compile(r'(?<![.!?])\)(?:\s+)(?=[A-Z][a-z])')
_TERMINATED = re.compile(r'[.!?]["\')\]”’]*$')

# Spelling pairs: British form -> American form. Only unambiguous pairs; "program" and "practice/practise" are left out on purpose.
_PAIRS = {
    'personalised': 'personalized', 'personalise': 'personalize', 'personalisation': 'personalization', 'organisation': 'organization',
    'organisations': 'organizations', 'organised': 'organized', 'recognise': 'recognize', 'recognised': 'recognized', 'emphasise': 'emphasize',
    'emphasised': 'emphasized', 'analyse': 'analyze', 'analysed': 'analyzed', 'utilise': 'utilize', 'utilised': 'utilized',
    'summarise': 'summarize', 'summarised': 'summarized', 'behaviour': 'behavior', 'behaviours': 'behaviors', 'endeavour': 'endeavor',
    'favour': 'favor', 'labour': 'labor', 'colour': 'color', 'centre': 'center', 'centres': 'centers', 'judgement': 'judgment',
    'licence': 'license', 'defence': 'defense', 'programme': 'program', 'programmes': 'programs', 'minimise': 'minimize',
    'maximise': 'maximize', 'prioritise': 'prioritize', 'generalise': 'generalize', 'generalisation': 'generalization',
    'standardised': 'standardized', 'standardisation': 'standardization', 'optimise': 'optimize', 'neighbour': 'neighbor',
    'artefact': 'artifact', 'catalogue': 'catalog', 'dialogue': 'dialog', 'learnt': 'learned', 'whilst': 'while',
}
# Several of these are ordinary words in both varieties (a "program" of study, a "licence" vs a "license" verb), so a lone one proves nothing.
_WEAK = {'programme', 'programmes', 'program', 'programs', 'licence', 'license', 'defence', 'defense', 'catalogue', 'catalog', 'dialogue', 'dialog', 'whilst', 'while', 'learnt', 'learned'}

_INTENSIFIER = re.compile(r'\b(significantly|substantially|markedly|dramatically|considerably|statistically)\b', re.I)
_SIGNIFICANCE_IN_SOURCE = re.compile(r'significan|\bp\s*[<=]|confidence interval|\bCI\b|odds ratio|effect size|statistically', re.I)


def _sentences(text):
    return [s.strip() for s in re.split(r'(?<=[.!?])\s+(?=[A-Z(\[])', text) if s.strip()]


def unterminated_sentences(paragraphs):
    """Sections that end mid-sentence, and citations followed by a new sentence with no full stop between them."""
    found = []
    for index, text in enumerate(paragraphs, 1):
        stripped = text.rstrip()
        if stripped and not _TERMINATED.search(stripped):
            found.append(f'Section {index} does not end with a full stop.')
        elif _LOST_STOP.search(text):
            found.append(f'Section {index} has a citation followed by a new sentence with no full stop between them.')
    return found


def new_sources_in_conclusion(paragraphs, sources):
    """The conclusion may only draw on sources the body already used."""
    if len(paragraphs) < 3:
        return []
    earlier = set()
    for text in paragraphs[:-1]:
        earlier |= cited_keys(text, sources)
    fresh = sorted(cited_keys(paragraphs[-1], sources) - earlier)
    return [f'The conclusion cites {", ".join(fresh)}, which no earlier section uses; a conclusion should not introduce a new source.'] if fresh else []


def mixed_spelling(text):
    """Both a British and an American form of the same word in one essay."""
    words = set(re.findall(r"[a-z]+", text.lower()))
    clashes = []
    for british, american in _PAIRS.items():
        if british in words and american in words and british not in _WEAK:
            clashes.append(f'{british}/{american}')
    british_only = sorted(b for b in _PAIRS if b in words and b not in _WEAK)
    american_only = sorted(a for b, a in _PAIRS.items() if a in words and a not in _WEAK and b not in _WEAK)
    if british_only and american_only:
        clashes.append(f'{british_only[0]} alongside {american_only[0]}')
    return [f'The essay mixes British and American spelling ({", ".join(dict.fromkeys(clashes))}). Pick one.'] if clashes else []


def unsupported_intensifiers(paragraphs, sources):
    """"Significantly" (or "statistically") in a sentence whose cited sources report no significance, test or effect size: the wording implies a test nobody saw."""
    by_id = {s['source_id']: s for s in sources}
    flagged = []
    for text in paragraphs:
        for sentence in _sentences(text):
            match = _INTENSIFIER.search(sentence)
            # "Significantly, ..." opening a sentence means "importantly"; it says nothing about a statistical result.
            if not match or (match.start() == 0 and sentence[match.end():match.end() + 1] == ','):
                continue
            cited = [by_id[k] for k in cited_keys(sentence, sources) if k in by_id]
            if cited and not any(_SIGNIFICANCE_IN_SOURCE.search((s.get('details') or '') + ' ' + (s.get('title') or '')) for s in cited):
                flagged.append(f'"{match.group(1)}" is used about a finding whose cited source reports no significance test or effect size: "{sentence[:110]}"')
    return flagged[:5]


def check_essay(paragraphs, sources):
    """All deterministic warnings for the essay's sections, in a stable order."""
    return (unterminated_sentences(paragraphs) + new_sources_in_conclusion(paragraphs, sources)
            + mixed_spelling('\n'.join(paragraphs)) + unsupported_intensifiers(paragraphs, sources))
