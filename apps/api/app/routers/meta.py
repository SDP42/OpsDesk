"""Supporting reads: bookings (TBOH lookup), agencies, controllers, overview, routing preset."""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import not_found
from app.core.rbac import Principal, require_any, require_lead, require_staff
from app.db.base import utcnow
from app.db.models import Agency, Booking, Intent, Ticket, User
from app.db.session import get_session
from app.engines.lifecycle import OPEN_STATUSES
from app.engines.vectoring import Controller, is_on_shift
from app.schemas.auth import AgencyBrief
from app.schemas.common import Envelope
from app.schemas.misc import (
    BookingOut,
    ControllerOut,
    IntentShare,
    OverviewOut,
    PresetIn,
    TrendOut,
    TrendPoint,
)
from app.services import routing as routing_service
from app.services.audit import audit
from app.services.serializers import agency_brief

router = APIRouter(tags=["meta"])


@router.get("/bookings/{tboh}", response_model=Envelope[BookingOut])
async def booking(
    tboh: str,
    principal: Principal = Depends(require_any),
    session: AsyncSession = Depends(get_session),
) -> Envelope[BookingOut]:
    """Validate a TBOH and list earlier cases on it (Pilot create flow)."""
    b = await session.scalar(select(Booking).where(Booking.tboh == tboh.upper()))
    if b is None or (principal.is_requester and b.agency_id != principal.agency_id):
        raise not_found("Booking")
    earlier = (
        await session.scalars(
            select(Ticket).where(Ticket.tboh == b.tboh).order_by(Ticket.created_at.desc()).limit(10)
        )
    ).all()
    return Envelope(
        data=BookingOut(
            tboh=b.tboh,
            hotel_name=b.hotel_name,
            destination=b.destination,
            guest_name=b.guest_name,
            check_in=b.check_in,
            lcd=b.lcd,
            supplier_name=b.supplier.name,
            supplier_status=b.supplier_status,
            earlier_cases=[
                {
                    "id": t.id,
                    "number": t.number,
                    "title": t.title,
                    "status": t.status,
                    "created_at": t.created_at.isoformat(),
                }
                for t in earlier
            ],
        )
    )


@router.get("/agencies", response_model=Envelope[list[AgencyBrief]])
async def agencies(
    _: Principal = Depends(require_staff), session: AsyncSession = Depends(get_session)
) -> Envelope[list[AgencyBrief]]:
    rows = (await session.scalars(select(Agency).order_by(Agency.region, Agency.name))).all()
    return Envelope(data=[agency_brief(a) for a in rows])


@router.get("/controllers", response_model=Envelope[list[ControllerOut]])
async def controllers(
    _: Principal = Depends(require_staff), session: AsyncSession = Depends(get_session)
) -> Envelope[list[ControllerOut]]:
    users = (
        await session.scalars(
            select(User)
            .where(User.role.in_(["agent", "escalation_manager", "lead"]), User.is_active.is_(True))
            .order_by(User.role, User.region, User.name)
        )
    ).all()
    counts = await routing_service.open_counts(session)
    now = utcnow()
    out = []
    for u in users:
        on_shift = is_on_shift(
            Controller(
                id=u.id,
                name=u.name,
                region=u.region or "IN",
                shift_start=u.shift_start,
                shift_end=u.shift_end,
            ),
            now,
        )
        out.append(
            ControllerOut(
                id=u.id,
                name=u.name,
                callsign=u.callsign,
                role=u.role,
                region=u.region,
                availability=u.availability,
                rank=u.rank,
                capacity=u.capacity,
                open_tickets=counts.get(u.id, 0),
                on_shift=on_shift,
                shift=f"{u.shift_start}-{u.shift_end}" if u.shift_start else None,
            )
        )
    return Envelope(data=out)


@router.get("/stats/overview", response_model=Envelope[OverviewOut])
async def overview(
    principal: Principal = Depends(require_staff), session: AsyncSession = Depends(get_session)
) -> Envelope[OverviewOut]:
    mode = Ticket.is_demo.is_(principal.data_mode == "demo")
    open_filter = and_(Ticket.status.in_(OPEN_STATUSES), mode)

    async def grouped(col) -> dict[str, int]:  # type: ignore[no-untyped-def]
        rows = await session.execute(select(col, func.count()).where(open_filter).group_by(col))
        return {str(k): int(v) for k, v in rows.all()}

    by_status_rows = await session.execute(
        select(Ticket.status, func.count()).where(mode).group_by(Ticket.status)
    )
    unassigned = await session.scalar(
        select(func.count()).select_from(Ticket).where(open_filter, Ticket.owner_id.is_(None))
    )
    by_sla = await grouped(Ticket.sla_state)
    by_region = await grouped(Ticket.region)
    by_status = {k: int(v) for k, v in by_status_rows.all()}
    return Envelope(
        data=OverviewOut(
            open=sum(by_region.values()),
            unassigned=int(unassigned or 0),
            escalated=by_status.get("escalated", 0),
            by_sla=by_sla,
            by_region=by_region,
            by_status=by_status,
            preset=routing_service.get_preset(),
        )
    )


@router.get("/routing/preset", response_model=Envelope[PresetIn])
async def get_preset(_: Principal = Depends(require_staff)) -> Envelope[PresetIn]:
    return Envelope(data=PresetIn(preset=routing_service.get_preset()))


@router.put("/routing/preset", response_model=Envelope[PresetIn])
async def put_preset(
    body: PresetIn,
    principal: Principal = Depends(require_lead),
    session: AsyncSession = Depends(get_session),
) -> Envelope[PresetIn]:
    routing_service.set_preset(body.preset)
    audit(session, principal, "routing.preset", "routing", None, {"preset": body.preset})
    await session.commit()
    return Envelope(data=body)


@router.get("/stats/trend", response_model=Envelope[TrendOut])
async def trend(
    days: int = 14,
    principal: Principal = Depends(require_staff),
    session: AsyncSession = Depends(get_session),
) -> Envelope[TrendOut]:
    """Daily created/resolved/breached counts, intent mix and the most turbulent agencies."""
    days = max(3, min(days, 60))
    now = utcnow()
    since = now - timedelta(days=days)
    mode = Ticket.is_demo.is_(principal.data_mode == "demo")
    rows = (
        await session.execute(
            select(Ticket.created_at, Ticket.resolved_at, Ticket.sla_state, Intent.code)
            .outerjoin(Intent, Intent.id == Ticket.intent_id)
            .where(mode, Ticket.created_at >= since)
        )
    ).all()
    buckets: dict[str, dict[str, int]] = {}
    for i in range(days + 1):
        key = (since + timedelta(days=i)).date().isoformat()
        buckets[key] = {"created": 0, "resolved": 0, "breached": 0}
    intents: dict[str, int] = {}
    for created, resolved, sla, code in rows:
        c = created.date().isoformat()
        if c in buckets:
            buckets[c]["created"] += 1
            if sla == "breached":
                buckets[c]["breached"] += 1
        if resolved is not None and resolved.date().isoformat() in buckets:
            buckets[resolved.date().isoformat()]["resolved"] += 1
        parent = (code or "unclassified").split(".")[0]
        intents[parent] = intents.get(parent, 0) + 1
    agencies = (
        await session.scalars(select(Agency).order_by(Agency.turbulence_score.desc()).limit(5))
    ).all()
    return Envelope(
        data=TrendOut(
            days=[TrendPoint(day=k, **v) for k, v in buckets.items()],
            intents=[
                IntentShare(parent=k, count=v)
                for k, v in sorted(intents.items(), key=lambda kv: -kv[1])
            ],
            agencies_at_risk=[
                {
                    "id": a.id,
                    "name": a.name,
                    "city": a.city,
                    "region": a.region,
                    "turbulence": round(a.turbulence_score, 1),
                }
                for a in agencies
            ],
        )
    )
