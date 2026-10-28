"""Repeat fixed generation inputs, retaining every audit rather than cherry-picking.

Runs real, billable provider requests. Default is five runs. Source search is frozen
before generation so retrieval variance does not masquerade as writing variance.
"""
import argparse
import asyncio
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException
from main import app, lifespan, EssayRequest, select_evidence, generate


def render_comparison(runs):
    rows = ['# Fixed-input generation comparison', '',
        '| Run | Status | Initial unsupported/misattributed | Final unsupported/misattributed | Final partial | Missing section assignments | Final words |',
        '|---|---|---:|---:|---:|---:|---:|']
    for run in runs:
        initial, final = run.get('initial') or {}, run.get('final') or {}
        values = [run['run'], run['status'], initial.get('unsupported_or_misattributed', '-'),
            final.get('unsupported_or_misattributed', '-'), final.get('partial', '-'),
            len(final.get('missing_assignments', [])), run.get('word_count', '-')]
        rows.append('| ' + ' | '.join(map(str, values)) + ' |')
    rows += ['', 'These are model audit findings against retrieved abstracts, not independent grades. '
             'A needs_review result remains unsuitable to treat as verified. All run artifacts are retained.']
    return '\n'.join(rows) + '\n'


def load_local_environment():
    # Same local credentials as start.ps1; never print or persist them in artifacts.
    env_file = Path(__file__).with_name('.env')
    if env_file.exists():
        for line in env_file.read_text(encoding='utf-8-sig').splitlines():
            key, separator, value = line.partition('=')
            if separator and key.strip() in {'OPENAI_API_KEY', 'ESSAY_API_KEY', 'ESSAY_MODEL', 'ESSAY_BASE_URL',
                    'ESSAY_APP_CONFIG', 'OPENALEX_API_KEY', 'OPENALEX_ENABLED', 'OPENALEX_POLITE_EMAIL',
                    'CITATION_RUNNER_URL', 'CITATION_RUNNER_SECRET'}:
                os.environ.setdefault(key.strip(), value.strip())


async def evaluate(args):
    load_local_environment()
    request = EssayRequest.model_validate_json(Path(args.request).read_text(encoding='utf-8-sig')) if args.request else EssayRequest(
        title='Should universities offer flexible deadlines?', word_count=1200)
    output = Path(args.output or ('evaluation-results/' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')))
    output.mkdir(parents=True, exist_ok=False)
    async with lifespan(app):
        frozen_retrieval = None
        if not request.sources and request.auto_sources:
            sources, frozen_retrieval, _ = await select_evidence(request)
            frozen_retrieval['screening_frozen'] = True
            request = request.model_copy(update={'sources': sources, 'auto_sources': False,
                'resolve_references': False, 'filter_sources': False})
        payload = request.model_dump()
        (output / 'request.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
        digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
        summaries = []
        for number in range(1, args.runs + 1):
            try:
                response = await generate(EssayRequest.model_validate(payload))
                data = response.model_dump()
                if frozen_retrieval:
                    data['retrieval'] = frozen_retrieval
                (output / f'run-{number}.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
                audit = data['citation_audit']
                summary = {'run': number, 'status': audit['status'], 'word_count': data['word_count'],
                    'repair_count': audit['repair_count'], 'initial': audit.get('initial_summary'),
                    'final': audit['summary'], 'guard_rejections': sum('retained draft' in warning for warning in data['warnings'])}
                summary['retrieval'] = data.get('retrieval')
                summary['argument_review'] = data.get('argument_review')
                summary['argument_plan_unresolved_needs'] = data.get('argument_plan', {}).get('unresolved_evidence_needs', [])
            except HTTPException as exc:
                summary = {'run': number, 'status': 'error', 'http_status': exc.status_code, 'detail': exc.detail}
            summaries.append(summary)
            report = {'request_sha256': digest, 'runs_requested': args.runs, 'runs': summaries,
                'note': 'Repeated model audits are diagnostic evidence, not an independent grade or guarantee of factual accuracy.'}
            (output / 'summary.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
            (output / 'comparison.md').write_text(render_comparison(summaries), encoding='utf-8')
            print(json.dumps(summary), flush=True)
    print('Artifacts:', output.resolve(), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--request', help='JSON EssayRequest; defaults to the flexible-deadlines prompt, 1200 words.')
    parser.add_argument('--runs', type=int, choices=range(1, 11), default=5)
    parser.add_argument('--output')
    asyncio.run(evaluate(parser.parse_args()))
