"""Wires the Vectoring engine to the database: loads controllers, writes decisions."""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import utcnow
from app.db.models import HrRecord, Queue, RoutingDecision, Ticket, User
from app.engines import vectoring
from app.engines.lifecycle import OPEN_STATUSES

_active_preset = "balanced"


def get_preset() -> str:
    return _active_preset


def set_preset(preset: str) -> None:
    global _active_preset
    _active_preset = preset


async def open_counts(session: AsyncSession) -> dict[str, int]:
    rows = await session.execute(
        select(Ticket.owner_id, func.count())
        .where(Ticket.status.in_(OPEN_STATUSES), Ticket.owner_id.is_not(None))
        .group_by(Ticket.owner_id)
    )
    return {str(owner): int(count) for owner, count in rows.all()}


async def load_controllers(
    session: AsyncSession, role: str = "agent"
) -> list[vectoring.Controller]:
    users = (
        await session.scalars(select(User).where(User.role == role, User.is_active.is_(True)))
    ).all()
    counts = await open_counts(session)
    # Crew Roster: HRMS leave / weekly off overrides self-reported presence for routing.
    today = utcnow()
    on_leave = set(
        (
            await session.scalars(
                select(HrRecord.user_id).where(
                    HrRecord.kind.in_(["leave", "weekly_off"]),
                    HrRecord.start <= today,
                    HrRecord.end >= today - timedelta(days=1),
                )
            )
        ).all()
    )
    return [
        vectoring.Controller(
            id=u.id,
            name=u.name,
            region=u.region or "IN",
            languages=u.languages or [],
            shift_start=u.shift_start,
            shift_end=u.shift_end,
            availability="away" if u.id in on_leave else u.availability,
            open_tickets=counts.get(u.id, 0),
            capacity=u.capacity,
            skills=u.skills or [],
            rank=u.rank,
        )
        for u in users
    ]


async def queue_for_region(session: AsyncSession, region: str | None) -> Queue | None:
    if region is None:
        return await queue_by_kind(session, "triage")
    q = await session.scalar(select(Queue).where(Queue.kind == "region", Queue.region == region))
    return q or await queue_by_kind(session, "triage")


async def queue_by_kind(session: AsyncSession, kind: str) -> Queue | None:
    return await session.scalar(select(Queue).where(Queue.kind == kind).limit(1))


async def vector_ticket(
    session: AsyncSession, ticket: Ticket, now: datetime, preset: str | None = None
) -> tuple[vectoring.RoutingResult, RoutingDecision]:
    """Run Vectoring for ``ticket``, apply owner/queue and persist the decision row."""
    preset = preset or get_preset()
    controllers = await load_controllers(session)
    result = vectoring.route(
        vectoring.RoutingTicket(
            id=ticket.id,
            region=ticket.region,
            priority=ticket.priority,
            intent_code=ticket.intent.code if ticket.intent else None,
            agency_tier=ticket.agency.tier if ticket.agency else 2,
        ),
        controllers,
        now,
        preset,
    )
    queue = await queue_for_region(session, result.queue_region if result.chosen_id else None)
    ticket.owner_id = result.chosen_id
    ticket.queue_id = queue.id if queue else None
    payload = result.model_dump(mode="json")
    ticket.routing_reason = {
        "reason": result.reason,
        "preset": preset,
        "total": result.total,
        "breakdown": payload["breakdown"],
    }
    decision = RoutingDecision(
        ticket_id=ticket.id,
        chosen_user_id=result.chosen_id,
        queue_id=ticket.queue_id,
        scores=payload,
        reason=result.reason,
        preset=preset,
        created_at=now,
    )
    session.add(decision)
    return result, decision
