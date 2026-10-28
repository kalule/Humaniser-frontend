import asyncio
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app_config import app_settings, openalex_config
from main import app, discover_sources, Source
from openalex_search import reconstruct_abstract, search_openalex


class ConfigTests(unittest.TestCase):
    def test_base_settings_and_development_overrides_merge(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'appsettings.json').write_text(json.dumps({'Literature': {
                'OpenAlexApiKey': 'fixture-key', 'OpenAlexEnabled': True, 'PoliteEmail': 'fixture@example.test'},
                'CitationRunner': {'BaseUrl': 'http://base'}}))
            selected = root / 'appsettings.Development.json'
            selected.write_text(json.dumps({'CitationRunner': {'BaseUrl': 'http://development'}}))
            with patch.dict(os.environ, {'ESSAY_APP_CONFIG': str(selected)}, clear=True):
                self.assertEqual(app_settings()['CitationRunner']['BaseUrl'], 'http://development')
                self.assertEqual(openalex_config(), {'enabled': True, 'key': 'fixture-key', 'email': 'fixture@example.test'})
                with patch.dict(os.environ, {'OPENALEX_ENABLED': 'false', 'OPENALEX_API_KEY': 'override'}):
                    self.assertEqual(openalex_config()['key'], 'override')
                    self.assertFalse(openalex_config()['enabled'])


class OpenAlexTests(unittest.TestCase):
    def test_abstract_reconstruction_is_ordered_and_rejects_gaps(self):
        self.assertEqual(reconstruct_abstract({'third': [2], 'first': [0], 'second': [1]}), 'first second third')
        self.assertEqual(reconstruct_abstract({'missing': [2]}), '')
        self.assertEqual(reconstruct_abstract({'one': [0], 'conflict': [0]}), '')
        self.assertEqual(reconstruct_abstract({'huge': [10000000]}), '')

    def test_search_auth_abstract_provenance_deduplication_and_retractions(self):
        words = 'Students reported positive views of flexible policies while acknowledging that these survey perceptions did not demonstrate measured performance gains.'.split()
        index = {}
        for number, word in enumerate(words):
            index.setdefault(word, []).append(number)
        work = {'id': 'https://openalex.org/W1', 'doi': 'https://doi.org/10.1234/PAPER',
                'title': 'Flexible deadlines', 'publication_year': 2024,
                'authorships': [{'author': {'display_name': 'Alex Smith'}}], 'abstract_inverted_index': index}
        response = httpx.Response(200, request=httpx.Request('GET', 'https://api.openalex.org/works'),
            json={'results': [{**work, 'is_retracted': True}, work, work,
                {**work, 'title': 'Flexible resource scheduling', 'doi': '10.1234/unrelated'},
                {**work, 'doi': '10.1234/none', 'abstract_inverted_index': None}]})
        client = AsyncMock()
        client.get.return_value = response
        result = asyncio.run(search_openalex(client, 'Should universities offer flexible deadlines?', 5,
            {'key': 'fixture-key', 'email': 'fixture@example.test'}))
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['doi'], '10.1234/PAPER')
        self.assertIn(' '.join(words), result[0]['details'])
        self.assertEqual(result[0]['discovery_provider'], 'OpenAlex')
        kwargs = client.get.call_args.kwargs
        self.assertEqual(kwargs['headers']['Authorization'], 'Bearer fixture-key')
        self.assertNotIn('api_key', kwargs['params'])
        self.assertEqual(kwargs['params']['search.title_and_abstract'], 'universities flexible deadlines')

    def test_primary_and_crossref_deduplicate_and_keep_provenance(self):
        primary = {'title': 'OpenAlex paper', 'doi': '10.1234/PAPER', 'details': 'An indexed abstract.',
                   'discovery_provider': 'OpenAlex'}
        crossref = [Source(title='Duplicate', doi='10.1234/paper'),
                    Source(title='Additional paper', doi='10.1234/extra', discovery_provider='Crossref')]
        with TestClient(app):
            app.state.openalex_config = {'enabled': True, 'key': 'fixture-key', 'email': ''}
            with patch('main.search_openalex', new=AsyncMock(return_value=[primary])), patch('main.discover_crossref_sources', new=AsyncMock(return_value=crossref)):
                sources = asyncio.run(discover_sources('Test', 2))
        self.assertEqual([s.discovery_provider for s in sources], ['OpenAlex', 'Crossref'])
        self.assertTrue(sources.warnings)

    def test_failure_fallback_hides_provider_exception(self):
        with TestClient(app):
            app.state.openalex_config = {'enabled': True, 'key': 'fixture-key', 'email': ''}
            with patch('main.search_openalex', new=AsyncMock(side_effect=httpx.ConnectError('private-key-do-not-leak'))), patch('main.discover_crossref_sources', new=AsyncMock(return_value=[Source(title='Fallback')])):
                sources = asyncio.run(discover_sources('Test', 1))
        self.assertEqual(len(sources), 1)
        self.assertNotIn('private-key', ' '.join(sources.warnings))
        self.assertIn('fallback', ' '.join(sources.warnings))

    def test_disabled_provider_is_not_called_and_partial_results_survive_fallback_failure(self):
        with TestClient(app):
            app.state.openalex_config = {'enabled': False, 'key': '', 'email': ''}
            with patch('main.search_openalex', new=AsyncMock()) as primary, patch('main.discover_crossref_sources', new=AsyncMock(return_value=[Source(title='Fallback')])):
                asyncio.run(discover_sources('Test', 1))
                primary.assert_not_awaited()
            app.state.openalex_config['enabled'] = True
            with patch('main.search_openalex', new=AsyncMock(return_value=[{'title': 'Available'}])), patch('main.discover_crossref_sources', new=AsyncMock(side_effect=HTTPException(502, 'Unavailable'))):
                sources = asyncio.run(discover_sources('Test', 2))
                self.assertEqual(len(sources), 1)
                self.assertTrue(any('retained' in warning for warning in sources.warnings))


if __name__ == '__main__':
    unittest.main()
