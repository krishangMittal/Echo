#!/usr/bin/env python3
"""Capture a webcam frame, caption it with Qwen, and speak the result."""
from __future__ import annotations

import argparse
import base64
import sys
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
import sounddevice as sd

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.config import Settings
from app.services.elevenlabs_tts import ElevenLabsClient, ElevenLabsError
from app.services.herdora_vision import HerdoraVisionClient


def frame_to_data_uri(frame: np.ndarray, *, quality: int = 95) -> str:
    """Encode a BGR frame to a base64 JPEG data URI."""
    encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
    success, buffer = cv2.imencode(".jpg", frame, encode_params)
    if not success:
        raise RuntimeError("Failed to encode frame to JPEG")
    b64 = base64.b64encode(buffer.tobytes()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def play_pcm16(audio: bytes, *, sample_rate: int = 16000, device: Optional[str] = None) -> None:
    """Play 16-bit PCM audio using sounddevice."""
    if not audio:
        return
    pcm_int16 = np.frombuffer(audio, dtype="<i2")
    pcm_float = pcm_int16.astype(np.float32) / 32768.0
    sd.play(pcm_float, samplerate=sample_rate, device=device)
    sd.wait()


def main() -> None:
    parser = argparse.ArgumentParser(description="Caption a live webcam snapshot and speak it")
    parser.add_argument("--prompt", default="Describe this image.")
    parser.add_argument("--device", type=int, default=0, help="Camera index (default: 0)")
    parser.add_argument("--width", type=int, help="Force capture width")
    parser.add_argument("--height", type=int, help="Force capture height")
    parser.add_argument("--max-tokens", type=int, help="Override Herdora max tokens")
    parser.add_argument("--voice", help="Override ElevenLabs voice id")
    parser.add_argument("--save-frame", help="Optional path to save the captured frame as JPEG")
    parser.add_argument("--quality", type=int, default=95, help="JPEG quality (default: 95)")
    parser.add_argument("--mute", action="store_true", help="Skip ElevenLabs playback")
    parser.add_argument("--output-device", help="Sounddevice output id/name")
    parser.add_argument("--list-audio-devices", action="store_true", help="List audio devices and exit")
    parser.add_argument("--no-preview", action="store_true", help="Capture immediately without showing a window")
    args = parser.parse_args()

    if args.list_audio_devices:
        print(sd.query_devices())
        return

    settings = Settings()
    vision = HerdoraVisionClient(settings)

    cap = cv2.VideoCapture(args.device)
    if not cap.isOpened():
        raise RuntimeError(f"Unable to open camera index {args.device}")
    try:
        if args.width:
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
        if args.height:
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)

        print("Press SPACE to capture a frame, or ESC to exit.")
        frame: Optional[np.ndarray] = None
        if args.no_preview:
            ret, frame = cap.read()
            if not ret or frame is None:
                raise RuntimeError("Failed to grab frame from camera")
        else:
            while True:
                ret, live_frame = cap.read()
                if not ret:
                    raise RuntimeError("Failed to grab frame from camera")
                cv2.imshow("Webcam", live_frame)
                key = cv2.waitKey(1) & 0xFF
                if key == 27:  # ESC
                    print("Cancelled.")
                    return
                if key in (13, 32):  # Enter or Space
                    frame = live_frame
                    break
            cv2.destroyAllWindows()
        if frame is None:
            raise RuntimeError("No frame captured")
    finally:
        cap.release()
        if not args.no_preview:
            cv2.destroyAllWindows()

    if args.save_frame:
        output_path = Path(args.save_frame).expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(output_path), frame)
        print(f"Saved frame to {output_path}")

    reference = frame_to_data_uri(frame, quality=args.quality)
    try:
        result = vision.describe_image(args.prompt, reference, max_tokens=args.max_tokens)
    except Exception as exc:  # noqa: BLE001
        print(f"Vision request failed: {exc}")
        return

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
