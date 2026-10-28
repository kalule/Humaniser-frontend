"""Read the existing app's relevant settings without copying or exposing secrets."""
import json
import os
from pathlib import Path


def app_settings():
    default = Path(__file__).resolve().parents[2] / 'Humaniser/HumaniseAI.API/appsettings.Development.json'
    selected = Path(os.getenv('ESSAY_APP_CONFIG', str(default)))
    merged = {'CitationRunner': {}, 'Literature': {}, 'EssayRunner': {}, 'Llm': {}, 'OpenRouter': {}}
    paths = list(dict.fromkeys([selected.with_name('appsettings.json'), selected]))
    for path in paths:
        if not path.is_file():
            continue
        try:
            config = json.loads(path.read_text(encoding='utf-8-sig'))
            for section in merged:
                values = config.get(section, {})
                if not isinstance(values, dict):
                    raise ValueError('Invalid settings section')
                merged[section].update(values)
        except (OSError, ValueError, TypeError, AttributeError):
            raise RuntimeError('Cannot read essay app configuration.') from None
    return merged


def openalex_config():
    literature = app_settings()['Literature']
    enabled = os.getenv('OPENALEX_ENABLED', os.getenv('Literature__OpenAlexEnabled', str(literature.get('OpenAlexEnabled', True))))
    if enabled.lower() not in {'true', 'false', '1', '0'}:
        raise RuntimeError('OpenAlexEnabled must be a boolean.')
    return {'enabled': enabled.lower() in {'true', '1'},
            'key': os.getenv('OPENALEX_API_KEY') or os.getenv('Literature__OpenAlexApiKey') or literature.get('OpenAlexApiKey') or '',
            'email': os.getenv('OPENALEX_POLITE_EMAIL') or os.getenv('Literature__PoliteEmail') or literature.get('PoliteEmail') or ''}


def openrouter_config():
    """The backend's OpenRouter settings, when it is configured to use OpenRouter. Empty strings otherwise."""
    settings = app_settings()
    if str(settings['Llm'].get('Provider', '')).casefold() != 'openrouter':
        return {'key': '', 'url': ''}
    return {'key': os.getenv('OPENROUTER_API_KEY') or settings['OpenRouter'].get('ApiKey') or '',
            'url': (settings['OpenRouter'].get('BaseUrl') or 'https://openrouter.ai/api/v1').rstrip('/')}
