# Echo Memory Service

FastAPI service that ingests webhook payloads, persists conversational memory in LanceDB, and serves low-latency recall via an in-memory HNSW index. Pair it with any speech/vision pipeline by posting transcripts or summaries into the ingest endpoint.

## Environment Setup

- Python 3.11+
- `pip install -r requirements.txt`
- Copy `.env.example` to `.env` and populate the credentials:
  - `DEEPSEEK_API_KEY`
  - Optional: `INGEST_WEBHOOK_SECRET` if you want signature verification enabled.
  - Tweak embedding and Lance paths as needed.

### Local/dev testing without webhooks

- To bypass webhook signature verification during local testing, set `WEBHOOK_VERIFY=false` in `.env`.
  - Do not disable verification in staging/production.

## Quick Smoke Tests

```bash
pytest
```

## Run The Server

```bash
./scripts/run_server.sh
```

The API exposes:
- `POST /ingest/callback` – ingest webhook payloads (requires `X-Ingest-Signature` header when verification is enabled)
- `GET /recall?q=...` – retrieve top-k snippets with optional score cut-off
- `GET /healthz` – basic liveness check
- `GET /metrics` – counters plus hot-index metadata

## Expose Via Ngrok & Signature Setup

```bash
ngrok http --domain <your-domain>.ngrok.app 8000
```

Point your upstream service at `https://<your-domain>.ngrok.app/ingest/callback` and share the signing secret via `INGEST_WEBHOOK_SECRET`.

## Warm The Hot Index

```bash
python scripts/warm_cache.py
```

## Replay Dead Letter Queue Payloads

```bash
python scripts/dlq_replay.py --delete-on-success
```

## Logs & Metrics

- Structured JSON logs stream to stdout; rotated text logs live under `logs/app.log`.
- `GET /metrics` exposes chunk/record counters, Lance row count, and hot-index events.
