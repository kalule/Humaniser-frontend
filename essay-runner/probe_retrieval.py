"""Live source search/screening probe; no essay is generated."""
import argparse
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException
from evaluate import load_local_environment
from main import app, lifespan, EssayRequest, select_evidence


async def probe(args):
    load_local_environment()
    folder = Path('evaluation-results') / ('retrieval-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    folder.mkdir(parents=True)
    request = EssayRequest(title=args.question, source_count=args.count)
    async with lifespan(app):
        try:
            sources, report, warnings = await select_evidence(request)
            data = {'question': args.question, 'retrieval': report, 'warnings': warnings,
                    'sources': [source.model_dump() for source in sources]}
        except HTTPException as exc:
            data = {'question': args.question, 'http_status': exc.status_code, 'detail': exc.detail}
    (folder / 'retrieval.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    if data.get('retrieval'):
        print('Queries:', data['retrieval']['queries'])
        for source in data['sources']:
            print(source['relevance_score'], source['evidence_kind'], '|', source['title'], '|', source['relevance_reason'])
        print('Accepted:', len(data['sources']))
    else:
        print(json.dumps(data))
    print('Artifact:', (folder / 'retrieval.json').resolve())


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--question', required=True)
    parser.add_argument('--count', type=int, default=5, choices=range(1, 11))
    asyncio.run(probe(parser.parse_args()))
