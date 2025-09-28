from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import List, Optional

import httpx
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from pydantic import BaseModel, Field, ValidationError


load_dotenv()

logger = logging.getLogger("assistant.ai")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "models/gemini-2.5-flash")
PUBLIC_DIR = Path(__file__).resolve().parent.parent / "public"

app = Flask(__name__, static_folder=str(PUBLIC_DIR), static_url_path="")


class ChatMessage(BaseModel):
    role: str = Field(..., description="Role for the message: system, user, or assistant")
    content: str = Field(..., description="Plain text content for the message")


class ChatRequest(BaseModel):
    messages: List[ChatMessage]


class GeminiAPIError(RuntimeError):
    def __init__(self, status_code: int, detail: object) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def ensure_configured() -> None:
    if not GEMINI_API_KEY:
        raise RuntimeError("Missing GEMINI_API_KEY in environment or .env")


@app.route("/api/chat", methods=["POST"])
def create_chat_completion():
    try:
        ensure_configured()
    except RuntimeError as exc:
        logger.error("Configuration error: %s", exc)
        return jsonify({"detail": str(exc)}), 500

    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"detail": "Request body must be valid JSON"}), 400

    try:
        payload = ChatRequest.model_validate(data)
    except ValidationError as err:
        return jsonify({"detail": err.errors()}), 400

    if not payload.messages:
        return jsonify({"detail": "messages array cannot be empty"}), 400

    latest = payload.messages[-1]
    if latest.role != "user":
        return jsonify({"detail": "Last message must come from the user"}), 400

    system_instruction: Optional[str] = None
    history = []

    for message in payload.messages[:-1]:
        role = message.role.lower()
        if role == "system":
            system_instruction = message.content.strip()
            continue

        parts = [{"text": message.content.strip()}]
        if role == "assistant":
            history.append({"role": "model", "parts": parts})
        elif role == "user":
            history.append({"role": "user", "parts": parts})
        else:
            return jsonify({"detail": f"Unsupported role '{message.role}'"}), 400

    model_name = normalise_model_name(GEMINI_MODEL)
    request_payload = build_request_body(history, latest.content, system_instruction)

    try:
        result = call_gemini(model_name, request_payload)
    except GeminiAPIError as exc:
        logger.error("Gemini API returned %s: %s", exc.status_code, exc.detail)
        return jsonify({"detail": exc.detail}), exc.status_code
    except Exception as exc:  # pragma: no cover
        logger.exception("Gemini request failed")
        return jsonify({"detail": f"Gemini request failed: {exc}"}), 502

    reply_text = extract_reply_text(result)
    return jsonify({"reply": reply_text})


def normalise_model_name(model: str) -> str:
    model = model.strip()
    if not model.startswith("models/"):
        model = f"models/{model}"
    return model


def build_request_body(history: List[dict], latest_user_message: str, system_instruction: Optional[str]) -> dict:
    contents = history + [
        {
            "role": "user",
            "parts": [{"text": latest_user_message.strip()}]
        }
    ]

    payload: dict = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.7,
        }
    }

    if system_instruction:
        payload["systemInstruction"] = {
            "role": "system",
            "parts": [{"text": system_instruction.strip()}]
        }

    return payload


def call_gemini(model_name: str, payload: dict) -> dict:
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/{model_name}:generateContent"

    transport = httpx.HTTPTransport(retries=3)
    try:
        with httpx.Client(timeout=30.0, transport=transport) as client:
            response = client.post(endpoint, params={"key": GEMINI_API_KEY}, json=payload)
    except httpx.RequestError as exc:
        raise GeminiAPIError(
            503,
            "Unable to reach generativelanguage.googleapis.com. Check your network connection, VPN, or firewall settings."
        ) from exc

    if response.status_code == 200:
        return response.json()

    try:
        details = response.json()
    except Exception:  # pragma: no cover
        details = {"error": response.text}

    raise GeminiAPIError(response.status_code, details.get("error", details))


def extract_reply_text(result: dict) -> str:
    candidates = result.get("candidates", [])
    for candidate in candidates:
        content = candidate.get("content") or {}
        parts = content.get("parts", [])
        texts = [part.get("text", "") for part in parts]
        combined = "\n".join(filter(None, texts))
        if combined.strip():
            return combined.strip()
    return ""


if not PUBLIC_DIR.exists():  # pragma: no cover
    raise RuntimeError(f"Public directory not found at {PUBLIC_DIR}")


@app.route("/")
def serve_index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/<path:path>")
def serve_static(path: str):
    target = PUBLIC_DIR / path
    if target.exists():
        return send_from_directory(app.static_folder, path)
    if path.startswith("api/"):
        return jsonify({"detail": "Not Found"}), 404
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":  # pragma: no cover
    logging.basicConfig(level=logging.INFO)
    app.run(host="0.0.0.0", port=8000, debug=True)
