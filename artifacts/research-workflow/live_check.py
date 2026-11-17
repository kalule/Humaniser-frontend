"""Local integration check. Credentials stay in process memory and are never logged."""
import ast
import json
import re
import time
import urllib.request
import urllib.error
from pathlib import Path
from uuid import uuid4

base = 'http://localhost:5062/api/v1'
fixture = Path('_rv_step1_login.cjs').read_text(encoding='utf-8')
def fixture_value(name):
    match = re.search(r'page\.fill\(' + name + r',\s*([\'\"])(.*?)\1\)', fixture)
    return ast.literal_eval(match.group(1) + match.group(2) + match.group(1))
token = None
def api(path, body=None, method=None):
    headers = {'Content-Type': 'application/json'}
    if token: headers['Authorization'] = 'Bearer ' + token
    request = urllib.request.Request(base + path, data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method or ('POST' if body is not None else 'GET'))
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            data = response.read()
            return json.loads(data) if data else None
    except urllib.error.HTTPError as error:
        data = error.read().decode()
        raise RuntimeError(f'{path}: HTTP {error.code}: {data[:1200]}') from None

auth = api('/auth/login', {'email': fixture_value('emailSel'), 'password': fixture_value('passSel')})
token = auth['data']['accessToken']
topic = 'The relationship between social media use, time management, and academic performance among university students.'
document = api('/library', {'title': 'Research workflow verification — literature-based paper', 'type': 'doc', 'isPdf': False, 'documentType': 'research-paper', 'citationStyle': 'harvard'})['data']
request = {'topic': topic, 'documentType': 'ResearchPaper', 'targetWordCount': 1650, 'researchState': 'LiteratureOnly', 'sourceMode': 'Web',
           'researchPaperProfile': 'SocialScience', 'citationStyle': 'Harvard', 'includeSeparateLiteratureReview': True, 'researchEvidence': {}}
plan = api('/workbench/research-paper/plan', request)
assert sum(section['targetWords'] for section in plan) == 1650
assert not any(section['sectionKey'] == 'Results' for section in plan)
request['approvedResearchPaperPlan'] = plan
run_id = str(uuid4())
submission = {'runId': run_id, 'documentId': document['id'], 'request': request}
api('/workbench/research-paper/runs', submission)
api('/workbench/research-paper/runs', submission)
print(json.dumps({'documentId': document['id'], 'runId': run_id, 'mode': 'LiteratureOnly', 'outlineWords': 1650, 'idempotentResubmit': True}), flush=True)
report = {'documentId': document['id'], 'runId': run_id, 'mode': 'LiteratureOnly', 'events': []}
last = None
for _ in range(180):
    state = api('/workbench/research-paper/runs/' + run_id)
    event = (state['status'], state.get('stage'), state.get('completedSections'))
    if event != last:
        report['events'].append({'status': event[0], 'stage': event[1], 'completedSections': event[2]})
        print(json.dumps(report['events'][-1]), flush=True)
        last = event
    if state['status'] in ('Completed', 'Failed', 'Interrupted', 'Cancelled'):
        report['outcome'] = state
        Path('artifacts/research-workflow/live-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        if state['status'] == 'Completed':
            print(json.dumps({'status': 'Completed', 'words': state['result']['wordCount'], 'references': len(state['result']['references']), 'sections': state['completedSections']}), flush=True)
        else:
            print(json.dumps({'status': state['status'], 'error': state.get('error')}), flush=True)
        break
    time.sleep(3)
else:
    print('Run remains in progress. Check the saved run ID; no duplicate job was submitted.', flush=True)
