from pathlib import Path
import json
import time

# Reuse the authenticated local API helper without creating another document/run.
exec(Path('artifacts/research-workflow/live_check.py').read_text(encoding='utf-8').split("topic = ")[0])
report_path = Path('artifacts/research-workflow/live-report.json')
report = json.loads(report_path.read_text(encoding='utf-8'))
run_id = report['runId']
old = api('/workbench/research-paper/runs/' + run_id)
print(json.dumps({'before': old['status'], 'savedSections': old['completedSections']}), flush=True)
api('/workbench/research-paper/runs/' + run_id + '/retry', {}, 'POST')
report['resumeEvents'] = []
last = None
for _ in range(180):
    state = api('/workbench/research-paper/runs/' + run_id)
    event = (state['status'], state.get('stage'), state.get('completedSections'))
    if event != last:
        change = {'status': event[0], 'stage': event[1], 'completedSections': event[2]}
        report['resumeEvents'].append(change)
        print(json.dumps(change), flush=True)
        last = event
    if state['status'] in ('Completed', 'Failed', 'Interrupted', 'Cancelled'):
        report['resumedOutcome'] = state
        report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
        result = state.get('result') or {}
        print(json.dumps({'status': state['status'], 'completionStatus': result.get('completionStatus'), 'words': result.get('wordCount'),
                          'sections': state['completedSections'], 'error': state.get('error')}), flush=True)
        break
    time.sleep(3)
