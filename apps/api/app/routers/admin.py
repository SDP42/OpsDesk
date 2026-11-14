"""Admin: run the retention job on demand (Hangar demo)."""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.rbac import Principal, require_lead
from app.db.base import utcnow
from app.db.session import get_session
from app.jobs.archive import POLICY, run_archive
from app.schemas.common import Envelope
from app.schemas.misc import ArchiveRunIn, ArchiveRunOut
from app.services.audit import audit

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/archive-run", response_model=Envelope[ArchiveRunOut])
async def archive_run(
    body: ArchiveRunIn | None = None,
    principal: Principal = Depends(require_lead),
    session: AsyncSession = Depends(get_session),
) -> Envelope[ArchiveRunOut]:
    days = (
        body.older_than_days
        if body and body.older_than_days is not None
        else get_settings().archive_after_days
    )
    now = utcnow()
    moved = await run_archive(session, now, days)
    audit(session, principal, "admin.archive_run", "archive", None, {"moved": moved, "days": days})
    await session.commit()
    return Envelope(
        data=ArchiveRunOut(archived=moved, cutoff=now - timedelta(days=days), policy=POLICY)
    )


CHAOS_LINES = [
    "Palm Crescent Resort says it is overbooked and walked our guest",
    "Guest arrived at Palm Crescent Resort, no room available, hotel overbooked",
    "Overbooking at Palm Crescent Resort: guest stranded in the lobby",
    "Palm Crescent Resort refusing check-in due to overbooking",
    "Another guest walked from Palm Crescent Resort tonight, overbooked again",
]


@router.post("/chaos", response_model=Envelope[dict[str, int]])
async def chaos(
    count: int = 40,
    principal: Principal = Depends(require_lead),
    session: AsyncSession = Depends(get_session),
) -> Envelope[dict[str, int]]:
    """Chaos Mode: inject a burst of overbooking flights from many agencies to show live routing."""
    import random

    from sqlalchemy import select

    from app.core.rbac import Principal as P
    from app.db.models import User
    from app.schemas.tickets import TicketCreateIn
    from app.services.tickets import create_ticket

    pilots = (
        await session.scalars(
            select(User).where(User.role == "requester", User.callsign.is_not(None))
        )
    ).all()
    rng = random.Random()
    created = 0
    for i in range(max(1, min(count, 60))):
        u = rng.choice(pilots)
        actor = P(u.id, u.name, u.role, u.agency_id, u.region, principal.data_mode)
        line = rng.choice(CHAOS_LINES)
        await create_ticket(
            session,
            TicketCreateIn(
                title=line,
                description=f"Chaos #{i + 1}: {line}. Supplier not answering.",
                priority=rng.choice(["P1", "P2", "P2", "P3"]),
            ),
            actor,
        )
        created += 1
    audit(session, principal, "admin.chaos", "ticket", None, {"created": created})
    await session.commit()
    return Envelope(data={"created": created})
