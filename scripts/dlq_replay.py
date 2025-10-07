"""Replay DLQ payloads through the callback processor."""
from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

from app.callbacks import WebhookVerificationError
from app.logging import setup_logging
from app.state import AppState

logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Replay ingest DLQ payloads")
    parser.add_argument("paths", nargs="*", help="Specific DLQ files to replay")
    parser.add_argument(
        "--directory",
        default="dlq",
        help="Directory containing DLQ payloads (default: dlq)",
    )
    parser.add_argument(
        "--delete-on-success",
        action="store_true",
        help="Remove DLQ files after successful replay",
    )
    return parser.parse_args()


def load_paths(args: argparse.Namespace) -> list[Path]:
    if args.paths:
        return [Path(path) for path in args.paths]
    dlq_dir = Path(args.directory)
    return sorted(dlq_dir.glob("*.json"))


def replay(path: Path, state: AppState, delete_on_success: bool) -> None:
    try:
        payload = json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        logger.error("Skipping %s: invalid JSON (%s)", path, exc)
        return
    body = payload.get("body", "").encode("utf-8")
    signature = payload.get("extra", {}).get("signature", "")
    try:
        result = state.callback_processor.process(body, signature)
        logger.info("Replayed %s successfully", path)
        if delete_on_success:
            path.unlink()
    except WebhookVerificationError as exc:
        logger.error("Replay failed for %s due to signature error: %s", path, exc)
    except Exception:
        logger.exception("Replay failed for %s", path)


def main() -> None:
    args = parse_args()
    setup_logging(Path("logs"))
    state = AppState.build()
    paths = load_paths(args)
    if not paths:
        logger.info("No DLQ files found")
        return
    for path in paths:
        replay(path, state, args.delete_on_success)


if __name__ == "__main__":
    main()
