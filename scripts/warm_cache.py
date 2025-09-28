"""Manually rebuild the hot index from LanceDB."""
from __future__ import annotations

import logging
from pathlib import Path

from app.logging import setup_logging
from app.state import AppState

logger = logging.getLogger(__name__)


def warm_cache() -> None:
    setup_logging(Path("logs"))
    state = AppState.build()
    records = state.memory_store.all_records()
    logger.info("Loaded %d records from LanceDB", len(records))
    state.hot_index.rebuild(records)
    logger.info("Hot index rebuilt with %d records", state.hot_index.size)


if __name__ == "__main__":
    warm_cache()
