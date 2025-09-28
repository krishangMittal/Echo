"""Client for Herdora-hosted Qwen vision endpoint."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from openai import OpenAI

from app.config import Settings


@dataclass
class VisionResult:
    """Structured response from a Herdora vision call."""

    text: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class HerdoraVisionClient:
    """Thin wrapper over the Herdora Qwen vision endpoint."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._model = settings.herdora_vision_model
        self._max_tokens = settings.herdora_max_tokens
        self._client: Optional[OpenAI] = None
        if settings.herdora_api_key:
            self._client = OpenAI(base_url=settings.herdora_base_url, api_key=settings.herdora_api_key)

    def describe_image(self, prompt: str, image_reference: str, *, max_tokens: Optional[int] = None) -> VisionResult:
        client = self._ensure_client()
        response = client.chat.completions.create(
            model=self._model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_reference}},
                    ],
                }
            ],
            max_tokens=max_tokens or self._max_tokens,
        )
        choice = response.choices[0]
        content = choice.message.content or ""
        usage = response.usage
        return VisionResult(
            text=content,
            model=response.model or self._model,
            prompt_tokens=getattr(usage, "prompt_tokens", 0),
            completion_tokens=getattr(usage, "completion_tokens", 0),
            total_tokens=getattr(usage, "total_tokens", 0),
        )

    def _ensure_client(self) -> OpenAI:
        if self._client is None:
            raise RuntimeError("Set HERDORA_API_KEY before using the Herdora vision client")
        return self._client
