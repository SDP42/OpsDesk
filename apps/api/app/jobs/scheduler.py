"""APScheduler inside the API process."""

from __future__ import annotations

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import get_settings
from app.jobs.sla_tick import sla_tick


def build_scheduler() -> AsyncIOScheduler:
    settings = get_settings()
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        sla_tick,
        "interval",
        seconds=settings.sla_tick_seconds,
        id="sla_tick",
        max_instances=1,
        coalesce=True,
    )
    return scheduler
