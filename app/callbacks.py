"""Callback processing pipeline for generic ingest webhooks."""
from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple
from uuid import NAMESPACE_URL, uuid4, uuid5

from app.config import Settings, get_settings
from app.memory import MemoryRecord, MemorySpeaker, PineconeMemoryStore
from app.security.webhook import WebhookVerificationError, verify_webhook_signature
from app.services.cohere_client import EmbeddingResult, CohereEmbeddingClient
from app.text.chunker import Chunk, TextChunker

logger = logging.getLogger(__name__)


@dataclass
class IngestMessage:
    """Structured message extracted from an ingest webhook payload."""

    conversation_id: str
    turn: int
    speaker: str
    text: str
    timestamp: datetime
    tags: Sequence[str]
    source: str
    user_id: Optional[str] = None


@dataclass
class CallbackResult:
    """Metrics emitted after processing a webhook."""

    conversation_ids: Sequence[str]
    ingested_chunks: int
    stored_records: int
    evicted: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "conversation_ids": list(self.conversation_ids),
            "ingested_chunks": self.ingested_chunks,
            "stored_records": self.stored_records,
            "evicted": self.evicted,
        }


class DeadLetterQueue:
    """Persist failing payloads for later replay/inspection."""

    def __init__(self, root: Path = Path("dlq")) -> None:
        self._root = root
        self._root.mkdir(parents=True, exist_ok=True)

    def write(self, body: bytes, reason: str, extra: Optional[Dict[str, Any]] = None) -> Path:
        entry = {
            "reason": reason,
            "received_at": datetime.now(timezone.utc).isoformat(),
            "body": body.decode("utf-8", errors="replace"),
        }
        if extra:
            entry["extra"] = extra
        filename = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f") + f"_{uuid4().hex}.json"
        path = self._root / filename
        path.write_text(json.dumps(entry, indent=2))
        logger.error("Persisted payload to DLQ at %s due to %s", path, reason)
        return path


class CallbackProcessor:
    """Executes the webhook ingestion pipeline."""

    def __init__(
        self,
        memory_store: PineconeMemoryStore,
        chunker: TextChunker,
        embeddings: CohereEmbeddingClient,
        settings: Optional[Settings] = None,
        dlq: Optional[DeadLetterQueue] = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._store = memory_store
        self._chunker = chunker
        self._embeddings = embeddings
        self._dlq = dlq or DeadLetterQueue(Path("dlq"))

    def process(self, body: bytes, signature_header: str) -> CallbackResult:
        """Full pipeline from signature verification to index update."""
        if self._settings.webhook_verify:
            try:
                verify_webhook_signature(signature_header, body, self._settings.ingest_webhook_secret or "")
            except WebhookVerificationError as exc:
                self._dlq.write(body, f"signature:{exc}", {"signature": signature_header})
                raise
        else:
            logger.warning("Skipping webhook signature verification (WEBHOOK_VERIFY=false)")
        try:
            payload = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError as exc:
            self._dlq.write(body, f"json:{exc}")
            raise
        try:
            messages = self._extract_messages(payload)
            if not messages:
                logger.info("No messages extracted from ingest payload")
                return CallbackResult(conversation_ids=[], ingested_chunks=0, stored_records=0, evicted=0)
            conversation_ids = sorted({msg.conversation_id for msg in messages})
            chunk_pairs: List[Tuple[IngestMessage, Chunk]] = []
            for message in messages:
                chunks = self._chunker.chunk(message.text)
                for chunk in chunks:
                    chunk_pairs.append((message, chunk))
            if not chunk_pairs:
                logger.info("No eligible chunks after applying thresholds", extra={"messages": len(messages)})
                return CallbackResult(
                    conversation_ids=conversation_ids,
                    ingested_chunks=0,
                    stored_records=0,
                    evicted=0,
                )
            try:
                embedding_results = self._embed_chunks(chunk_pairs)
            except Exception as exc:
                self._dlq.write(body, f"embedding:{exc}", {"payload": payload})
                raise
            records: List[MemoryRecord] = []
            for (message, _), embedding in zip(chunk_pairs, embedding_results):
                record = self._build_record(message, embedding)
                records.append(record)
            try:
                upserted = self._store.upsert(records)
            except Exception as exc:
                self._dlq.write(body, f"pinecone:{exc}", {"payload": payload})
                raise
            # Hot index is no longer needed with Pinecone
            added = upserted
            evicted = 0
        except ValueError as exc:
            self._dlq.write(body, f"payload:{exc}", {"payload": payload})
            raise
        except Exception as exc:
            self._dlq.write(body, f"pipeline:{exc}", {"payload": payload})
            raise
        logger.info(
            "Processed ingest callback",
            extra={
                "upserted": upserted,
                "processed": added,
                "evicted": evicted,
                "chunks": len(chunk_pairs),
                "conversation_ids": conversation_ids,
            },
        )
        return CallbackResult(
            conversation_ids=conversation_ids,
            ingested_chunks=len(chunk_pairs),
            stored_records=upserted,
            evicted=evicted,
        )

    def _embed_chunks(self, chunk_pairs: Sequence[Tuple[IngestMessage, Chunk]]) -> List[EmbeddingResult]:
        chunks = [chunk for _, chunk in chunk_pairs]
        results = self._embeddings.embed_chunks(chunks)
        if len(results) != len(chunks):
            raise RuntimeError("Embedding result count mismatch")
        return results

    def _build_record(self, message: IngestMessage, embedding: EmbeddingResult) -> MemoryRecord:
        hash_input = f"{message.conversation_id}:{message.turn}:{embedding.chunk.token_start}:{embedding.chunk.hash}"
        record_hash = hashlib.sha1(hash_input.encode("utf-8")).hexdigest()
        record_id = uuid5(NAMESPACE_URL, record_hash)
        speaker = self._resolve_speaker(message.speaker)
        
        # Extract user_id from conversation_id if not provided
        user_id = message.user_id or message.conversation_id.split('_')[0] if '_' in message.conversation_id else message.conversation_id
        
        return MemoryRecord(
            id=str(record_id),
            conv_id=message.conversation_id,
            turn=message.turn,
            speaker=speaker,
            ts=message.timestamp,
            raw_text=embedding.chunk.raw_text,
            normalized_text=embedding.chunk.normalized_text,
            vector=embedding.embedding,
            tags=list(message.tags),
            hash=record_hash,
            source=message.source,
            embed_model=embedding.model,
            embed_dim=embedding.dimension,
            user_id=user_id,
        )

    def _extract_messages(self, payload: Any) -> List[IngestMessage]:
        if isinstance(payload, list):
            raw_messages = payload
        elif isinstance(payload, dict) and "messages" in payload:
            raw_messages = payload.get("messages", [])
            base_conv = _first_non_empty(
                payload.get("conversation_id"),
                payload.get("conversation", {}).get("id") if isinstance(payload.get("conversation"), dict) else None,
            )
            raw_messages = [self._inject_conversation_id(msg, base_conv) for msg in raw_messages]
        elif isinstance(payload, dict):
            raw_messages = [payload]
        else:
            raise ValueError("unsupported payload shape")
        messages: List[IngestMessage] = []
        for item in raw_messages:
            message = self._parse_message(item)
            if message:
                messages.append(message)
        return messages

    def _inject_conversation_id(self, message: Any, conv_id: Optional[str]) -> Any:
        if isinstance(message, dict) and conv_id and "conversation_id" not in message:
            message = {**message, "conversation_id": conv_id}
        return message

    def _parse_message(self, data: Any) -> Optional[IngestMessage]:
        if not isinstance(data, dict):
            logger.debug("Skipping non-dict message payload: %s", data)
            return None
        conversation_id = _first_non_empty(
            data.get("conversation_id"),
            data.get("conversation", {}).get("id") if isinstance(data.get("conversation"), dict) else None,
        )
        if not conversation_id:
            logger.debug("Skipping message without conversation id: %s", data)
            return None
        text = _first_non_empty(data.get("text"), data.get("message"), data.get("content")) or ""
        if not text:
            logger.debug("Skipping message without text: %s", data)
            return None
        turn = _coerce_int(_first_non_empty(data.get("turn"), data.get("sequence"), data.get("position")), default=0)
        speaker = _first_non_empty(data.get("speaker"), data.get("role"), "unknown")
        timestamp = _parse_timestamp(_first_non_empty(data.get("timestamp"), data.get("ts"), data.get("time")))
        tags = data.get("tags") if isinstance(data.get("tags"), list) else []
        source = _first_non_empty(data.get("source"), "ingest-webhook")
        user_id = _first_non_empty(data.get("user_id"), data.get("user"), data.get("userId"))
        
        return IngestMessage(
            conversation_id=conversation_id,
            turn=turn,
            speaker=str(speaker),
            text=str(text),
            timestamp=timestamp,
            tags=tags,
            source=str(source),
            user_id=str(user_id) if user_id else None,
        )

    def _resolve_speaker(self, speaker: str) -> MemorySpeaker:
        try:
            return MemorySpeaker(speaker.lower())
        except ValueError:
            mapping = {
                "agent": MemorySpeaker.ASSISTANT,
                "bot": MemorySpeaker.ASSISTANT,
                "user": MemorySpeaker.USER,
                "customer": MemorySpeaker.USER,
                "system": MemorySpeaker.SYSTEM,
            }
            key = speaker.lower()
            return mapping.get(key, MemorySpeaker.OTHER)


def _first_non_empty(*values: Any) -> Optional[Any]:
    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and value.strip() == "":
            continue
        return value
    return None


def _coerce_int(value: Any, default: int = 0) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _parse_timestamp(value: Any) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(float(value), tz=timezone.utc)
    if isinstance(value, str):
        cleaned = value.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(cleaned)
        except ValueError:
            try:
                return datetime.fromtimestamp(float(cleaned), tz=timezone.utc)
            except ValueError:
                logger.debug("Unable to parse timestamp %s; defaulting to now", value)
    return datetime.now(timezone.utc)
