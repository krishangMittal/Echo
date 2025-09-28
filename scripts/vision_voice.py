#!/usr/bin/env python3
"""Describe an image with Herdora Qwen and speak the caption via ElevenLabs."""
from __future__ import annotations

import argparse
import base64
import sys
from pathlib import Path
from typing import Optional

import numpy as np
import sounddevice as sd

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.config import Settings
from app.services.elevenlabs_tts import ElevenLabsClient, ElevenLabsError
from app.services.herdora_vision import HerdoraVisionClient


def encode_image(path: Path) -> str:
    data = path.read_bytes()
    b64 = base64.b64encode(data).decode("ascii")
    ext = path.suffix.lower().lstrip(".") or "jpeg"
    if ext == "jpg":
        ext = "jpeg"
    return f"data:image/{ext};base64,{b64}"


def play_pcm16(audio: bytes, *, sample_rate: int = 16000, device: Optional[str] = None) -> None:
    if not audio:
        return
    pcm_int16 = np.frombuffer(audio, dtype="<i2")
    pcm_float = pcm_int16.astype(np.float32) / 32768.0
    sd.play(pcm_float, samplerate=sample_rate, device=device)
    sd.wait()


def main() -> None:
    parser = argparse.ArgumentParser(description="Caption an image and speak the response")
    parser.add_argument("--prompt", default="Describe this image.")
    parser.add_argument("--image-path", help="Local image file to send")
    parser.add_argument("--image-url", help="Public URL of an image to send")
    parser.add_argument("--max-tokens", type=int, help="Override Herdora max tokens")
    parser.add_argument("--voice", help="Override ElevenLabs voice id")
    parser.add_argument("--mute", action="store_true", help="Skip audio playback")
    parser.add_argument("--output-device", help="Sounddevice output id/name")
    parser.add_argument("--list-devices", action="store_true", help="List audio devices and exit")
    args = parser.parse_args()

    if args.list_devices:
        print(sd.query_devices())
        return

    if not bool(args.image_path) ^ bool(args.image_url):
        parser.error("Provide exactly one of --image-path or --image-url")

    settings = Settings()
    vision = HerdoraVisionClient(settings)

    reference: str
    if args.image_path:
        reference = encode_image(Path(args.image_path))
    else:
        reference = args.image_url  # type: ignore[assignment]

    try:
        result = vision.describe_image(args.prompt, reference, max_tokens=args.max_tokens)
    except Exception as exc:  # noqa: BLE001
        print(f"Vision request failed: {exc}")
        sys.exit(1)

    if not result.text:
        print("No caption returned.")
        return

    print("Model:", result.model)
    print("Prompt tokens:", result.prompt_tokens)
    print("Completion tokens:", result.completion_tokens)
    print("Caption:\n")
    print(result.text)

    if args.mute:
        return

    try:
        elevenlabs = ElevenLabsClient(settings)
    except RuntimeError as exc:
        print(f"ElevenLabs client error: {exc}")
        return

    try:
        audio = elevenlabs.synthesize(result.text, voice_id=args.voice)
    except ElevenLabsError as exc:
        print(f"ElevenLabs error: {exc}")
        return
    except Exception as exc:  # noqa: BLE001
        print(f"Unexpected ElevenLabs failure: {exc}")
        return

    play_pcm16(audio, device=args.output_device)


if __name__ == "__main__":
    main()
