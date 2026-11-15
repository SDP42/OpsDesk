"""Ticket use-cases: create, status changes, ownership, escalation, links, handoff.

Routers stay thin; engines decide; this module only loads rows, calls engines,
persists results and writes a timeline event + audit row for every mutation.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import GUARDIAN_WINDOW_DAYS, LINK_AGENCY_INTENT_DAYS
from app.core.errors import AppError, bad_request, conflict, not_found
from app.core.rbac import Principal
from app.core.sse import broker
from app.db.base import utcnow
from app.db.models import (
    Agency,
    Booking,
    Frequency,
    FrequencyRecipient,
    Intent,
    Queue,
    RoutingDecision,
    Theme,
    Ticket,
    TicketLink,
    TicketTheme,
    TimelineEvent,
    User,
)
from app.engines import lifecycle, linker, weather
from app.engines.wheels_up import SlaInput, compute_sla
from app.schemas.tickets import (
    GuardianOut,
    HandoffDiffOut,
    HandoffRecipient,
    LinkOut,
    RoutingDecisionOut,
    TicketCreateIn,
    TimelineEventOut,
)
from app.services import embeddings
from app.services import intents as intent_service
from app.services import routing as routing_service
from app.services.audit import audit, timeline
from app.services.serializers import user_brief


async def load_ticket(session: AsyncSession, ticket_id: str) -> Ticket | None:
    stmt = select(Ticket).where(or_(Ticket.id == ticket_id, Ticket.number == ticket_id.upper()))
    return await session.scalar(stmt.execution_options(populate_existing=True))


async def next_number(session: AsyncSession) -> tuple[int, str]:
    current = await session.scalar(select(func.max(Ticket.seq)))
    seq = (current or 24000) + 1
    return seq, f"OD-{seq}"


async def intent_by_code(session: AsyncSession, code: str | None) -> Intent | None:
    if not code:
        return None
    return await session.scalar(select(Intent).where(Intent.code == code))


def apply_sla(ticket: Ticket, now: datetime) -> str:
    """Recompute and store SLA fields; returns the new state."""
    resolved = ticket.resolved_at if ticket.status in {"resolved", "closed"} else None
    result = compute_sla(
        SlaInput(
            created_at=ticket.created_at,
            now=now,
            priority=ticket.priority,
            check_in=ticket.check_in,
            lcd=ticket.lcd,
            resolved_at=resolved,
        )
    )
    ticket.sla_due_at = result.due_at
    ticket.sla_state = result.state
    ticket.sla_elapsed_pct = result.elapsed_pct
    return result.state


async def link_counts(session: AsyncSession, ids: list[str]) -> dict[str, int]:
    if not ids:
        return {}
    counts: dict[str, int] = {}
    for col in (TicketLink.ticket_a, TicketLink.ticket_b):
        rows = await session.execute(select(col, func.count()).where(col.in_(ids)).group_by(col))
        for tid, n in rows.all():
            counts[tid] = counts.get(tid, 0) + n
    return counts


async def get_links(session: AsyncSession, ticket_id: str) -> list[LinkOut]:
    rows = (
        await session.scalars(
            select(TicketLink).where(
                or_(TicketLink.ticket_a == ticket_id, TicketLink.ticket_b == ticket_id)
            )
        )
    ).all()
    other_ids = [r.ticket_b if r.ticket_a == ticket_id else r.ticket_a for r in rows]
    others = (
        {
            t.id: t
            for t in (await session.scalars(select(Ticket).where(Ticket.id.in_(other_ids)))).all()
        }
        if other_ids
        else {}
    )
    out: list[LinkOut] = []
    for r, oid in zip(rows, other_ids, strict=True):
        o = others.get(oid)
        if o is None:
            continue
        out.append(
            LinkOut(
                id=r.id,
                link_type=r.link_type,
                strength=r.strength,
                reason=r.reason,
                other_id=o.id,
                other_number=o.number,
                other_title=o.title,
                other_status=o.status,
                other_created_at=o.created_at,
            )
        )
    out.sort(key=lambda link: (-link.strength, link.other_created_at))
    return out


def _pair(a: str, b: str) -> tuple[str, str]:
    return (a, b) if a < b else (b, a)


async def add_link(
    session: AsyncSession,
    a: str,
    b: str,
    link_type: str,
    strength: float,
    reason: str,
    created_by: str | None = None,
) -> bool:
    x, y = _pair(a, b)
    exists = await session.scalar(
        select(TicketLink.id).where(TicketLink.ticket_a == x, TicketLink.ticket_b == y)
    )
    if exists:
        return False
    session.add(
        TicketLink(
            ticket_a=x,
            ticket_b=y,
            link_type=link_type,
            strength=strength,
            reason=reason,
            created_by=created_by,
        )
    )
    return True


async def get_timeline(session: AsyncSession, ticket_id: str) -> list[TimelineEventOut]:
    events = (
        await session.scalars(
            select(TimelineEvent)
            .where(TimelineEvent.ticket_id == ticket_id)
            .order_by(TimelineEvent.at, TimelineEvent.id)
        )
    ).all()
    actor_ids = {e.actor_id for e in events if e.actor_id}
    actors = (
        {u.id: u for u in (await session.scalars(select(User).where(User.id.in_(actor_ids)))).all()}
        if actor_ids
        else {}
    )
    return [
        TimelineEventOut(
            id=e.id,
            type=e.type,
            actor=user_brief(actors.get(e.actor_id or "")),
            payload=e.payload or {},
            at=e.at,
        )
        for e in events
    ]


async def latest_routing(session: AsyncSession, ticket_id: str) -> RoutingDecisionOut | None:
    d = await session.scalar(
        select(RoutingDecision)
        .where(RoutingDecision.ticket_id == ticket_id)
        .order_by(RoutingDecision.created_at.desc())
        .limit(1)
    )
    if d is None:
        return None
    chosen = await session.get(User, d.chosen_user_id) if d.chosen_user_id else None
    return RoutingDecisionOut(
        id=d.id,
        chosen=user_brief(chosen),
        preset=d.preset,
        reason=d.reason,
        scores=d.scores,
        created_at=d.created_at,
    )


async def _history_for_linking(
    session: AsyncSession, agency_id: str, tboh: str | None, now: datetime
) -> list[Ticket]:
    since = now - timedelta(days=max(LINK_AGENCY_INTENT_DAYS, GUARDIAN_WINDOW_DAYS) * 3)
    cond = Ticket.agency_id == agency_id
    stmt = select(Ticket).where(or_(cond, Ticket.tboh == tboh) if tboh else cond)
    stmt = stmt.where(Ticket.created_at >= since).order_by(Ticket.created_at.desc()).limit(400)
    return list((await session.scalars(stmt)).all())


def _to_link_ticket(t: Ticket) -> linker.LinkTicket:
    return linker.LinkTicket(
        id=t.id,
        number=t.number,
        agency_id=t.agency_id,
        tboh=t.tboh,
        intent_code=t.intent.code if t.intent else None,
        title=t.title,
        description=t.description,
        created_at=t.created_at,
    )


async def tag_ticket_themes(session: AsyncSession, ticket: Ticket) -> list[str]:
    tags = weather.tag_themes(f"{ticket.title} {ticket.description}")
    if not tags:
        return []
    themes = {
        t.code: t
        for t in (
            await session.scalars(select(Theme).where(Theme.code.in_([tag.code for tag in tags])))
        ).all()
    }
    for tag in tags:
        if tag.code in themes:
            session.add(
                TicketTheme(
                    ticket_id=ticket.id,
                    theme_id=themes[tag.code].id,
                    score=tag.score,
                    source="auto",
                )
            )
    return [tag.code for tag in tags if tag.code in themes]


async def create_ticket(
    session: AsyncSession, data: TicketCreateIn, actor: Principal, ip: str | None = None
) -> tuple[Ticket, list[linker.LinkProposal], linker.GuardianResult, dict | None]:
    now = utcnow()
    # Agency: requesters always file for their own agency.
    if actor.is_requester:
        agency_id = actor.agency_id
    else:
        agency_id = data.agency_id
    agency = await session.get(Agency, agency_id) if agency_id else None
    if agency is None:
        raise bad_request("agency_required", "A valid agency is required for this flight")

    booking = None
    check_in, lcd = data.check_in, data.lcd
    if data.tboh:
        booking = await session.scalar(select(Booking).where(Booking.tboh == data.tboh))
        if booking is None or booking.agency_id != agency.id:
            raise bad_request("unknown_tboh", f"{data.tboh} is not a booking of {agency.name}")
        check_in = check_in or booking.check_in
        lcd = lcd or booking.lcd

    text = f"{data.title}. {data.description}"
    suggestion = intent_service.suggest(text)
    confidence: float | None
    if data.intent_code:
        intent = await intent_by_code(session, data.intent_code)
        if intent is None:
            raise bad_request("unknown_intent", f"Unknown intent {data.intent_code}")
        source, confidence = "manual", 1.0
    else:
        top = suggestion.top[0] if suggestion.top else None
        intent = await intent_by_code(session, top.code if top else None)
        source = "rule" if suggestion.rule else "auto"
        confidence = top.confidence if top else None

    seq, number = await next_number(session)
    ticket = Ticket(
        seq=seq,
        number=number,
        title=data.title,
        description=data.description,
        agency_id=agency.id,
        requester_id=actor.id if actor.is_requester else None,
        tboh=data.tboh,
        booking_id=booking.id if booking else None,
        intent_id=intent.id if intent else None,
        intent_confidence=confidence,
        intent_source=source,
        priority=data.priority,
        status="new",
        region=agency.region,
        check_in=check_in,
        lcd=lcd,
        created_at=now,
        updated_at=now,
        is_demo=actor.data_mode == "demo",
    )
    ticket.agency = agency
    ticket.intent = intent
    session.add(ticket)
    await session.flush()

    timeline(
        session,
        ticket.id,
        "created",
        actor,
        {
            "number": number,
            "priority": data.priority,
            "tboh": data.tboh,
            "channel": "pilot" if actor.is_requester else "tower",
        },
    )
    timeline(
        session,
        ticket.id,
        "intent_classified",
        None,
        {
            "code": intent.code if intent else None,
            "confidence": confidence,
            "source": source,
            "reason": suggestion.reason if source != "manual" else "Chosen by user",
            "top": [c.model_dump() for c in suggestion.top],
        },
    )

    # Linker + Third-Contact Guardian
    history = [
        h
        for h in await _history_for_linking(session, agency.id, data.tboh, now)
        if h.id != ticket.id
    ]
    history_lt = [_to_link_ticket(h) for h in history]
    new_lt = _to_link_ticket(ticket)
    vectors = None
    same_agency = [h for h in history_lt if h.agency_id == new_lt.agency_id][:300]
    cached = embeddings.embed_cached(
        [(t.id, f"{t.title}. {t.description}") for t in [new_lt, *same_agency]]
    )
    if cached is not None:
        vectors = {k: v.tolist() for k, v in cached.items()}
    link_result = linker.find_links(new_lt, history_lt, now, vectors)
    for prop in link_result.links:
        await add_link(
            session, ticket.id, prop.ticket_id, prop.link_type, prop.strength, prop.reason
        )
    if link_result.links:
        timeline(
            session,
            ticket.id,
            "linked",
            None,
            {
                "links": [p.model_dump() for p in link_result.links[:10]],
                "count": len(link_result.links),
            },
        )
    guardian = link_result.guardian
    ticket.contact_count = guardian.contact_count
    if guardian.triggered:
        old = ticket.priority
        ticket.priority = lifecycle.bump_priority(ticket.priority)
        ticket.guardian_flag = True
        timeline(
            session,
            ticket.id,
            "guardian_triggered",
            None,
            {
                "contact_count": guardian.contact_count,
                "reason": guardian.reason,
                "priority_from": old,
                "priority_to": ticket.priority,
                "matched": guardian.matched_ticket_ids,
            },
        )

    apply_sla(ticket, now)
    timeline(
        session,
        ticket.id,
        "sla_set",
        None,
        {
            "due_at": ticket.sla_due_at.isoformat() if ticket.sla_due_at else None,
            "state": ticket.sla_state,
        },
    )

    result, _decision = await routing_service.vector_ticket(session, ticket, now)
    timeline(
        session,
        ticket.id,
        "routed",
        None,
        {
            "owner_id": result.chosen_id,
            "owner_name": result.chosen_name,
            "reason": result.reason,
            "preset": result.preset,
            "total": result.total,
        },
    )
    if result.chosen_id:
        ticket.status = "open"

    await tag_ticket_themes(session, ticket)
    audit(session, actor, "ticket.create", "ticket", ticket.id, {"number": number}, ip)
    await session.commit()

    fresh = await load_ticket(session, ticket.id)
    assert fresh is not None
    broker.publish(
        "ticket.created",
        {
            "id": fresh.id,
            "number": fresh.number,
            "region": fresh.region,
            "priority": fresh.priority,
            "owner": result.chosen_name,
            "reason": result.reason,
        },
        agency_id=fresh.agency_id,
    )
    if guardian.triggered:
        broker.publish(
            "guardian",
            {"id": fresh.id, "number": fresh.number, "reason": guardian.reason},
            agency_id=None,
        )
    return fresh, link_result.links, guardian, suggestion.model_dump()


def guardian_view(ticket: Ticket) -> GuardianOut:
    reason = (
        f"Contact #{ticket.contact_count} on this booking/intent in {GUARDIAN_WINDOW_DAYS} days"
        if ticket.guardian_flag
        else "No repeat-contact pattern"
    )
    return GuardianOut(
        triggered=ticket.guardian_flag, contact_count=ticket.contact_count, reason=reason
    )


def _publish_update(ticket: Ticket, change: str, extra: dict | None = None) -> None:
    broker.publish(
        "ticket.updated",
        {
            "id": ticket.id,
            "number": ticket.number,
            "change": change,
            "status": ticket.status,
            "sla_state": ticket.sla_state,
            **(extra or {}),
        },
        agency_id=ticket.agency_id,
    )


async def change_status(
    session: AsyncSession, ticket: Ticket, target: str, actor: Principal, note: str | None = None
) -> None:
    check = lifecycle.can_transition(ticket.status, target)
    if not check.allowed:
        raise conflict(
            "illegal_transition",
            check.reason,
            {
                "from": ticket.status,
                "to": target,
                "allowed": sorted(lifecycle.TRANSITIONS.get(ticket.status, [])),
            },
        )
    if target == "escalated":
        raise bad_request("use_escalate", "Use the Escalate action, which requires a reason")
    now = utcnow()
    prev = ticket.status
    ticket.status = target
    if target == "resolved":
        ticket.resolved_at = now
    if target == "closed":
        ticket.closed_at = now
    if target == "open" and prev == "resolved":
        ticket.resolved_at = None
    apply_sla(ticket, now)
    timeline(
        session, ticket.id, "status_changed", actor, {"from": prev, "to": target, "note": note}
    )
    audit(session, actor, "ticket.status", "ticket", ticket.id, {"from": prev, "to": target})


async def set_owner(
    session: AsyncSession, ticket: Ticket, user_id: str | None, actor: Principal, event: str
) -> None:
    prev_owner = ticket.owner_id
    if user_id is not None:
        user = await session.get(User, user_id)
        if user is None or user.role not in {"agent", "lead", "escalation_manager"}:
            raise bad_request(
                "invalid_owner", "Owner must be a controller, Tower Chief or Director"
            )
        ticket.owner_id = user.id
        if ticket.status != "escalated":
            q = await routing_service.queue_for_region(session, user.region)
            ticket.queue_id = q.id if q else ticket.queue_id
        if ticket.status == "new":
            ticket.status = "open"
    else:
        ticket.owner_id = None
        q = await routing_service.queue_by_kind(session, "triage")
        ticket.queue_id = q.id if q else None
    timeline(session, ticket.id, event, actor, {"from": prev_owner, "to": ticket.owner_id})
    audit(
        session,
        actor,
        f"ticket.{event}",
        "ticket",
        ticket.id,
        {"from": prev_owner, "to": ticket.owner_id},
    )


async def handoff_diff(session: AsyncSession, ticket: Ticket, to_user_id: str) -> HandoffDiffOut:
    """Frequency recipients that stay, are added, or are dropped on reassignment.

    External parties (suppliers, agencies) and locked internal recipients always
    stay. The outgoing owner's unlocked seat is dropped and the new owner added.
    """
    to_user = await session.get(User, to_user_id)
    if to_user is None:
        raise not_found("Controller")
    from_user = await session.get(User, ticket.owner_id) if ticket.owner_id else None
    freqs = (
        await session.scalars(
            select(Frequency).where(Frequency.ticket_id == ticket.id, Frequency.status == "open")
        )
    ).all()
    stayed: list[HandoffRecipient] = []
    added: list[HandoffRecipient] = []
    dropped: list[HandoffRecipient] = []
    for f in freqs:
        active = [r for r in f.recipients if r.removed_at is None]
        for r in active:
            item = HandoffRecipient(
                frequency_id=f.id,
                frequency_subject=f.subject,
                party_type=r.party_type,
                name=r.name,
                email=r.email,
                locked=r.locked,
            )
            if (
                r.party_type == "internal"
                and not r.locked
                and from_user
                and r.party_id == from_user.id
            ):
                dropped.append(item)
            else:
                stayed.append(item)
        if not any(r.party_id == to_user.id for r in active):
            added.append(
                HandoffRecipient(
                    frequency_id=f.id,
                    frequency_subject=f.subject,
                    party_type="internal",
                    name=to_user.name,
                    email=to_user.email,
                    locked=False,
                )
            )
    return HandoffDiffOut(
        from_owner=user_brief(from_user),
        to_owner=user_brief(to_user),  # type: ignore[arg-type]
        stayed=stayed,
        added=added,
        dropped=dropped,
        requires_confirmation=bool(freqs),
    )


async def reassign(
    session: AsyncSession,
    ticket: Ticket,
    to_user_id: str,
    confirmed: bool,
    actor: Principal,
    note: str | None,
) -> HandoffDiffOut:
    diff = await handoff_diff(session, ticket, to_user_id)
    if diff.requires_confirmation and not confirmed:
        raise AppError(
            409,
            "handoff_confirmation_required",
            "Review the Frequency handoff check and confirm",
            diff.model_dump(mode="json"),
        )
    now = utcnow()
    if diff.requires_confirmation:
        to_user = await session.get(User, to_user_id)
        assert to_user is not None
        freqs = (
            await session.scalars(
                select(Frequency).where(
                    Frequency.ticket_id == ticket.id, Frequency.status == "open"
                )
            )
        ).all()
        dropped_emails = {(d.frequency_id, d.email) for d in diff.dropped}
        for f in freqs:
            for r in f.recipients:
                if r.removed_at is None and (f.id, r.email) in dropped_emails:
                    r.removed_at = now
            if any(a.frequency_id == f.id for a in diff.added):
                session.add(
                    FrequencyRecipient(
                        frequency_id=f.id,
                        party_type="internal",
                        party_id=to_user.id,
                        name=to_user.name,
                        email=to_user.email,
                        locked=False,
                        added_at=now,
                    )
                )
        timeline(
            session,
            ticket.id,
            "handoff_check",
            actor,
            {
                "stayed": [s.model_dump() for s in diff.stayed],
                "added": [a.model_dump() for a in diff.added],
                "dropped": [d.model_dump() for d in diff.dropped],
                "confirmed": True,
            },
        )
    await set_owner(session, ticket, to_user_id, actor, "reassigned")
    if note:
        timeline(session, ticket.id, "note", actor, {"note": note})
    return diff


async def escalate(session: AsyncSession, ticket: Ticket, reason: str, actor: Principal) -> User:
    if ticket.status in {"resolved", "closed"}:
        raise conflict("illegal_transition", f"Cannot escalate a {ticket.status} flight")
    chiefs = (
        await session.scalars(
            select(User).where(User.role == "escalation_manager", User.is_active.is_(True))
        )
    ).all()
    if not chiefs:
        raise conflict("no_tower_chief", "No Tower Chief is configured")
    counts = await routing_service.open_counts(session)
    online = [c for c in chiefs if c.availability != "away"] or list(chiefs)
    chief = min(online, key=lambda c: (counts.get(c.id, 0), c.name))
    queue = await session.scalar(select(Queue).where(Queue.kind == "escalation"))
    prev = {"status": ticket.status, "owner": ticket.owner_id, "queue": ticket.queue_id}
    ticket.status = "escalated"
    ticket.owner_id = chief.id
    ticket.queue_id = queue.id if queue else ticket.queue_id
    ticket.escalated_to = chief.id
    ticket.escalation_reason = reason
    timeline(
        session,
        ticket.id,
        "escalated",
        actor,
        {"reason": reason, "to": chief.id, "to_name": chief.name, "previous": prev},
    )
    audit(
        session, actor, "ticket.escalate", "ticket", ticket.id, {"to": chief.id, "reason": reason}
    )
    return chief


async def manual_link(
    session: AsyncSession, ticket: Ticket, target: str, reason: str, actor: Principal
) -> None:
    other = await load_ticket(session, target)
    if other is None or other.id == ticket.id:
        raise not_found("Target flight")
    if not await add_link(session, ticket.id, other.id, "manual", 1.0, reason, actor.id):
        raise conflict("already_linked", f"{ticket.number} and {other.number} are already linked")
    timeline(
        session,
        ticket.id,
        "linked",
        actor,
        {
            "links": [
                {
                    "ticket_id": other.id,
                    "number": other.number,
                    "link_type": "manual",
                    "strength": 1.0,
                    "reason": reason,
                }
            ],
            "count": 1,
        },
    )
    audit(session, actor, "ticket.link", "ticket", ticket.id, {"other": other.id})


publish_update = _publish_update
