#!/usr/bin/env python3
"""Interactive microphone -> Deepgram STT -> ElevenLabs TTS loop."""
from __future__ import annotations

import argparse
import io
import sys
import wave

import numpy as np
import sounddevice as sd

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.config import Settings
from app.services.deepgram_stt import DeepgramClient, DeepgramError
from app.services.elevenlabs_tts import ElevenLabsClient, ElevenLabsError

REC_SAMPLE_RATE = 16000
CHANNELS = 1


def capture_audio(duration: float, *, device: int | str | None = None) -> bytes:
    """Record `duration` seconds of audio and return WAV bytes."""
    if duration <= 0:
        raise ValueError("duration must be positive")
    frames = int(duration * REC_SAMPLE_RATE)
    recording = sd.rec(
        frames,
        samplerate=REC_SAMPLE_RATE,
        channels=CHANNELS,
        dtype="float32",
        device=device,
    )
    sd.wait()
    # Convert from float32 (-1, 1) to int16 PCM
    pcm = np.clip(recording[:, 0] * 32767, -32768, 32767).astype("<i2")
    with io.BytesIO() as buffer:
        with wave.open(buffer, "wb") as wf:
            wf.setnchannels(CHANNELS)
            wf.setsampwidth(2)  # int16
            wf.setframerate(REC_SAMPLE_RATE)
            wf.writeframes(pcm.tobytes())
        return buffer.getvalue()


def play_pcm16(
    audio: bytes,
    *,
    sample_rate: int = REC_SAMPLE_RATE,
    device: int | str | None = None,
) -> None:
    """Play raw little-endian 16-bit PCM audio via sounddevice."""
    if not audio:
        return
    pcm_int16 = np.frombuffer(audio, dtype="<i2")
    pcm_float = (pcm_int16.astype(np.float32)) / 32768.0
    sd.play(pcm_float, samplerate=sample_rate, device=device)
    sd.wait()


def main() -> None:
    parser = argparse.ArgumentParser(description="Local voice loop using Deepgram and ElevenLabs")
    parser.add_argument("prompt", nargs="?", default="Say something to transcribe", help="Prompt printed before recording")
    parser.add_argument("--duration", type=float, default=4.0, help="Recording duration in seconds (default: 4.0)")
    parser.add_argument("--voice", help="Override ElevenLabs voice id")
    parser.add_argument("--loop", action="store_true", help="Stay in a loop until interrupted")
    parser.add_argument("--input-device", help="Sounddevice input device id/name")
    parser.add_argument("--output-device", help="Sounddevice output device id/name")
    parser.add_argument("--list-devices", action="store_true", help="List audio devices and exit")
    args = parser.parse_args()

    settings = Settings()

    if args.list_devices:
        print(sd.query_devices())
        return

    if args.input_device or args.output_device:
        sd.default.device = (args.input_device, args.output_device)

    try:
        deepgram = DeepgramClient(settings)
    except RuntimeError as exc:
        print(f"Deepgram client error: {exc}")
        sys.exit(1)

    try:
        elevenlabs = ElevenLabsClient(settings)
    except RuntimeError as exc:
        print(f"ElevenLabs client error: {exc}")
        sys.exit(1)

    print("Press Ctrl+C to exit.")
    try:
        while True:
            print()
            print(args.prompt)
            input("Press Enter to record...")
            try:
                wav_bytes = capture_audio(args.duration, device=args.input_device)
            except Exception as exc:  # noqa: BLE001
                print(f"Recording failed: {exc}")
                continue

            try:
                transcript = deepgram.transcribe_wav(wav_bytes)
            except DeepgramError as exc:
                print(f"Deepgram error: {exc}")
                continue
            except Exception as exc:  # noqa: BLE001
                print(f"Unexpected Deepgram failure: {exc}")
                continue

            if not transcript:
                print("(No transcript returned)")
                if not args.loop:
                    break
                continue

            print(f"You said: {transcript}")

            try:
                audio_bytes = elevenlabs.synthesize(transcript, voice_id=args.voice)
            except ElevenLabsError as exc:
                print(f"ElevenLabs error: {exc}")
                if not args.loop:
                    break
                continue
            except Exception as exc:  # noqa: BLE001
                print(f"Unexpected ElevenLabs failure: {exc}")
                if not args.loop:
                    break
                continue

            print("Playing back response...")
            play_pcm16(audio_bytes, device=args.output_device)

            if not args.loop:
                break
    except KeyboardInterrupt:
        print("\nExiting.")


if __name__ == "__main__":
    main()
