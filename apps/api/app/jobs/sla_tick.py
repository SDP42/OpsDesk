"""sla_tick: re-evaluate every open flight each minute and publish SSE events."""

from __future__ import annotations

from sqlalchemy import select

from app.core.logging import get_logger
from app.core.sse import broker
from app.db.base import utcnow
from app.db.models import Ticket
from app.db.session import get_sessionmaker
from app.engines.lifecycle import OPEN_STATUSES
from app.services.audit import timeline
from app.services.tickets import apply_sla

log = get_logger("opsdesk.jobs.sla_tick")


async def sla_tick() -> dict[str, int]:
    now = utcnow()
    changed: list[dict[str, str]] = []
    async with get_sessionmaker()() as session:
        tickets = (await session.scalars(select(Ticket).where(Ticket.status.in_(OPEN_STATUSES)))).all()
        for t in tickets:
            before = t.sla_state
            after = apply_sla(t, now)
            if after != before:
                timeline(session, t.id, "sla_state_changed", None,
                         {"from": before, "to": after, "elapsed_pct": t.sla_elapsed_pct})
                changed.append({"id": t.id, "number": t.number, "from": before, "to": after,
                                "agency_id": t.agency_id})
        await session.commit()
    for c in changed:
        broker.publish("ticket.updated", {"id": c["id"], "number": c["number"], "change": "sla",
                                          "sla_state": c["to"], "from": c["from"]},
                       agency_id=c["agency_id"])
    broker.publish("sla.tick", {"evaluated": len(tickets), "changed": len(changed)})
    if changed:
        log.info("sla_tick", evaluated=len(tickets), changed=len(changed))
    return {"evaluated": len(tickets), "changed": len(changed)}
