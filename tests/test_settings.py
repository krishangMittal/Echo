from app.config import Settings, get_settings


def test_env_override(monkeypatch):
    monkeypatch.setenv("EMBED_DIM", "1024")
    get_settings.cache_clear()
    settings = get_settings()
    assert settings.embed_dim == 1024
    get_settings.cache_clear()


def test_settings_defaults():
    settings = Settings()
    assert settings.embed_model == "text-embedding-3-small"
    assert settings.chunk_tokens > settings.chunk_overlap
    assert settings.herdora_base_url == "https://pygmalion.herdora.com/v1"
    assert settings.herdora_vision_model == "Qwen/Qwen3-VL-235B-A22B-Instruct"
    assert settings.elevenlabs_voice_id == "21m00Tcm4TlvDq8ikWAM"
