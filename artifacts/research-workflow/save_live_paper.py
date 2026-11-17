from pathlib import Path
import json
exec(Path('artifacts/research-workflow/live_check.py').read_text(encoding='utf-8').split('topic = ')[0])
report = json.loads(Path('artifacts/research-workflow/live-report.json').read_text(encoding='utf-8'))
result = (report.get('resumedOutcome') or report['outcome'])['result']
assert result['completionStatus'] == 'Complete'
assert not any(flag['code'] == 'ModeMismatch' for flag in result['researchPaperFlags'])
content = Path('artifacts/research-workflow/live-paper.html').read_text(encoding='utf-8')
assert 'data-citation-reference=' in content and '<cite ' in content
payload = {'id': report['documentId'], 'title': 'Research workflow verification — literature-based paper', 'content': content,
           'type': 'doc', 'isPdf': False, 'documentType': 'research-paper', 'citationStyle': 'harvard', 'workbenchGenerationAuditId': result.get('generationAuditId')}
api('/library', payload)
saved = next(document for document in api('/library')['data'] if document['id'] == report['documentId'])
assert saved['content'] == content
base = 'http://localhost:3000/api/v1'
outline = api('/workbench/research-paper/plan', {'topic': result['title'], 'documentType': 'ResearchPaper', 'targetWordCount': 1650, 'researchState': 'LiteratureOnly', 'sourceMode': 'Web'})
assert sum(section['targetWords'] for section in outline) == 1650
report['editorPersistenceCheck'] = {'savedAndReloaded': True, 'interactiveCitationsPreserved': True, 'frontendProxy': True}
Path('artifacts/research-workflow/live-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps({'documentId': report['documentId'], 'savedAndReloaded': True, 'interactiveCitationsPreserved': True, 'frontendProxy': True}))
