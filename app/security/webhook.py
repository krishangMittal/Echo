"""Webhook signature validation for ingest callbacks."""
from __future__ import annotations

import hashlib
import hmac
import logging
import time
from typing import Tuple

logger = logging.getLogger(__name__)


class WebhookVerificationError(Exception):
    """Raised when webhook signature validation fails."""


def _parse_signature_header(signature_header: str) -> Tuple[int, str]:
    signature_header = signature_header.strip()
    if not signature_header:
        return 0, ""
    if "=" not in signature_header:
        return 0, signature_header
    timestamp = 0
    signature_value = ""
    for part in signature_header.split(","):
        key, _, value = part.strip().partition("=")
        key = key.lower()
        if key in {"t", "timestamp"}:
            try:
                timestamp = int(value)
            except ValueError:
                logger.debug("Invalid timestamp in signature header: %s", value)
        elif key in {"v1", "signature", "sha256"} and not signature_value:
            signature_value = value
    return timestamp, signature_value


def verify_webhook_signature(signature_header: str, body: bytes, secret: str, tolerance: int = 300) -> None:
    """Validate webhook signature; raises on failure."""
    if not secret:
        logger.error("Webhook secret is not configured")
        raise WebhookVerificationError("missing webhook secret")
    timestamp, provided_signature = _parse_signature_header(signature_header)
    if not provided_signature:
        logger.debug("Missing signature value in header: %s", signature_header)
        raise WebhookVerificationError("missing signature value")
    message = body
    if timestamp:
        current = int(time.time())
        if abs(current - timestamp) > tolerance:
            logger.debug("Webhook timestamp outside tolerance: %s", timestamp)
            raise WebhookVerificationError("timestamp outside tolerance")
        message = f"{timestamp}.".encode("utf-8") + body
    expected_signature = hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_signature, provided_signature):
        logger.debug("Signature mismatch. expected=%s provided=%s", expected_signature, provided_signature)
        raise WebhookVerificationError("invalid signature")
