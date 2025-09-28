"""FastAPI application factory for the Echo memory service."""
from __future__ import annotations

from contextlib import asynccontextmanager
import logging
from pathlib import Path

from fastapi import FastAPI

from app.api.routes import router
from app.logging import setup_logging
from app.state import AppState


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


def create_app() -> FastAPI:
    setup_logging(Path("logs"))
    app = FastAPI(title="Echo Memory Service", version="1.0.0", lifespan=lifespan)
    container = AppState.build()
    app.state.container = container
    logger = logging.getLogger(__name__)
    logger.warning(
        "Webhook verification is %s",
        "ENABLED" if container.settings.webhook_verify else "DISABLED",
    )
    app.include_router(router)
    return app


app = create_app()
