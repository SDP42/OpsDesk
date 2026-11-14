"""ORM -> schema serializers. The pilot serializer is also the Agency Mirror view."""

from __future__ import annotations

from datetime import datetime

from app.db.base import utcnow
from app.db.models import Agency, Ticket, User
from app.engines.intent_taxonomy import label_of
from app.engines.lifecycle import OPEN_STATUSES
from app.engines.wheels_up import SlaInput, compute_sla
from app.schemas.auth import AgencyBrief
from app.schemas.tickets import (
    IntentBrief,
    PilotTicketOut,
    QueueBrief,
    SlaOut,
    TicketOut,
    UserBrief,
)


def agency_brief(a: Agency) -> AgencyBrief:
    return AgencyBrief(id=a.id, code=a.code, name=a.name, city=a.city, country=a.country,
                       region=a.region, tier=a.tier, turbulence_score=a.turbulence_score)


def user_brief(u: User | None) -> UserBrief | None:
    if u is None:
        return None
    return UserBrief(id=u.id, name=u.name, callsign=u.callsign, region=u.region, role=u.role)


def sla_for(t: Ticket, now: datetime | None = None) -> SlaOut:
    now = now or utcnow()
    resolved = None
    if t.status not in OPEN_STATUSES:
        resolved = t.resolved_at or t.closed_at or t.updated_at
    result = compute_sla(SlaInput(created_at=t.created_at, now=now, priority=t.priority,
                                  check_in=t.check_in, lcd=t.lcd, resolved_at=resolved))
    return SlaOut(due_at=result.due_at, state=result.state, elapsed_pct=result.elapsed_pct,
                  fuel=result.fuel, remaining_seconds=result.remaining_seconds,
                  urgency_driver=result.urgency_driver,
                  propose_escalation=result.propose_escalation,
                  holiday_paused=result.holiday_paused, reason=result.reason)


def intent_brief(t: Ticket) -> IntentBrief | None:
    if t.intent is None:
        return None
    return IntentBrief(code=t.intent.code, label=label_of(t.intent.code),
                       confidence=t.intent_confidence, source=t.intent_source)


def ticket_out(t: Ticket, link_count: int = 0, now: datetime | None = None) -> TicketOut:
    return TicketOut(
        id=t.id, number=t.number, title=t.title, description=t.description,
        agency=agency_brief(t.agency), requester_id=t.requester_id, tboh=t.tboh,
        intent=intent_brief(t), priority=t.priority, status=t.status,
        owner=user_brief(t.owner),
        queue=QueueBrief(id=t.queue.id, name=t.queue.name, kind=t.queue.kind,
                         region=t.queue.region) if t.queue else None,
        region=t.region, check_in=t.check_in, lcd=t.lcd, sla=sla_for(t, now),
        escalated_to=t.escalated_to, escalation_reason=t.escalation_reason,
        routing_reason=t.routing_reason, contact_count=t.contact_count,
        guardian_flag=t.guardian_flag, link_count=link_count, created_at=t.created_at,
        updated_at=t.updated_at, resolved_at=t.resolved_at,
    )


def pilot_ticket_out(t: Ticket, link_count: int = 0, now: datetime | None = None) -> PilotTicketOut:
    """Requester-safe projection: no internal notes, routing scores or owner identity."""
    sla = sla_for(t, now)
    return PilotTicketOut(
        id=t.id, number=t.number, title=t.title, description=t.description, tboh=t.tboh,
        intent=intent_brief(t), priority=t.priority, status=t.status,
        controller_callsign=t.owner.callsign if t.owner else None, check_in=t.check_in,
        eta=sla.due_at if t.status not in {"resolved", "closed"} else t.resolved_at,
        sla_state=sla.state, link_count=link_count, created_at=t.created_at,
        updated_at=t.updated_at, resolved_at=t.resolved_at,
    )
