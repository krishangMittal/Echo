import hashlib
import hmac
import time

import pytest

from app.security.webhook import WebhookVerificationError, verify_webhook_signature


def _signature(secret: str, body: bytes, timestamp: int) -> str:
    message = f"{timestamp}.".encode("utf-8") + body
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def test_signature_happy_path():
    secret = "topsecret"
    body = b"{}"
    timestamp = int(time.time())
    signature = _signature(secret, body, timestamp)
    header = f"t={timestamp},v1={signature}"
    verify_webhook_signature(header, body, secret)


def test_signature_invalid(monkeypatch):
    secret = "topsecret"
    body = b"{}"
    timestamp = int(time.time())
    bad_header = f"t={timestamp},v1=deadbeef"
    with pytest.raises(WebhookVerificationError):
        verify_webhook_signature(bad_header, body, secret)
