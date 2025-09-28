import pytest

from app.config import Settings
from app.services.deepgram_stt import DeepgramClient


def test_deepgram_client_requires_api_key():
    settings = Settings(deepgram_api_key=None)
    with pytest.raises(RuntimeError):
        DeepgramClient(settings)
