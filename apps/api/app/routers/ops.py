"""Proactive operations: Crew Roster, Ghost Flights, Storm Cells, Breach Forecast,
flight signals (frustration and promises) and the Supplier Scorecard."""

from __future__ import annotations

import statistics
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import ROUTING_PRESETS
from app.core.errors import bad_request, not_found
from app.core.rbac import Principal, ensure_visible, require_lead, require_staff
from app.core.sse import broker
from app.db.base import utcnow
from app.db.models import (
    Booking,
    Comment,
    Frequency,
    FrequencyMessage,
    FrequencyRecipient,
    HrRecord,
    Incident,
    Supplier,
    Theme,
    Ticket,
    TicketTheme,
    User,
)
from app.db.session import get_session
from app.engines import roster as roster_engine
from app.engines.forecast import ForecastInput, ForecastResult, forecast_breach
from app.engines.frustration import FrustrationResult, score_frustration
from app.engines.ghosts import GhostInput, GhostPrediction, score_booking
from app.engines.lifecycle import OPEN_STATUSES
from app.engines.nlq import ParsedQuery, parse_query
from app.engines.promises import extract_promises
from app.engines.simulator import SimFlight, SimulationResult, compare
from app.engines.storms import StormCell, StormTicket, detect_storms
from app.schemas.common import Envelope, StrictModel
from app.services import routing as routing_service
from app.services import tickets as svc
from app.services.audit import audit, timeline

router = APIRouter(tags=["ops"])


# --------------------------------------------------------------------------- Crew Roster


class RosterOut(BaseModel):
    crew: list[roster_engine.CrewStatus]
    orphans: list[roster_engine.OrphanRisk]
    upcoming: list[dict[str, str]]
    synced_at: datetime
    source: str


class LeaveIn(StrictModel):
    user_id: str = Field(max_length=32)
    kind: str = Field(pattern="^(leave|weekly_off|shift_change)$")
    start: date
    end: date
    note: str = Field(default="", max_length=200)
    shift_start: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    shift_end: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")


async def crew_statuses(
    session: AsyncSession, today: date
) -> tuple[list[roster_engine.CrewStatus], list[HrRecord]]:
    users = (
        await session.scalars(
            select(User).where(
                User.role.in_(["agent", "escalation_manager"]), User.is_active.is_(True)
            )
        )
    ).all()
    records = (await session.scalars(select(HrRecord))).all()
    hr = [
        roster_engine.HrRecord(
            employee_id=r.user_id,
            kind=r.kind,
            start=r.start.date(),
            end=r.end.date(),
            note=r.note,
            shift_start=r.shift_start,
            shift_end=r.shift_end,
        )
        for r in records
    ]
    statuses = [
        roster_engine.effective_status(
            roster_engine.CrewMember(
                id=u.id,
                name=u.name,
                presence=u.availability,
                shift_start=u.shift_start,
                shift_end=u.shift_end,
            ),
            hr,
            today,
        )
        for u in users
    ]
    return statuses, list(records)


@router.get("/roster", response_model=Envelope[RosterOut])
async def roster(
    _: Principal = Depends(require_staff), session: AsyncSession = Depends(get_session)
) -> Envelope[RosterOut]:
    """HRMS-aware crew board: who is really available today, and which flights are orphaned."""
    now = utcnow()
    statuses, records = await crew_statuses(session, now.date())
    open_t = (
        (
            await session.scalars(
                select(Ticket).where(Ticket.status.in_(OPEN_STATUSES), Ticket.owner_id.is_not(None))
            )
        )
        .unique()
        .all()
    )
    orphans = roster_engine.orphan_risks(
        [
            roster_engine.OpenFlight(
                id=t.id, number=t.number, owner_id=t.owner_id, due_at=t.sla_due_at
            )
            for t in open_t
        ],
        statuses,
    )
    names = {s.id: s.name for s in statuses}
    upcoming = [
        {
            "user": names.get(r.user_id, r.user_id),
            "kind": r.kind,
            "start": r.start.date().isoformat(),
            "end": r.end.date().isoformat(),
            "note": r.note,
        }
        for r in sorted(records, key=lambda r: r.start)
        if r.end.date() >= now.date()
    ][:12]
    return Envelope(
        data=RosterOut(
            crew=statuses,
            orphans=orphans,
            upcoming=upcoming,
            synced_at=now,
            source="Darwinbox HRMS (simulated feed)",
        )
    )


@router.post("/roster/records", response_model=Envelope[RosterOut], status_code=201)
async def add_record(
    body: LeaveIn,
    principal: Principal = Depends(require_lead),
    session: AsyncSession = Depends(get_session),
) -> Envelope[RosterOut]:
    """Accept an HRMS record (the shape a Darwinbox leave/shift webhook would deliver)."""
    if body.end < body.start:
        raise bad_request("bad_range", "End date is before start date")
    if await session.get(User, body.user_id) is None:
        raise not_found("Controller")
    session.add(
        HrRecord(
            user_id=body.user_id,
            kind=body.kind,
            start=datetime.combine(body.start, datetime.min.time()),
            end=datetime.combine(body.end, datetime.min.time()),
            note=body.note,
            shift_start=body.shift_start,
            shift_end=body.shift_end,
            source="manual",
        )
    )
    audit(session, principal, "roster.record", "user", body.user_id, body.model_dump(mode="json"))
    await session.commit()
    return await roster(principal, session)


@router.post("/roster/rebalance", response_model=Envelope[dict[str, int]])
async def rebalance(
    principal: Principal = Depends(require_staff), session: AsyncSession = Depends(get_session)
) -> Envelope[dict[str, int]]:
    """Re-vector every orphaned flight to an available controller, with reasons on the timeline."""
    now = utcnow()
    statuses, _ = await crew_statuses(session, now.date())
    away = {s.id for s in statuses if s.on_leave}
    moved = 0
    if away:
        rows = (
            (
                await session.scalars(
                    select(Ticket).where(
                        Ticket.status.in_(OPEN_STATUSES), Ticket.owner_id.in_(away)
                    )
                )
            )
            .unique()
            .all()
        )
        for t in rows:
            prev = t.owner_id
            result, _ = await routing_service.vector_ticket(session, t, now)
            timeline(
                session,
                t.id,
                "roster_rebalanced",
                principal,
                {
                    "from": prev,
                    "to": result.chosen_id,
                    "reason": f"Owner on leave per HRMS; {result.reason}",
                },
            )
            moved += 1
        audit(session, principal, "roster.rebalance", "ticket", None, {"moved": moved})
        await session.commit()
        broker.publish("ticket.updated", {"change": "roster_rebalance", "moved": moved})
    return Envelope(data={"moved": moved})


# --------------------------------------------------------------------------- Ghost Flights


class GhostOut(GhostPrediction):
    hotel: str
    agency: str
    check_in: datetime
    supplier: str


class PreemptIn(StrictModel):
    message: str = Field(min_length=5, max_length=1000)


@router.get("/ghosts", response_model=Envelope[list[GhostOut]])
async def ghosts(
    _: Principal = Depends(require_staff), session: AsyncSession = Depends(get_session)
) -> Envelope[list[GhostOut]]:
    """Bookings likely to become tickets in the next week, before the agency writes in."""
    now = utcnow()
    bookings = (
        (
            await session.scalars(
                select(Booking).where(
                    Booking.check_in > now,
                    Booking.check_in < now + timedelta(days=7),
                    Booking.preempted_at.is_(None),
                )
            )
        )
        .unique()
        .all()
    )
    open_tboh = set(
        (
            await session.scalars(
                select(Ticket.tboh).where(
                    Ticket.status.in_(OPEN_STATUSES), Ticket.tboh.is_not(None)
                )
            )
        ).all()
    )
    counts = dict(
        (
            await session.execute(
                select(Ticket.tboh, func.count())
                .where(Ticket.tboh.is_not(None))
                .group_by(Ticket.tboh)
            )
        ).all()
    )
    out: list[GhostOut] = []
    for b in bookings:
        if b.tboh in open_tboh:
            continue
        p = score_booking(
            GhostInput(
                tboh=b.tboh,
                supplier_status=b.supplier_status,
                hours_to_check_in=(b.check_in - now).total_seconds() / 3600,
                rate_changed=b.amount > 3500,
                agency_repeat_contacts=min(int(b.agency.turbulence_score // 15), 6),
                supplier_median_reply_minutes=60.0,
                earlier_cases=int(counts.get(b.tboh, 0)),
            )
        )
        if p.risk >= 0.3:
            out.append(
                GhostOut(
                    **p.model_dump(),
                    hotel=b.hotel_name,
                    agency=b.agency.name,
                    check_in=b.check_in,
                    supplier=b.supplier.name,
                )
            )
    out.sort(key=lambda g: -g.risk)
    return Envelope(data=out[:25])


@router.post("/ghosts/{tboh}/preempt", response_model=Envelope[dict[str, str]])
async def preempt(
    tboh: str,
    body: PreemptIn,
    principal: Principal = Depends(require_staff),
    session: AsyncSession = Depends(get_session),
) -> Envelope[dict[str, str]]:
    """Send the pre-emptive message to the agency; the ghost dissolves from the radar."""
    b = await session.scalar(select(Booking).where(Booking.tboh == tboh.upper()))
    if b is None:
        raise not_found("Booking")
    b.preempted_at = utcnow()
    b.preempt_message = body.message
    audit(session, principal, "ghost.preempt", "booking", b.id, {"tboh": b.tboh})
    await session.commit()
    broker.publish("ghost", {"tboh": b.tboh, "agency": b.agency.name, "by": principal.name})
    return Envelope(data={"tboh": b.tboh, "status": "dissolved", "sent_to": b.agency.name})


# --------------------------------------------------------------------------- Storm Cells


class StormOut(StormCell):
    tickets: list[dict[str, str]]
    broadcast_at: datetime | None = None


class BroadcastIn(StrictModel):
    key: str = Field(max_length=160)
    message: str = Field(min_length=10, max_length=3000)


async def _storm_cells(
    session: AsyncSession, principal: Principal
) -> tuple[list[StormCell], dict[str, Ticket]]:
    since = utcnow() - timedelta(hours=12)
    rows = (
        (
            await session.scalars(
                select(Ticket).where(
                    Ticket.created_at >= since,
                    Ticket.status.in_(OPEN_STATUSES),
                    Ticket.is_demo.is_(principal.data_mode == "demo"),
                )
            )
        )
        .unique()
        .all()
    )
    hotels = [h for (h,) in (await session.execute(select(Booking.hotel_name).distinct())).all()]
    themes = (
        dict(
            (
                await session.execute(
                    select(TicketTheme.ticket_id, Theme.code)
                    .join(Theme, Theme.id == TicketTheme.theme_id)
                    .where(TicketTheme.ticket_id.in_([r.id for r in rows]))
                )
            ).all()
        )
        if rows
        else {}
    )
    bookings = {
        b.tboh: b
        for b in (
            await session.scalars(
                select(Booking).where(Booking.tboh.in_([r.tboh for r in rows if r.tboh]))
            )
        )
        .unique()
        .all()
    }
    items = []
    for t in rows:
        text = f"{t.title} {t.description}".lower()
        keys = [f"hotel:{h}" for h in hotels if h.lower() in text]
        if t.tboh and t.tboh in bookings:
            keys += [
                f"hotel:{bookings[t.tboh].hotel_name}",
                f"supplier:{bookings[t.tboh].supplier.name}",
            ]
        if t.id in themes:
            keys.append(f"theme:{themes[t.id]}")
        items.append(
            StormTicket(id=t.id, created_at_epoch=t.created_at.timestamp(), keys=sorted(set(keys)))
        )
    return detect_storms(items, window_minutes=60, threshold=5), {t.id: t for t in rows}


@router.get("/storms", response_model=Envelope[list[StormOut]])
async def storms(
    principal: Principal = Depends(require_staff), session: AsyncSession = Depends(get_session)
) -> Envelope[list[StormOut]]:
    cells, by_id = await _storm_cells(session, principal)
    incidents = {
        i.key: i
        for i in (await session.scalars(select(Incident).order_by(Incident.created_at))).all()
    }
    out = []
    for c in cells:
        ts = [by_id[i] for i in c.ticket_ids if i in by_id]
        c.agencies = len({t.agency_id for t in ts})
        out.append(
            StormOut(
                **c.model_dump(),
                broadcast_at=incidents[c.key].broadcast_at if c.key in incidents else None,
                tickets=[
                    {"id": t.id, "number": t.number, "title": t.title, "agency": t.agency.name}
                    for t in ts[:50]
                ],
            )
        )
    return Envelope(data=out)


@router.post("/storms/broadcast", response_model=Envelope[dict[str, int]])
async def broadcast(
    body: BroadcastIn,
    principal: Principal = Depends(require_staff),
    session: AsyncSession = Depends(get_session),
) -> Envelope[dict[str, int]]:
    """One approved reply to every agency in the Storm Cell, recorded as a parent incident."""
    cells, by_id = await _storm_cells(session, principal)
    cell = next((c for c in cells if c.key == body.key), None)
    if cell is None:
        raise not_found("Storm cell")
    now = utcnow()
    session.add(
        Incident(
            key=cell.key,
            title=cell.label,
            ticket_ids=cell.ticket_ids,
            broadcast=body.message,
            broadcast_at=now,
        )
    )
    for tid in cell.ticket_ids:
        session.add(
            Comment(
                ticket_id=tid,
                visibility="external",
                body=body.message,
                author_id=principal.id,
                created_at=now,
            )
        )
        timeline(
            session,
            tid,
            "storm_broadcast",
            principal,
            {"incident": cell.label, "preview": body.message[:120]},
        )
    audit(
        session,
        principal,
        "storm.broadcast",
        "incident",
        None,
        {"key": cell.key, "tickets": len(cell.ticket_ids)},
    )
    await session.commit()
    broker.publish(
        "storm", {"label": cell.label, "count": len(cell.ticket_ids), "by": principal.name}
    )
    return Envelope(
        data={
            "replied": len(cell.ticket_ids),
            "agencies": len({by_id[i].agency_id for i in cell.ticket_ids if i in by_id}),
        }
    )


# --------------------------------------------------------------------------- Forecast and signals


@router.get("/tickets/{ticket_id}/forecast", response_model=Envelope[ForecastResult])
async def forecast(
    ticket_id: str,
    principal: Principal = Depends(require_staff),
    session: AsyncSession = Depends(get_session),
) -> Envelope[ForecastResult]:
    t = ensure_visible(await svc.load_ticket(session, ticket_id), principal)
    rows = (
        await session.execute(
            select(Ticket.created_at, Ticket.resolved_at)
            .where(Ticket.intent_id == t.intent_id, Ticket.resolved_at.is_not(None))
            .limit(400)
        )
    ).all()
    history = [(r - c).total_seconds() / 60 for c, r in rows if r and r > c]
    now = utcnow()
    due = t.sla_due_at or now
    return Envelope(
        data=forecast_breach(
            ForecastInput(
                minutes_remaining=max((due - now).total_seconds() / 60, 1.0),
                history_minutes=history,
                elapsed_minutes=(now - t.created_at).total_seconds() / 60,
            )
        )
    )


class PromiseOut(BaseModel):
    text: str
    due_at: datetime | None
    overdue: bool
    source: str
    reason: str


class SignalsOut(BaseModel):
    frustration: FrustrationResult
    promises: list[PromiseOut]


@router.get("/tickets/{ticket_id}/signals", response_model=Envelope[SignalsOut])
async def signals(
    ticket_id: str,
    principal: Principal = Depends(require_staff),
    session: AsyncSession = Depends(get_session),
) -> Envelope[SignalsOut]:
    """Frustration Radar on the agency's words and Promise Tracker on what we committed to."""
    t = ensure_visible(await svc.load_ticket(session, ticket_id), principal)
    comments = (
        (
            await session.scalars(
                select(Comment).where(Comment.ticket_id == t.id).order_by(Comment.created_at)
            )
        )
        .unique()
        .all()
    )
    agency_text = " ".join(
        [t.title, t.description]
        + [c.body for c in comments if c.author and c.author.role == "requester"]
    )
    now = utcnow()
    promises: list[PromiseOut] = []
    for c in comments:
        if c.author and c.author.role != "requester":
            for p in extract_promises(c.body, c.created_at.timestamp()):
                due = datetime.fromtimestamp(p.due_epoch, now.tzinfo) if p.due_epoch else None
                promises.append(
                    PromiseOut(
                        text=p.text,
                        due_at=due,
                        overdue=bool(due and due < now and t.status in OPEN_STATUSES),
                        source=f"{c.visibility} reply",
                        reason=p.reason,
                    )
                )
    fq = (
        await session.scalars(
            select(FrequencyMessage)
            .join(Frequency, Frequency.id == FrequencyMessage.frequency_id)
            .where(Frequency.ticket_id == t.id)
        )
    ).all()
    for m in fq:
        for p in extract_promises(m.body, m.at.timestamp()):
            due = datetime.fromtimestamp(p.due_epoch, now.tzinfo) if p.due_epoch else None
            promises.append(
                PromiseOut(
                    text=p.text,
                    due_at=due,
                    overdue=bool(due and due < now and t.status in OPEN_STATUSES),
                    source=f"{m.sender_name} (Frequency)",
                    reason=p.reason,
                )
            )
    return Envelope(data=SignalsOut(frustration=score_frustration(agency_text), promises=promises))


# --------------------------------------------------------------------------- Supplier Scorecard


class SupplierScore(BaseModel):
    id: str
    name: str
    region: str
    channels: int
    awaiting_reply: int
    median_reply_minutes: float | None
    unconfirmed_bookings: int
    tickets_30d: int
    reliability: float
    best_contact: str
    reason: str


@router.get("/suppliers/scorecard", response_model=Envelope[list[SupplierScore]])
async def scorecard(
    _: Principal = Depends(require_staff), session: AsyncSession = Depends(get_session)
) -> Envelope[list[SupplierScore]]:
    """Supplier reliability from Frequencies, confirmations and ticket volume, with best contact."""
    now = utcnow()
    out: list[SupplierScore] = []
    for s in (await session.scalars(select(Supplier).order_by(Supplier.name))).all():
        freq_ids = list(
            (
                await session.scalars(
                    select(FrequencyRecipient.frequency_id).where(
                        FrequencyRecipient.party_type == "supplier",
                        FrequencyRecipient.party_id == s.id,
                    )
                )
            ).all()
        )
        gaps: list[float] = []
        awaiting = 0
        for fid in freq_ids:
            msgs = (
                await session.scalars(
                    select(FrequencyMessage)
                    .where(FrequencyMessage.frequency_id == fid)
                    .order_by(FrequencyMessage.at)
                )
            ).all()
            pending = None
            for m in msgs:
                if m.sender_type == "internal":
                    pending = pending or m.at
                elif m.sender_type == "supplier" and pending:
                    gaps.append((m.at - pending).total_seconds() / 60)
                    pending = None
            awaiting += 1 if msgs and msgs[-1].sender_type == "internal" else 0
        unconfirmed = (
            await session.scalar(
                select(func.count())
                .select_from(Booking)
                .where(
                    Booking.supplier_id == s.id,
                    Booking.supplier_status != "confirmed",
                    Booking.check_in > now,
                )
            )
            or 0
        )
        tickets = (
            await session.scalar(
                select(func.count())
                .select_from(Ticket)
                .join(Booking, Booking.id == Ticket.booking_id)
                .where(Booking.supplier_id == s.id, Ticket.created_at >= now - timedelta(days=30))
            )
            or 0
        )
        median = round(statistics.median(gaps), 1) if gaps else None
        score = (
            100.0
            - min(30.0, (median or 90) / 8)
            - min(24.0, 8 * awaiting)
            - min(20.0, 2 * unconfirmed)
            - min(20.0, tickets / 12)
        )
        score = round(max(0.0, min(100.0, score)), 1)
        out.append(
            SupplierScore(
                id=s.id,
                name=s.name,
                region=s.region,
                channels=len(freq_ids),
                awaiting_reply=awaiting,
                median_reply_minutes=median,
                unconfirmed_bookings=int(unconfirmed),
                tickets_30d=int(tickets),
                reliability=score,
                best_contact=s.email,
                reason=f"median reply {median if median is not None else 'n/a'} min, {awaiting} awaiting, "
                f"{unconfirmed} unconfirmed upcoming bookings, {tickets} tickets in 30 days",
            )
        )
    out.sort(key=lambda x: x.reliability)
    return Envelope(data=out)


# --------------------------------------------------------------------------- Routing simulator


class SimulateIn(StrictModel):
    hours: int = Field(default=24, ge=1, le=168)
    presets: list[str] = Field(
        default_factory=lambda: ["balanced", "urgency_first", "regional_affinity", "fairness"],
        max_length=4,
    )


@router.post("/routing/simulate", response_model=Envelope[SimulationResult])
async def simulate_routing(
    body: SimulateIn,
    principal: Principal = Depends(require_lead),
    session: AsyncSession = Depends(get_session),
) -> Envelope[SimulationResult]:
    """Replay the last N hours of flights under each preset and compare breaches, waits and load."""
    unknown = [p for p in body.presets if p not in ROUTING_PRESETS]
    if unknown:
        raise bad_request("unknown_preset", f"Unknown presets: {', '.join(unknown)}")
    since = utcnow() - timedelta(hours=body.hours)
    rows = (
        (
            await session.scalars(
                select(Ticket).where(
                    Ticket.created_at >= since, Ticket.is_demo.is_(principal.data_mode == "demo")
                )
            )
        )
        .unique()
        .all()
    )
    flights = [
        SimFlight(
            id=t.id,
            region=t.region,
            priority=t.priority,
            intent_code=t.intent.code if t.intent else None,
            agency_tier=t.agency.tier,
            created_at=t.created_at,
            check_in=t.check_in,
            lcd=t.lcd,
        )
        for t in rows
    ]
    controllers = await routing_service.load_controllers(session)
    result = compare(flights, controllers, body.presets)
    audit(
        session,
        principal,
        "routing.simulate",
        "routing",
        None,
        {"hours": body.hours, "flights": len(flights)},
    )
    await session.commit()
    return Envelope(data=result)


# --------------------------------------------------------------------------- Ask the Tower


@router.get("/nlq", response_model=Envelope[ParsedQuery])
async def ask_the_tower(
    q: str = Query(min_length=1, max_length=200), _: Principal = Depends(require_staff)
) -> Envelope[ParsedQuery]:
    """Plain English → explainable filter chips for the command palette."""
    return Envelope(data=parse_query(q))
