"""Tokenizer-aware text chunking utilities."""
from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass
from typing import Callable, Iterable, List, Optional, Sequence

import tiktoken

from app.config import Settings, get_settings


def _normalize_unicode(text: str) -> str:
    return unicodedata.normalize("NFKC", text)


def _collapse_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _strip_control_chars(text: str) -> str:
    return "".join(ch for ch in text if ch.isprintable() or ch.isspace())


class NormalizationPipeline:
    """Composable normalization steps applied sequentially."""

    def __init__(self, steps: Optional[Sequence[Callable[[str], str]]] = None) -> None:
        self._steps = list(steps) if steps else [
            _normalize_unicode,
            _strip_control_chars,
            _collapse_whitespace,
        ]

    def __call__(self, text: str) -> str:
        result = text
        for step in self._steps:
            result = step(result)
        return result


@dataclass
class Chunk:
    """Represents a chunk of text after token-based splitting."""

    raw_text: str
    normalized_text: str
    token_count: int
    token_start: int
    hash: str


class TextChunker:
    """Chunk long texts using tiktoken-aware windows."""

    def __init__(self, settings: Optional[Settings] = None, normalization: Optional[NormalizationPipeline] = None) -> None:
        self._settings = settings or get_settings()
        self._max_tokens = self._settings.chunk_tokens
        self._overlap = self._settings.chunk_overlap
        self._min_tokens = self._settings.min_tokens
        if self._overlap >= self._max_tokens:
            raise ValueError("Chunk overlap must be smaller than chunk token size")
        self._normalizer = normalization or NormalizationPipeline()
        encoding_name = "cl100k_base"
        try:
            self._encoding = tiktoken.get_encoding(encoding_name)
        except KeyError:
            self._encoding = tiktoken.encoding_for_model(self._settings.embed_model)
        self._step = max(self._max_tokens - self._overlap, 1)

    def chunk(self, text: str) -> List[Chunk]:
        """Split text into normalized chunks."""
        normalized = self._normalizer(text)
        tokens = self._encoding.encode(normalized)
        if not tokens:
            return []
        if len(tokens) <= self._max_tokens:
            chunk = self._build_chunk(tokens, 0)
            if chunk and chunk.token_count >= self._min_tokens:
                return [chunk]
            return []
        chunks: List[Chunk] = []
        start = 0
        while start < len(tokens):
            end = min(start + self._max_tokens, len(tokens))
            token_slice = tokens[start:end]
            chunk = self._build_chunk(token_slice, start)
            if chunk and chunk.token_count >= self._min_tokens:
                chunks.append(chunk)
            if end == len(tokens):
                break
            start = max(0, end - self._overlap)
            if start == end:
                break
        return chunks

    def _build_chunk(self, token_slice: Sequence[int], start: int) -> Optional[Chunk]:
        if not token_slice:
            return None
        raw_text = self._encoding.decode(list(token_slice)).strip()
        normalized = self._normalizer(raw_text)
        if not normalized:
            return None
        token_count = len(token_slice)
        digest = hashlib.sha1(normalized.encode("utf-8")).hexdigest()
        return Chunk(
            raw_text=raw_text,
            normalized_text=normalized,
            token_count=token_count,
            token_start=start,
            hash=digest,
        )

    def normalize(self, text: str) -> str:
        """Expose normalization pipeline for recall queries."""
        return self._normalizer(text)
