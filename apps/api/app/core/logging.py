"""Structured logging with structlog; JSON in production, colourised in dev."""

from __future__ import annotations

import logging
import sys

import structlog


def configure_logging(level: str = "INFO", json_logs: bool = False) -> None:
    timestamper = structlog.processors.TimeStamper(fmt="iso", utc=True)
    shared: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        timestamper,
    ]
    renderer: structlog.types.Processor = (
        structlog.processors.JSONRenderer() if json_logs else structlog.dev.ConsoleRenderer()
    )
    structlog.configure(
        processors=[*shared, renderer],
        wrapper_class=structlog.make_filtering_bound_logger(logging.getLevelName(level.upper())),
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )
    logging.basicConfig(level=level.upper(), format="%(message)s", stream=sys.stdout)
    for noisy in ("apscheduler", "aiosqlite", "sqlalchemy.engine"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str = "opsdesk") -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)  # type: ignore[no-any-return]
