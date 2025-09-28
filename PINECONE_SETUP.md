# Pinecone Migration Setup Guide

## Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Pinecone Configuration
PINECONE_API_KEY=pcn_************************
PINECONE_INDEX=aurora-semantic-memory
PINECONE_CLOUD=aws
PINECONE_REGION=us-east-1
PINECONE_NAMESPACE=prod

# Embeddings / LLMs / Tavus
COHERE_API_KEY=***************************
DEEPSEEK_API_KEY=***************************
TAVUS_API_KEY=***************************

# Legacy OpenAI (if needed)
OPENAI_API_KEY=***************************

# Webhook Configuration
INGEST_WEBHOOK_SECRET=your-webhook-secret-here

# App Configuration
AURORA_ENV=prod
IDENTITY_MAX_DISTANCE=0.40
DEFAULT_MAX_DISTANCE=0.35

# Embedding Configuration (for Cohere light v3.0)
EMBED_MODEL=embed-english-light-v3.0
EMBED_DIM=384
EMBED_BATCH=64
TOPK=5

# Chunking Configuration
CHUNK_TOKENS=400
CHUNK_OVERLAP=80
MIN_TOKENS=20

# Service Configuration
HOT_WINDOW_MIN=15
WEBHOOK_VERIFY=true
CONFIG_VERSION=3
```

## Pinecone Index Setup

1. **Create a serverless index** in Pinecone:
   - **Name:** `aurora-semantic-memory` (or update `PINECONE_INDEX` env var)
   - **Dimension:** `384` (for Cohere `embed-english-light-v3.0`)
   - **Metric:** `cosine`
   - **Cloud/Region:** e.g., `aws` / `us-east-1` (match your `PINECONE_CLOUD` and `PINECONE_REGION`)

2. **Optional Namespaces:**
   - Use `prod`, `staging` for environment separation
   - Or use per-user namespaces for tenant isolation
   - Update `PINECONE_NAMESPACE` accordingly

## Installation

Install the new dependencies:

```bash
pip install -r requirements.txt
```

## Migration from LanceDB

The application now uses:
- **Pinecone** for vector storage and semantic search
- **Cohere** for embeddings (embed-english-light-v3.0, 384 dimensions)
- Removed dependency on LanceDB and hnswlib hot index

### Key Changes:
1. **Memory Store:** `PineconeMemoryStore` replaces `MemoryStore`
2. **Embeddings:** `CohereEmbeddingClient` replaces `OpenAIEmbeddingClient`
3. **Hot Index:** Removed (Pinecone handles fast retrieval)
4. **API Changes:** 
   - `/recall` endpoint now requires `user_id` parameter
   - `/test/ingest` endpoint now requires `user_id` parameter

### API Usage Examples:

**Recall memories:**
```bash
curl "http://localhost:8000/recall?q=hello&user_id=user123&top_k=5"
```

**Test ingestion:**
```bash
curl -X POST "http://localhost:8000/test/ingest" \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "conv_123",
    "user_id": "user123", 
    "text": "Hello, I am John and I love pizza"
  }'
```

## Tavus Integration

The Tavus integration will now pull from Pinecone instead of LanceDB. The semantic memory search provides:
- User profile information (`extracted_name`, `friend_names`)
- Conversation context and history
- Topic and emotion tracking
- Identity-based memory recall with configurable distance thresholds

## Monitoring

- Health check: `GET /healthz` - Returns Pinecone index statistics
- Metrics: `GET /metrics` - Returns vector counts and performance metrics
- Pinecone dashboard provides additional monitoring and analytics
