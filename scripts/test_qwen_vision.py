#!/usr/bin/env python3
"""Quick smoke test for the Herdora Qwen vision endpoint."""
from __future__ import annotations

import argparse
import base64
import sys
from pathlib import Path
from typing import Optional


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.config import Settings
from app.services.herdora_vision import HerdoraVisionClient


def _encode_image(path: Path) -> str:
    data = path.read_bytes()
    encoded = base64.b64encode(data).decode("ascii")
    ext = path.suffix.lower().lstrip(".") or "jpeg"
    if ext == "jpg":
        ext = "jpeg"
    return f"data:image/{ext};base64,{encoded}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Call the Herdora vision endpoint")
    parser.add_argument("--prompt", default="Describe this image.", help="Prompt to send alongside the image")
    parser.add_argument("--image-url", help="Public image URL to send to the model")
    parser.add_argument("--image-path", help="Local image to encode and send")
    parser.add_argument("--max-tokens", type=int, help="Override max tokens for the completion")
    args = parser.parse_args()

    if bool(args.image_url) == bool(args.image_path):
        parser.error("Provide exactly one of --image-url or --image-path")

    settings = Settings()
    client = HerdoraVisionClient(settings)

    reference: str
    if args.image_path:
        reference = _encode_image(Path(args.image_path))
    else:
        reference = args.image_url  # type: ignore[assignment]

    result = client.describe_image(args.prompt, reference, max_tokens=args.max_tokens)
    print("Model:", result.model)
    print("Prompt tokens:", result.prompt_tokens)
    print("Completion tokens:", result.completion_tokens)
    print("Total tokens:", result.total_tokens)
    print("\nResponse:\n")
    print(result.text)


if __name__ == "__main__":
    main()
