"""Live auditor regression for the supplied feedback; requires retrieved source excerpts."""
import argparse
import asyncio
import json
from pathlib import Path

from main import app, lifespan, Source, source_records, complete
from citation_audit import verify_citations, render_audit_table
from evaluate import load_local_environment


async def probe(args):
    load_local_environment()
    request = json.loads(Path(args.request).read_text(encoding='utf-8-sig'))
    sources = source_records([Source.model_validate(s) for s in request['sources']])
    expected_authors = {'Zannella', 'Kennette', 'Hills', 'Rogowski'}
    if not all(any(author in (s.get('authors') or [''])[0] and s.get('details') for s in sources) for author in expected_authors):
        raise ValueError('Provide the four papers and actual abstracts from the marked example.')
    essay = ('Students justified their need for extensions (Zannella & Sutherland, 2025). '
             'Kennette and Rivers (2024) found a strong link between flexible deadlines and positive views of instructors. '
             'Hills and Peacock (2022) found students unanimously reported reduced stress. '
             'Flexible deadlines increased academic performance (Zannella & Sutherland, 2025). '
             'Rogowski (2025) demonstrated that flexible assignment deadlines transfer responsibility to students.')
    async with lifespan(app):
        results = await verify_citations(essay, sources, complete)
    expected = [('unsupported', 'invented_detail'), ('partial', 'overstated_strength'),
                ('partial', 'overstated_strength'), ('unsupported', 'invented_detail'), ('partial', 'scope_mismatch')]
    checks = [{'id': row['id'], 'expected': wanted, 'actual': [row['label'], row['issue']],
               'pass': (row['label'], row['issue']) == wanted} for row, wanted in zip(results, expected)]
    output = Path(args.request).with_name('audit-regression.json')
    output.write_text(json.dumps({'essay': essay, 'results': results, 'checks': checks}, indent=2), encoding='utf-8')
    print(render_audit_table(results), flush=True)
    print(json.dumps(checks), flush=True)
    if not all(check['pass'] for check in checks):
        raise SystemExit('Auditor regression requires review; see ' + str(output))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--request', required=True)
    asyncio.run(probe(parser.parse_args()))
