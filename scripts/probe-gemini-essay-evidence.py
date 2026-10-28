import json, os, re, textwrap, time, urllib.request, urllib.error
from pathlib import Path

backend = Path('../Humaniser')
services = backend / 'HumaniseAI.Infrastructure/Services'
config = json.loads((backend / 'HumaniseAI.API/appsettings.Development.json').read_text(encoding='utf-8-sig'))
key = os.environ.get('OpenRouter__ApiKey') or config.get('OpenRouter', {}).get('ApiKey')
if not key:
    raise SystemExit('No live-probe credential configured.')

def constant(file, name):
    source = (services / file).read_text(encoding='utf-8-sig')
    match = re.search(r'const string\s+' + name + r'\s*=\s*\$*"""(.*?)""";', source, re.S)
    if not match:
        raise ValueError('Missing prompt constant: ' + name)
    value = textwrap.dedent(match.group(1)).strip()
    return re.sub(r'\{\{(\w+)\}\}', lambda m: constant(file, m.group(1)), value)

def call(system, user, tokens):
    # The same provider/model and Messages wire format observed in the failed live run.
    payload = dict(model='google/gemini-2.5-flash', temperature=0, max_tokens=tokens,
                   system=system, messages=[dict(role='user', content=user)])
    request = urllib.request.Request('https://openrouter.ai/api/v1/messages',
        data=json.dumps(payload).encode(), headers={'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json', 'anthropic-version': '2023-06-01'})
    started = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=65) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError('Provider HTTP status ' + str(error.code)) from None
    text = ''.join(part.get('text', '') for part in result.get('content', []) if part.get('type') == 'text')
    first, last = text.find('{'), text.rfind('}')
    parsed = json.loads(text[first:last+1])
    return dict(parsed=parsed, stopReason=result.get('stop_reason'), usage=result.get('usage'),
                elapsedMs=round((time.monotonic()-started)*1000), rawText=text)

fixture = json.loads(Path('docs/evidence-scope-synthetic-request.json').read_text(encoding='utf-8'))
docs = fixture['libraryDocuments']
sources = [dict(sourceId=f'S{i+1}', title=f'SYNTHETIC fixture {i+1}', access='abstract',
    text=docs[i % len(docs)]['content'], cachedExtraction=None) for i in range(20)]
source = (services / 'EssayEvidencePlanning.cs').read_text(encoding='utf-8-sig')
planning_extra = re.search(r'claude.CompleteAsync\(Rules \+ """(.*?)""", JsonSerializer', source, re.S).group(1)
plan = call(constant('EssayEvidencePlanning.cs', 'Rules') + textwrap.dedent(planning_extra),
    json.dumps(dict(version='evidence-scope-v2-compact', question=fixture['topic'],
        articleType='CriticalEvaluation', academicLevel='Undergraduate', discipline='Psychology',
        wordBudget=1000, provisionalPlan=fixture['approvedPlan'], untrustedSources=sources)), 6000)

cases = [
 ('direct_task', 'In this experiment, task performance was lower in the total-deprivation condition.',
  'SYNTHETIC: An experiment found lower task performance in the total-deprivation condition than normal sleep.'),
 ('component_overreach', 'The experiment established phonological-loop impairment.',
  'SYNTHETIC: Soldiers completed N-back after total deprivation and responses were slower. No phonological-loop component was measured.'),
 ('null_result', 'The study found no detectable N-back change under repeated partial restriction.',
  'SYNTHETIC: The study reported no detectable change in N-back under repeated partial restriction.'),
 ('false_consensus', 'All studies agreed that performance declined.',
  'SYNTHETIC: Results across the included studies were mixed; some reported declines and others no detectable changes.'),
 ('transport_direct', 'In this pilot, journey time was lower on the modified route.',
  'SYNTHETIC: A transport pilot measured lower journey time on the modified route than on the comparison route.'),
 ('exposure_mismatch', 'Partial restriction reduced task performance in the experiment.',
  'SYNTHETIC: The experiment tested acute total deprivation only and observed lower task performance; it did not test partial restriction.'),
 ('grades_overreach', 'The experiment measured lower university grades after deprivation.',
  'SYNTHETIC: The experiment measured lower spatial-span performance after deprivation. It did not measure grades.')]
user = 'CITATIONS TO VERIFY (SYNTHETIC evaluation fixtures, not verified real papers):\n'
for i, (name, claim, evidence) in enumerate(cases, 1):
    user += f'\n[{i}]\nClaim sentence: {claim}\nDocument states — Journal: Synthetic; Authors: Fixture A.\nReal OpenAlex record — Journal: Synthetic; Authors: Fixture A.\nReal title: Synthetic {name}; publication year: 2024\nReal abstract: {evidence}\n'
verified = call(constant('ResearchPrompts.cs', 'CitationVerificationSystemPrompt') + '\n' +
    constant('EssayCitationVerifier.cs', 'AtomicFidelityInstructions'), user, 2620)

report = dict(model='google/gemini-2.5-flash', synthetic=True, planning=plan, verification=verified)
Path('docs/essay-evidence-live-probes-latest.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
planned = plan['parsed']
known = {s['sourceId']: s['text'] for s in sources}
checks = dict(completeJson=plan['stopReason'] != 'max_tokens',
    compactSources=len(planned.get('sources', [])) <= 8,
    compactClaims=0 < len(planned.get('claims', [])) <= 8,
    groundedQuotes=all(s.get('supportingExcerpt') and s.get('supportingExcerpt') in known.get(s.get('sourceId'), '')
        for s in planned.get('sources', []) if s.get('findings')))
print(json.dumps(dict(planningChecks=checks, sources=len(planned.get('sources', [])),
    claims=len(planned.get('claims', [])), planningMs=plan['elapsedMs'],
    verificationMs=verified['elapsedMs'], stopReasons=[plan['stopReason'], verified['stopReason']],
    usage=[plan['usage'], verified['usage']], verdicts=[dict(case=cases[item['id']-1][0],
    claimMatch=item.get('claimMatch'), grade=item.get('supportGrade'), mechanismApplicable=item.get('mechanismApplicable'),
    mechanismFit=item.get('mechanismFit'), conflictApplicable=item.get('conflictApplicable'),
    conflictFit=item.get('conflictFit')) for item in verified['parsed'].get('citations', [])]), indent=2))
if not all(checks.values()):
    raise SystemExit(2)
