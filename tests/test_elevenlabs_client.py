import pytest

from app.config import Settings
from app.services.elevenlabs_tts import ElevenLabsClient


def test_elevenlabs_client_requires_api_key():
    settings = Settings(elevenlabs_api_key=None)
    with pytest.raises(RuntimeError):
        ElevenLabsClient(settings)
