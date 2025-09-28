import pytest

from app.config import Settings
from app.services.herdora_vision import HerdoraVisionClient


def test_vision_client_requires_api_key():
    settings = Settings(herdora_api_key=None)
    client = HerdoraVisionClient(settings)
    with pytest.raises(RuntimeError):
        client.describe_image("Describe this image.", "https://example.com/image.jpg")
