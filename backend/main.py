from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from typing import List, Optional, Tuple

import httpx
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from pydantic import BaseModel, Field, ValidationError


load_dotenv()

logger = logging.getLogger("assistant.ai")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "models/gemini-2.5-flash")
PUBLIC_DIR = PROJECT_ROOT / "public"
README_PATH = PROJECT_ROOT / "README.md"

try:
    README_INSTRUCTIONS = README_PATH.read_text(encoding="utf-8").strip()
except FileNotFoundError:
    README_INSTRUCTIONS = ""
    logger = logging.getLogger("assistant.ai")
    logger.warning("README.md not found at %s; system prompt will be empty", README_PATH)

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

    system_instruction_text: Optional[str] = None
    history = []

    for message in payload.messages[:-1]:
        role = message.role.lower()
        if role == "system":
            system_instruction_text = message.content.strip()
            continue

        parts = [{"text": message.content.strip()}]
        if role == "assistant":
            history.append({"role": "model", "parts": parts})
        elif role == "user":
            history.append({"role": "user", "parts": parts})
        else:
            return jsonify({"detail": f"Unsupported role '{message.role}'"}), 400

    model_name = normalise_model_name(GEMINI_MODEL)
    request_payload = build_request_body(history, latest.content, system_instruction_text)

    try:
        result = call_gemini(model_name, request_payload)
    except GeminiAPIError as exc:
        logger.error("Gemini API returned %s: %s", exc.status_code, exc.detail)
        return jsonify({"detail": exc.detail}), exc.status_code
    except Exception as exc:  # pragma: no cover
        logger.exception("Gemini request failed")
        return jsonify({"detail": f"Gemini request failed: {exc}"}), 502

    reply_text, emotion_id, raw_reply = parse_model_reply(result)
    return jsonify({"reply": reply_text, "emotionId": emotion_id, "rawReply": raw_reply})


def normalise_model_name(model: str) -> str:
    model = model.strip()
    if not model.startswith("models/"):
        model = f"models/{model}"
    return model


def compose_system_instruction(additional_instruction: Optional[str]) -> Optional[dict]:
    instructions = [README_INSTRUCTIONS.strip()]
    if additional_instruction:
        instructions.append(f"Additional instruction:\n{additional_instruction.strip()}")

    combined = "\n\n".join(filter(None, instructions)).strip()
    if not combined:
        return None

    return {
        "role": "system",
        "parts": [{"text": combined}]
    }


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

    system_payload = compose_system_instruction(system_instruction)
    if system_payload:
        payload["systemInstruction"] = system_payload

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


EMOTION_PREFIX_PATTERN = re.compile(r"^(?P<id>[0-4])\s*(?:[|:-])\s*(?P<body>.*)$", re.DOTALL)


def parse_model_reply(result: dict) -> Tuple[str, int, str]:
    candidates = result.get("candidates", [])
    for candidate in candidates:
        content = candidate.get("content") or {}
        parts = content.get("parts", [])
        texts = [part.get("text", "") for part in parts]
        combined = "\n".join(filter(None, texts)).strip()
        if not combined:
            continue

        match = EMOTION_PREFIX_PATTERN.match(combined)
        if match:
            emotion_id = int(match.group("id"))
            body = match.group("body").strip()
            return body, emotion_id, combined

        return combined, 0, combined

    return "", 0, ""


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
