"""Minimal Deepgram speech-to-text client."""
from __future__ import annotations

from typing import Optional

import httpx

from app.config import Settings


class DeepgramError(RuntimeError):
    """Raised when the Deepgram API responds with an error."""


class DeepgramClient:
    """Simple wrapper around the Deepgram REST transcription endpoint."""

    _ENDPOINT = "https://api.deepgram.com/v1/listen"

    def __init__(self, settings: Settings) -> None:
        if not settings.deepgram_api_key:
            raise RuntimeError("Set DEEPGRAM_API_KEY before using the Deepgram client")
        self._api_key = settings.deepgram_api_key
        self._model = "nova-3-general"
        self._timeout = httpx.Timeout(15.0)

    def transcribe_wav(self, audio_bytes: bytes, *, language: Optional[str] = None) -> str:
        headers = {
            "Authorization": f"Token {self._api_key}",
            "Content-Type": "audio/wav",
        }
        params = {
            "smart_format": "true",
            "model": self._model,
        }
        if language:
            params["language"] = language
        with httpx.Client(timeout=self._timeout) as client:
            response = client.post(self._ENDPOINT, headers=headers, params=params, content=audio_bytes)
        if response.status_code >= 400:
            raise DeepgramError(f"Deepgram error {response.status_code}: {response.text}")
        data = response.json()
        try:
            transcript = data["results"]["channels"][0]["alternatives"][0].get("transcript", "")
        except (KeyError, IndexError):
            transcript = ""
        return transcript.strip()
