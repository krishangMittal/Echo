"""REST API routes for the Echo memory service."""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Request, status

from app.callbacks import CallbackResult, WebhookVerificationError
from app.memory.store import MemoryRecord, MemorySpeaker
from app.state import AppState
from datetime import datetime, timezone
import hashlib

logger = logging.getLogger(__name__)

router = APIRouter()


def get_state(request: Request) -> AppState:
    state = getattr(request.app.state, "container", None)
    if state is None:
        raise RuntimeError("AppState not initialized")
    return state


@router.post("/ingest/callback", status_code=status.HTTP_202_ACCEPTED)
async def ingest_callback(request: Request, state: AppState = Depends(get_state)) -> dict:
    body = await request.body()
    signature = request.headers.get("x-ingest-signature", "")
    try:
        result: CallbackResult = state.callback_processor.process(body, signature)
    except WebhookVerificationError as exc:
        logger.warning("Rejected ingest callback due to signature failure: %s", exc)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid signature") from exc
    except Exception as exc:
        logger.exception("Callback processing failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="callback processing failed") from exc
    hot_metrics = state.hot_index.metrics
    state.metrics.record_callback(result, hot_metrics)
    try:
        lance_rows = state.memory_store.table.count_rows()
    except Exception as exc:
        logger.warning("Unable to count Lance rows: %s", exc)
        lance_rows = -1
    snapshot = state.metrics.snapshot(lance_rows, hot_metrics)
    return {
        "status": "ok",
        "result": result.to_dict(),
        "hot_index": hot_metrics.to_json(),
        "metrics": snapshot.to_dict(),
    }


@router.get("/recall")
async def recall(
    request: Request,
    q: str,
    top_k: Optional[int] = None,
    score_threshold: float = 0.0,
    state: AppState = Depends(get_state),
) -> dict:
    if not q or not q.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="query text is required")
    normalized = state.chunker.normalize(q)
    try:
        vector = state.embeddings.embed_texts([normalized])[0]
    except Exception as exc:
        logger.exception("Failed to embed recall query")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="embedding service error") from exc
    k = top_k or state.settings.topk
    results = state.hot_index.query(vector, topk=k)
    filtered = [
        {
            "id": record.id,
            "conversation_id": record.conv_id,
            "turn": record.turn,
            "speaker": record.speaker.value,
            "score": score,
            "raw_text": record.raw_text,
            "normalized_text": record.normalized_text,
            "tags": list(record.tags),
            "timestamp": record.ts.isoformat(),
            "source": record.source,
            "embed_model": record.embed_model,
        }
        for record, score in results
        if score >= score_threshold
    ]
    return {
        "query": q,
        "normalized_query": normalized,
        "top_k": k,
        "score_threshold": score_threshold,
        "results": filtered,
    }


@router.get("/healthz")
async def healthz(state: AppState = Depends(get_state)) -> dict:
    try:
        rows = state.memory_store.table.count_rows()
        metrics = state.hot_index.metrics
        return {
            "status": "ok",
            "lance": {"rows": rows},
            "hot_index": metrics.to_json(),
        }
    except Exception as exc:
        logger.exception("Health check failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="unhealthy") from exc


@router.get("/metrics")
async def metrics(state: AppState = Depends(get_state)) -> dict:
    try:
        lance_rows = state.memory_store.table.count_rows()
    except Exception as exc:
        logger.warning("Unable to count Lance rows for metrics: %s", exc)
        lance_rows = -1
    hot_metrics = state.hot_index.metrics
    snapshot = state.metrics.snapshot(lance_rows, hot_metrics)
    return {
        "metrics": snapshot.to_dict(),
        "hot_index": hot_metrics.to_json(),
    }


@router.post("/vision/analyze")
async def vision_analyze(
    payload: dict = Body(...),
    state: AppState = Depends(get_state),
) -> dict:
    prompt = (payload.get("prompt") or "Describe this image.").strip()
    image_url = (payload.get("image_url") or "").strip()
    image_base64 = (payload.get("image_base64") or "").strip()
    max_tokens_raw = payload.get("max_tokens")

    if image_url and image_base64:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="provide either image_url or image_base64")
    if not image_url and not image_base64:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="image input is required")

    if max_tokens_raw is not None:
        try:
            max_tokens = int(max_tokens_raw)
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="max_tokens must be an integer") from exc
        if max_tokens <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="max_tokens must be positive")
    else:
        max_tokens = None

    if image_base64:
        reference = image_base64 if image_base64.startswith("data:") else f"data:image/jpeg;base64,{image_base64}"
        ref_type = "base64"
    else:
        reference = image_url
        ref_type = "url"

    try:
        result = state.vision.describe_image(prompt or "Describe this image.", reference, max_tokens=max_tokens)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Herdora vision request failed")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="vision model error") from exc

    return {
        "model": result.model,
        "prompt": prompt,
        "image_type": ref_type,
        "text": result.text,
        "usage": {
            "prompt_tokens": result.prompt_tokens,
            "completion_tokens": result.completion_tokens,
            "total_tokens": result.total_tokens,
        },
    }


@router.post("/test/ingest")
async def test_ingest(
    conversation_id: str,
    text: Optional[str] = None,
    state: AppState = Depends(get_state),
) -> dict:
    """Local helper to ingest text and preview the generated summary flow."""
    ingested = 0
    added = 0
    if text and text.strip():
        # Build a minimal MemoryRecord similar to the callback pipeline
        chunks = state.chunker.chunk(text)
        if chunks:
            results = state.embeddings.embed_chunks(chunks)
            records: list[MemoryRecord] = []
            for chunk, embedding in zip(chunks, results):
                h = hashlib.sha1(f"{conversation_id}:{chunk.token_start}:{chunk.hash}".encode("utf-8")).hexdigest()
                record = MemoryRecord(
                    id=h,
                    conv_id=conversation_id,
                    turn=0,
                    speaker=MemorySpeaker.USER,
                    ts=datetime.now(timezone.utc),
                    raw_text=chunk.raw_text,
                    normalized_text=chunk.normalized_text,
                    vector=embedding.embedding,
                    tags=["local"],
                    hash=h,
                    source="local-test",
                    embed_model=embedding.model,
                    embed_dim=embedding.dimension,
                )
                records.append(record)
            ingested = state.memory_store.upsert(records)
            added = state.hot_index.add_or_update(records)
    # Build a context summary from recent memory
    history = state.memory_store.latest_for_conversation(conversation_id, limit=5)
    if not history:
        return {"status": "ok", "ingested": ingested, "added_to_hot_index": added, "message": "no records for conversation"}
    # Simple summary: take last 1-2 snippets and stitch
    snippets = [r.raw_text.strip() for r in history[-2:] if r.raw_text.strip()]
    summary = ". ".join(s.rstrip(".") for s in snippets if s)
    if summary and not summary.endswith("."):
        summary += "."
    payload = {
        "summary": summary or (history[-1].raw_text if history else ""),
        "snippets": [
            {
                "id": r.id,
                "text": r.raw_text,
                "timestamp": r.ts.isoformat(),
            }
            for r in history[-2:]
        ],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    return {
        "status": "ok",
        "ingested": ingested,
        "added_to_hot_index": added,
        "conversation_id": conversation_id,
        "summary": payload,
    }
