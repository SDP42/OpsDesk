"""OpsDesk Control Tower API: FastAPI app, routers, CORS, lifespan and scheduler."""

from __future__ import annotations

import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

import structlog
from fastapi import APIRouter, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.errors import install_error_handlers
from app.core.logging import configure_logging, get_logger
from app.core.sse import broker
from app.db.session import dispose_engine
from app.jobs.scheduler import build_scheduler
from app.routers import (
    admin,
    auth,
    comments,
    export,
    frequencies,
    insights,
    intents,
    links,
    meta,
    stream,
    tickets,
)
from app.services import intents as intent_service

log = get_logger("opsdesk.api")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    settings.resolved_jwt_secret()  # generate on first run
    await intent_service.warm_up()
    scheduler = None
    if settings.scheduler_enabled and settings.app_env != "test":
        scheduler = build_scheduler()
        scheduler.start()
    log.info("tower_online", env=settings.app_env, db=settings.database_url.split("://")[0],
             scheduler=bool(scheduler))
    yield
    if scheduler:
        scheduler.shutdown(wait=False)
    await dispose_engine()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level, json_logs=settings.app_env == "production")
    app = FastAPI(
        title="OpsDesk Control Tower API",
        version="0.1.0",
        description="Every ticket is a flight. Travel-ops ticketing for TBO's B2B world.",
        lifespan=lifespan,
        docs_url="/docs",
        openapi_url="/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["X-Total-Count", "X-Request-Id"],
    )

    @app.middleware("http")
    async def request_log(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
        structlog.contextvars.bind_contextvars(request_id=request_id)
        start = time.perf_counter()
        response = await call_next(request)
        elapsed = round((time.perf_counter() - start) * 1000, 1)
        response.headers["X-Request-Id"] = request_id
        if request.url.path != "/api/stream":
            log.info("request", method=request.method, path=request.url.path,
                     status=response.status_code, ms=elapsed)
        structlog.contextvars.clear_contextvars()
        return response

    install_error_handlers(app)

    api = APIRouter(prefix="/api")
    for module in (auth, tickets, comments, links, frequencies, intents, insights, export,
                   stream, admin, meta):
        api.include_router(module.router)
    api.include_router(auth.me_router)

    @api.get("/health", tags=["meta"])
    async def health() -> dict[str, object]:
        return {"data": {"status": "ok", "subscribers": broker.subscriber_count}}

    app.include_router(api)
    return app


app = create_app()
