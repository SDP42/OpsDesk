"""Black Box export: keyset-paginated streaming CSV / NDJSON with no row cap.

``WHERE (created_at, id) > cursor ORDER BY created_at, id LIMIT 5000`` batches
feed an async generator, so memory stays flat at 60k+ rows.
"""

from __future__ import annotations

import csv
import io
import json
from collections.abc import AsyncIterator
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import Principal, require_lead
from app.db.models import Agency, Intent, Ticket, User
from app.db.session import get_session, get_sessionmaker
from app.services.audit import audit

router = APIRouter(prefix="/export", tags=["export"])

BATCH = 5000
COLUMNS = ["number", "title", "agency", "region", "tboh", "intent", "priority", "status",
           "sla_state", "owner", "check_in", "created_at", "resolved_at", "id"]


def _iso(dt: datetime | None) -> str:
    return dt.isoformat() if dt else ""


async def _rows(filters: list, start_cursor: tuple[datetime, str] | None) -> AsyncIterator[list[dict]]:
    cursor = start_cursor
    async with get_sessionmaker()() as session:
        while True:
            stmt = (select(Ticket.id, Ticket.number, Ticket.title, Agency.name, Ticket.region,
                           Ticket.tboh, Intent.code, Ticket.priority, Ticket.status,
                           Ticket.sla_state, User.name, Ticket.check_in, Ticket.created_at,
                           Ticket.resolved_at)
                    .join(Agency, Agency.id == Ticket.agency_id)
                    .outerjoin(Intent, Intent.id == Ticket.intent_id)
                    .outerjoin(User, User.id == Ticket.owner_id)
                    .where(*filters))
            if cursor:
                c_at, c_id = cursor
                stmt = stmt.where(or_(Ticket.created_at > c_at,
                                      and_(Ticket.created_at == c_at, Ticket.id > c_id)))
            batch = (await session.execute(
                stmt.order_by(Ticket.created_at, Ticket.id).limit(BATCH))).all()
            if not batch:
                return
            yield [{"id": r[0], "number": r[1], "title": r[2], "agency": r[3], "region": r[4],
                    "tboh": r[5] or "", "intent": r[6] or "", "priority": r[7], "status": r[8],
                    "sla_state": r[9], "owner": r[10] or "", "check_in": _iso(r[11]),
                    "created_at": _iso(r[12]), "resolved_at": _iso(r[13])} for r in batch]
            last = batch[-1]
            cursor = (last[12], last[0])
            if len(batch) < BATCH:
                return


async def _csv(filters: list, cursor: tuple[datetime, str] | None) -> AsyncIterator[str]:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=COLUMNS, extrasaction="ignore")
    writer.writeheader()
    yield buf.getvalue()
    async for batch in _rows(filters, cursor):
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=COLUMNS, extrasaction="ignore")
        writer.writerows(batch)
        yield buf.getvalue()


async def _ndjson(filters: list, cursor: tuple[datetime, str] | None) -> AsyncIterator[str]:
    async for batch in _rows(filters, cursor):
        yield "".join(json.dumps(row) + "\n" for row in batch)


@router.get("/tickets")
async def export_tickets(
    format: Literal["csv", "ndjson"] = "csv",
    status: str | None = None,
    region: str | None = None,
    since: datetime | None = None,
    cursor: str | None = Query(default=None, description="created_at|id to resume after"),
    principal: Principal = Depends(require_lead),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    filters: list = []
    if status:
        filters.append(Ticket.status == status)
    if region:
        filters.append(Ticket.region == region)
    if since:
        filters.append(Ticket.created_at >= since)
    start = None
    if cursor and "|" in cursor:
        raw_at, raw_id = cursor.split("|", 1)
        start = (datetime.fromisoformat(raw_at), raw_id)
    total = await session.scalar(select(func.count()).select_from(Ticket).where(*filters))
    audit(session, principal, "export.tickets", "export", None,
          {"format": format, "rows": total, "status": status, "region": region})
    await session.commit()
    gen = _csv(filters, start) if format == "csv" else _ndjson(filters, start)
    media = "text/csv" if format == "csv" else "application/x-ndjson"
    filename = f"opsdesk-blackbox.{format}"
    return StreamingResponse(gen, media_type=media, headers={
        "Content-Disposition": f'attachment; filename="{filename}"',
        "X-Total-Count": str(total or 0),
        "Access-Control-Expose-Headers": "X-Total-Count",
        "Cache-Control": "no-store",
    })
