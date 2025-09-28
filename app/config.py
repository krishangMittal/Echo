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
    ingest_webhook_secret: Optional[str] = Field(default=None, env="INGEST_WEBHOOK_SECRET")
    herdora_api_key: Optional[str] = Field(default=None, env="HERDORA_API_KEY")
    herdora_base_url: str = Field(default="https://pygmalion.herdora.com/v1", env="HERDORA_BASE_URL")
    herdora_vision_model: str = Field(
        default="Qwen/Qwen3-VL-235B-A22B-Instruct", env="HERDORA_VISION_MODEL"
    )
    herdora_max_tokens: int = Field(default=512, env="HERDORA_MAX_TOKENS")
    deepgram_api_key: Optional[str] = Field(default=None, env="DEEPGRAM_API_KEY")
    elevenlabs_api_key: Optional[str] = Field(default=None, env="ELEVENLABS_API_KEY")
    elevenlabs_voice_id: str = Field(default="21m00Tcm4TlvDq8ikWAM", env="ELEVENLABS_VOICE_ID")

    lance_db_uri: str = Field(default="memory_db", env="LANCE_DB_URI")
    lance_table_name: str = Field(default="conversation_memory", env="LANCE_TABLE_NAME")
    hot_index_path: Path = Field(default=Path("hot_index"), env="HOT_INDEX_PATH")

    embed_model: str = Field(default="text-embedding-3-small", env="EMBED_MODEL")
    embed_dim: int = Field(default=1536, env="EMBED_DIM")
    chunk_tokens: int = Field(default=400, env="CHUNK_TOKENS")
    chunk_overlap: int = Field(default=80, env="CHUNK_OVERLAP")
    min_tokens: int = Field(default=20, env="MIN_TOKENS")
    embed_batch: int = Field(default=64, env="EMBED_BATCH")
    hot_window_min: int = Field(default=15, env="HOT_WINDOW_MIN")
    topk: int = Field(default=5, env="TOPK")

    hnsw_m: int = Field(default=64, env="HNSW_M")
    hnsw_ef_con: int = Field(default=200, env="HNSW_EF_CON")
    hnsw_ef: int = Field(default=120, env="HNSW_EF")

    # Webhook verification can be disabled for local testing
    webhook_verify: bool = Field(default=True, env="WEBHOOK_VERIFY")

    config_version: int = Field(default=2, env="CONFIG_VERSION")

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
