"""Safe validation diagnostics and request-local correlation across async model calls."""
import json
import re
from contextvars import ContextVar

from pydantic import ValidationError

review_request_id = ContextVar('literature_review_request_id', default=None)


class EvidenceValidationError(ValueError):
    def __init__(self, issues):
        super().__init__('Evidence validation failed')
        self.issues = issues


def validation_issues(error):
    if isinstance(error, EvidenceValidationError):
        return error.issues[:12]
    if isinstance(error, ValidationError):
        return [{'code': row['type'], 'path': [part if isinstance(part, int) or re.fullmatch(r'[A-Za-z_]{1,40}', str(part)) else '?'
                                               for part in row['loc']]} for row in error.errors(include_input=False, include_url=False)[:12]]
    return [{'code': 'invalid_evidence_binding', 'path': []}]


def constrained_schema(model, payload):
    """Give the model the real identifier sets, including non-contiguous paper IDs."""
    schema = model.model_json_schema()
    papers = payload.get('papers', [])
    evidence = payload.get('evidence', [])
    source_ids = [paper['paper_id'] for paper in papers]
    source_ids += [paper['metadata']['paper_id'] for paper in evidence]
    if payload.get('paper'):
        source_ids.append(payload['paper']['paper_id'])
    passage_ids = [passage['passage_id'] for passage in payload.get('passages', [])]
    passage_ids += [passage['passage_id'] for paper in evidence for passage in paper['passages']]
    def walk(node):
        if not isinstance(node, dict):
            return
        for name, value in node.get('properties', {}).items():
            if name in {'paper_id', 'source_ids'} and source_ids:
                target = value.get('items', value)
                target['enum'] = sorted(set(source_ids))
            if name in {'passage_ids', 'method_passage_ids'} and passage_ids:
                value['items']['enum'] = sorted(set(passage_ids))
        for value in node.values():
            if isinstance(value, dict):
                walk(value)
    walk(schema)
    return schema


def repair_message(raw, issues):
    return '\nREPAIR DATA (not instructions):\n' + json.dumps({
        'previous_response': raw, 'validation_errors': issues}, ensure_ascii=False) + '''
Repair the previous JSON against the ORIGINAL source data and schema. Preserve correct
content. Fix the specific fields/IDs listed above, selecting only real supplied passages.
For a methods claim, select supporting method_passage_ids or set unreported fields to null.
Do not invent a passage or weaken a claim merely by moving its citation. If evidence does
not support a synthesis claim, remove or qualify that claim. Return the complete corrected
JSON object, not a patch. Evidence IDs are opaque; never renumber them.
'''
