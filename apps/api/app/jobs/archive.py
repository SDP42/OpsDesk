"""Retention job: closed flights older than the window move to archive_tickets."""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ArchiveTicket, Ticket

POLICY = ("Hot for 90 days after close, then moved to archive_tickets; cold Parquet after "
          "12 months; requester PII anonymised after 24 months.")


async def run_archive(session: AsyncSession, now: datetime, older_than_days: int) -> int:
    cutoff = now - timedelta(days=older_than_days)
    rows = (await session.scalars(
        select(Ticket).where(Ticket.status == "closed", Ticket.closed_at.is_not(None),
                             Ticket.closed_at < cutoff).limit(20000)
    )).all()
    for t in rows:
        session.add(ArchiveTicket(
            id=t.id, number=t.number, title=t.title, agency_id=t.agency_id, tboh=t.tboh,
            intent_code=t.intent.code if t.intent else None, priority=t.priority, status=t.status,
            region=t.region, created_at=t.created_at, resolved_at=t.resolved_at,
            closed_at=t.closed_at, archived_at=now,
            snapshot={"description": t.description, "owner_id": t.owner_id,
                      "routing_reason": t.routing_reason, "sla_state": t.sla_state},
        ))
    if rows:
        await session.execute(delete(Ticket).where(Ticket.id.in_([t.id for t in rows])))
    return len(rows)
