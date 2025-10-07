"""Application configuration powered by Pydantic settings."""
from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import Field

try:  # pragma: no cover - import glue for pydantic<->settings split
    from pydantic_settings import BaseSettings
except ImportError:  # pragma: no cover
    from pydantic import BaseSettings  # type: ignore


class Settings(BaseSettings):
    """Central configuration for the Echo memory service."""

    openai_api_key: Optional[str] = Field(default=None, env="OPENAI_API_KEY")
    cohere_api_key: Optional[str] = Field(default=None, env="COHERE_API_KEY")
    deepseek_api_key: Optional[str] = Field(default=None, env="DEEPSEEK_API_KEY")
    tavus_api_key: Optional[str] = Field(default=None, env="TAVUS_API_KEY")
    ingest_webhook_secret: Optional[str] = Field(default=None, env="INGEST_WEBHOOK_SECRET")

    # Pinecone configuration
    pinecone_api_key: Optional[str] = Field(default=None, env="PINECONE_API_KEY")
    pinecone_index: str = Field(default="aurora-semantic-memory", env="PINECONE_INDEX")
    pinecone_cloud: str = Field(default="aws", env="PINECONE_CLOUD")
    pinecone_region: str = Field(default="us-east-1", env="PINECONE_REGION")
    pinecone_namespace: Optional[str] = Field(default="prod", env="PINECONE_NAMESPACE")

    # Legacy LanceDB configuration (deprecated)
    lance_db_uri: str = Field(default="memory_db", env="LANCE_DB_URI")
    lance_table_name: str = Field(default="conversation_memory", env="LANCE_TABLE_NAME")
    hot_index_path: Path = Field(default=Path("hot_index"), env="HOT_INDEX_PATH")

    # Embedding configuration - updated for Cohere
    embed_model: str = Field(default="embed-english-light-v3.0", env="EMBED_MODEL")
    embed_dim: int = Field(default=384, env="EMBED_DIM")
    chunk_tokens: int = Field(default=400, env="CHUNK_TOKENS")
    chunk_overlap: int = Field(default=80, env="CHUNK_OVERLAP")
    min_tokens: int = Field(default=20, env="MIN_TOKENS")
    embed_batch: int = Field(default=64, env="EMBED_BATCH")
    hot_window_min: int = Field(default=15, env="HOT_WINDOW_MIN")
    topk: int = Field(default=5, env="TOPK")

    # Distance thresholds
    identity_max_distance: float = Field(default=0.40, env="IDENTITY_MAX_DISTANCE")
    default_max_distance: float = Field(default=0.35, env="DEFAULT_MAX_DISTANCE")

    hnsw_m: int = Field(default=64, env="HNSW_M")
    hnsw_ef_con: int = Field(default=200, env="HNSW_EF_CON")
    hnsw_ef: int = Field(default=120, env="HNSW_EF")

    # Webhook verification can be disabled for local testing
    webhook_verify: bool = Field(default=True, env="WEBHOOK_VERIFY")

    # Environment
    aurora_env: str = Field(default="prod", env="AURORA_ENV")

    config_version: int = Field(default=3, env="CONFIG_VERSION")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

    @property
    def lance_db_path(self) -> Path:
        """Resolve the LanceDB URI to a local path when the URI is relative."""
        uri = self.lance_db_uri
        if uri.startswith(".") or not any(uri.startswith(prefix) for prefix in ("s3://", "gs://", "azure://")):
            return Path(uri).resolve()
        return Path(uri)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached settings instance so configuration is loaded once."""
    return Settings()
