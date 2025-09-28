"""REST API routes for the Echo memory service."""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.callbacks import CallbackResult, WebhookVerificationError
from app.memory import MemoryRecord, MemorySpeaker
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
    
    # Get Pinecone stats instead of hot index metrics
    pinecone_stats = state.memory_store.get_stats()
    state.metrics.record_callback(result, None)  # No hot index metrics
    
    snapshot = state.metrics.snapshot(pinecone_stats.get("total_vector_count", -1), None)
    return {
        "status": "ok",
        "result": result.to_dict(),
        "pinecone": pinecone_stats,
        "metrics": snapshot.to_dict(),
    }


@router.get("/recall")
async def recall(
    request: Request,
    q: str,
    user_id: str,
    top_k: Optional[int] = None,
    score_threshold: float = 0.0,
    state: AppState = Depends(get_state),
) -> dict:
    if not q or not q.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="query text is required")
    if not user_id or not user_id.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id is required")
    
    normalized = state.chunker.normalize(q)
    k = top_k or state.settings.topk
    
    try:
        # Use Pinecone search instead of hot index
        results = state.memory_store.search_by_text(
            user_id=user_id,
            query_text=normalized,
            top_k=k,
            max_distance=1.0 - score_threshold  # Convert score threshold to distance
        )
    except Exception as exc:
        logger.exception("Failed to search semantic memory")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="search service error") from exc
    
    filtered = [
        {
            "id": record.id,
            "conversation_id": record.conv_id,
            "turn": record.turn,
            "speaker": record.speaker.value,
            "score": 1.0 - (1.0 - score_threshold),  # Placeholder score
            "raw_text": record.raw_text,
            "normalized_text": record.normalized_text,
            "tags": list(record.tags),
            "timestamp": record.ts.isoformat(),
            "source": record.source,
            "embed_model": record.embed_model,
            "user_id": record.user_id,
        }
        for record in results
    ]
    
    return {
        "query": q,
        "normalized_query": normalized,
        "user_id": user_id,
        "top_k": k,
        "score_threshold": score_threshold,
        "results": filtered,
    }


@router.get("/healthz")
async def healthz(state: AppState = Depends(get_state)) -> dict:
    try:
        stats = state.memory_store.get_stats()
        return {
            "status": "ok",
            "pinecone": stats,
        }
    except Exception as exc:
        logger.exception("Health check failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="unhealthy") from exc


@router.get("/metrics")
async def metrics(state: AppState = Depends(get_state)) -> dict:
    try:
        stats = state.memory_store.get_stats()
        vector_count = stats.get("total_vector_count", -1)
    except Exception as exc:
        logger.warning("Unable to get Pinecone stats for metrics: %s", exc)
        vector_count = -1
        stats = {"error": str(exc)}
    
    snapshot = state.metrics.snapshot(vector_count, None)
    return {
        "metrics": snapshot.to_dict(),
        "pinecone": stats,
    }


@router.post("/test/ingest")
async def test_ingest(
    conversation_id: str,
    user_id: str,
    text: Optional[str] = None,
    state: AppState = Depends(get_state),
) -> dict:
    """Local helper to ingest text and preview the generated summary flow."""
    ingested = 0
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
                    user_id=user_id,
                )
                records.append(record)
            ingested = state.memory_store.upsert(records)
    
    # Build a context summary from recent memory
    history = state.memory_store.latest_for_conversation(conversation_id, user_id, limit=5)
    if not history:
        return {"status": "ok", "ingested": ingested, "message": "no records for conversation"}
    
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
        "conversation_id": conversation_id,
        "user_id": user_id,
        "summary": payload,
    }
