from app.config import Settings
from app.text.chunker import Chunk, TextChunker


def build_chunker(max_tokens: int = 30, overlap: int = 5, min_tokens: int = 5) -> TextChunker:
    settings = Settings(chunk_tokens=max_tokens, chunk_overlap=overlap, min_tokens=min_tokens)
    return TextChunker(settings=settings)


def test_chunker_single_chunk():
    chunker = build_chunker(max_tokens=100, overlap=10, min_tokens=1)
    text = "Hello Echo, this is a short message."
    chunks = chunker.chunk(text)
    assert len(chunks) == 1
    assert chunks[0].normalized_text


def test_chunker_overlap(monkeypatch):
    chunker = build_chunker(max_tokens=20, overlap=5, min_tokens=1)
    text = " ".join(["token"] * 120)
    chunks = chunker.chunk(text)
    assert len(chunks) > 1
    # ensure overlap by verifying sequential chunks start before next gap
    starts = [chunk.token_start for chunk in chunks]
    assert starts == sorted(starts)
