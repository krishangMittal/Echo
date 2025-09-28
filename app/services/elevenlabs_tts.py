"""Minimal ElevenLabs text-to-speech client."""
from __future__ import annotations

from typing import Optional

import httpx

from app.config import Settings


class ElevenLabsError(RuntimeError):
    """Raised when the ElevenLabs API responds with an error."""


class ElevenLabsClient:
    """Thin wrapper around the ElevenLabs TTS REST API."""

    _ENDPOINT_TEMPLATE = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

    def __init__(self, settings: Settings) -> None:
        if not settings.elevenlabs_api_key:
            raise RuntimeError("Set ELEVENLABS_API_KEY before using the ElevenLabs client")
        self._api_key = settings.elevenlabs_api_key
        self._voice_id = settings.elevenlabs_voice_id
        self._timeout = httpx.Timeout(30.0)

    def synthesize(
        self,
        text: str,
        *,
        voice_id: Optional[str] = None,
        model_id: str = "eleven_multilingual_v2",
        stability: float = 0.5,
        similarity_boost: float = 0.75,
        output_format: str = "pcm_16000",
    ) -> bytes:
        voice = voice_id or self._voice_id
        endpoint = self._ENDPOINT_TEMPLATE.format(voice_id=voice)
        headers = {
            "xi-api-key": self._api_key,
            "Accept": "application/octet-stream",
        }
        payload = {
            "text": text,
            "model_id": model_id,
            "voice_settings": {
                "stability": stability,
                "similarity_boost": similarity_boost,
            },
        }
        with httpx.Client(timeout=self._timeout) as client:
            response = client.post(
                endpoint,
                headers=headers,
                params={"output_format": output_format},
                json=payload,
            )
        if response.status_code >= 400:
            raise ElevenLabsError(f"ElevenLabs error {response.status_code}: {response.text}")
        return response.content
