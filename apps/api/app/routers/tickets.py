"""Flights: list (filters + cursor), create, detail, patch, ownership and escalation."""

from __future__ import annotations

import base64
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import and_, func, or_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import bad_request
from app.core.rbac import (
    EM,
    LEAD,
    Principal,
    ensure_can_modify,
    ensure_visible,
    require_agent_or_lead,
    require_any,
    require_roles,
    scope_tickets,
)
from app.core.sse import broker
from app.db.models import Intent, Ticket
from app.db.session import get_session
from app.engines.lifecycle import OPEN_STATUSES
from app.schemas.common import Envelope, Page, PageMeta
from app.schemas.tickets import (
    AssignIn,
    EscalateIn,
    HandoffDiffOut,
    PilotTicketDetailOut,
    PilotTicketOut,
    ReassignIn,
    RouteIn,
    TicketCreatedOut,
    TicketCreateIn,
    TicketDetailOut,
    TicketOut,
    TicketPatchIn,
)
from app.services import routing as routing_service
from app.services import tickets as svc
from app.services.audit import audit, timeline
from app.services.serializers import pilot_ticket_out, ticket_out

router = APIRouter(prefix="/tickets", tags=["tickets"])

View = Literal["all", "triage", "mine", "escalations", "open"]
Sort = Literal["created_desc", "sla_asc"]
FAR_FUTURE = datetime(2999, 1, 1)


def _encode(values: list[str]) -> str:
    return base64.urlsafe_b64encode("|".join(values).encode()).decode()


def _decode(cursor: str) -> list[str]:
    try:
        return base64.urlsafe_b64decode(cursor.encode()).decode().split("|")
    except Exception as exc:  # noqa: BLE001
        raise bad_request("bad_cursor", "Cursor is malformed") from exc


@router.get("", response_model=Page[TicketOut] | Page[PilotTicketOut])
async def list_tickets(
    principal: Principal = Depends(require_any),
    session: AsyncSession = Depends(get_session),
    view: View = "all",
    status: Annotated[list[str] | None, Query()] = None,
    region: str | None = None,
    intent: str | None = Query(default=None, description="Intent code or parent code"),
    owner: str | None = None,
    sla_state: Annotated[list[str] | None, Query()] = None,
    tboh: str | None = None,
    agency: str | None = None,
    priority: str | None = None,
    q: str | None = Query(default=None, max_length=100),
    sort: Sort = "created_desc",
    cursor: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
) -> Page[TicketOut] | Page[PilotTicketOut]:
    stmt = scope_tickets(select(Ticket), principal)
    if view == "triage":
        stmt = stmt.where(Ticket.owner_id.is_(None), Ticket.status.in_(OPEN_STATUSES))
    elif view == "mine":
        stmt = stmt.where(Ticket.owner_id == principal.id, Ticket.status.in_(OPEN_STATUSES))
    elif view == "escalations":
        stmt = stmt.where(Ticket.status == "escalated")
    elif view == "open":
        stmt = stmt.where(Ticket.status.in_(OPEN_STATUSES))
    if status:
        stmt = stmt.where(Ticket.status.in_(status))
    if region:
        stmt = stmt.where(Ticket.region == region)
    if owner:
        stmt = stmt.where(Ticket.owner_id == (principal.id if owner == "me" else owner))
    if sla_state:
        stmt = stmt.where(Ticket.sla_state.in_(sla_state))
    if tboh:
        stmt = stmt.where(Ticket.tboh == tboh.upper())
    if agency and not principal.is_requester:
        stmt = stmt.where(Ticket.agency_id == agency)
    if priority:
        stmt = stmt.where(Ticket.priority == priority)
    if intent:
        stmt = stmt.join(Intent, Ticket.intent_id == Intent.id).where(
            or_(Intent.code == intent, Intent.code.like(f"{intent}.%")))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Ticket.number.ilike(like), Ticket.title.ilike(like),
                              Ticket.tboh.ilike(like)))

    if sort == "sla_asc":
        key = func.coalesce(Ticket.sla_due_at, FAR_FUTURE)
        if cursor:
            raw_due, raw_id = _decode(cursor)
            stmt = stmt.where(tuple_(key, Ticket.id) > tuple_(datetime.fromisoformat(raw_due), raw_id))
        stmt = stmt.order_by(key.asc(), Ticket.id.asc())
    else:
        if cursor:
            raw_created, raw_id = _decode(cursor)
            c = datetime.fromisoformat(raw_created)
            stmt = stmt.where(or_(Ticket.created_at < c,
                                  and_(Ticket.created_at == c, Ticket.id < raw_id)))
        stmt = stmt.order_by(Ticket.created_at.desc(), Ticket.id.desc())

    rows = list((await session.scalars(stmt.limit(limit + 1))).unique().all())
    has_more = len(rows) > limit
    rows = rows[:limit]
    next_cursor = None
    if has_more and rows:
        last = rows[-1]
        if sort == "sla_asc":
            due = (last.sla_due_at or FAR_FUTURE).replace(tzinfo=None)
            next_cursor = _encode([due.isoformat(), last.id])
        else:
            next_cursor = _encode([last.created_at.replace(tzinfo=None).isoformat(), last.id])
    counts = await svc.link_counts(session, [r.id for r in rows])
    meta = PageMeta(next_cursor=next_cursor, count=len(rows))
    if principal.is_requester:
        return Page[PilotTicketOut](data=[pilot_ticket_out(r, counts.get(r.id, 0)) for r in rows],
                                    meta=meta)
    return Page[TicketOut](data=[ticket_out(r, counts.get(r.id, 0)) for r in rows], meta=meta)


@router.post("", response_model=Envelope[TicketCreatedOut], status_code=201)
async def create_ticket(body: TicketCreateIn, request: Request,
                        principal: Principal = Depends(require_any),
                        session: AsyncSession = Depends(get_session)) -> Envelope[TicketCreatedOut]:
    ip = request.client.host if request.client else None
    ticket, _proposals, guardian, suggestion = await svc.create_ticket(session, body, principal, ip)
    links = await svc.get_links(session, ticket.id)
    out = pilot_ticket_out(ticket, len(links)) if principal.is_requester else ticket_out(ticket, len(links))
    return Envelope(data=TicketCreatedOut(
        ticket=out, links=links,
        guardian=svc.GuardianOut(triggered=guardian.triggered, contact_count=guardian.contact_count,
                                 reason=guardian.reason),
        intent_suggestion=suggestion))


async def _get_visible(session: AsyncSession, ticket_id: str, principal: Principal) -> Ticket:
    return ensure_visible(await svc.load_ticket(session, ticket_id), principal)


@router.get("/{ticket_id}", response_model=Envelope[TicketDetailOut] | Envelope[PilotTicketDetailOut])
async def get_ticket(ticket_id: str, principal: Principal = Depends(require_any),
                     session: AsyncSession = Depends(get_session),
                     as_: Literal["requester"] | None = Query(default=None, alias="as"),
                     ) -> Envelope[TicketDetailOut] | Envelope[PilotTicketDetailOut]:
    """Ticket with timeline, links, routing reason and SLA. ``?as=requester`` is the Agency Mirror."""
    ticket = await _get_visible(session, ticket_id, principal)
    links = await svc.get_links(session, ticket.id)
    events = await svc.get_timeline(session, ticket.id)
    if principal.is_requester or as_ == "requester":
        public_types = {"created", "status_changed", "escalated", "external_reply", "linked"}
        events = [e.model_copy(update={"actor": None, "payload": {}}) if e.type != "created" else e
                  for e in events if e.type in public_types]
        return Envelope(data=PilotTicketDetailOut(ticket=pilot_ticket_out(ticket, len(links)),
                                                  timeline=events, links=links))
    return Envelope(data=TicketDetailOut(ticket=ticket_out(ticket, len(links)), timeline=events,
                                         links=links,
                                         routing=await svc.latest_routing(session, ticket.id),
                                         guardian=svc.guardian_view(ticket)))


async def _reload_out(session: AsyncSession, ticket_id: str) -> TicketOut:
    fresh = await svc.load_ticket(session, ticket_id)
    assert fresh is not None
    counts = await svc.link_counts(session, [fresh.id])
    return ticket_out(fresh, counts.get(fresh.id, 0))


@router.patch("/{ticket_id}", response_model=Envelope[TicketOut])
async def patch_ticket(ticket_id: str, body: TicketPatchIn,
                       principal: Principal = Depends(require_roles("agent", EM, LEAD)),
                       session: AsyncSession = Depends(get_session)) -> Envelope[TicketOut]:
    ticket = await _get_visible(session, ticket_id, principal)
    ensure_can_modify(ticket, principal)
    changes: list[str] = []
    if body.priority and body.priority != ticket.priority:
        timeline(session, ticket.id, "priority_changed", principal,
                 {"from": ticket.priority, "to": body.priority})
        ticket.priority = body.priority
        svc.apply_sla(ticket, svc.utcnow())
        changes.append("priority")
    if body.intent_code and (ticket.intent is None or body.intent_code != ticket.intent.code):
        intent = await svc.intent_by_code(session, body.intent_code)
        if intent is None:
            raise bad_request("unknown_intent", f"Unknown intent {body.intent_code}")
        timeline(session, ticket.id, "intent_overridden", principal,
                 {"from": ticket.intent.code if ticket.intent else None, "to": intent.code})
        ticket.intent_id, ticket.intent_source, ticket.intent_confidence = intent.id, "manual", 1.0
        changes.append("intent")
    if body.title and body.title != ticket.title:
        timeline(session, ticket.id, "title_changed", principal, {"from": ticket.title, "to": body.title})
        ticket.title = body.title
        changes.append("title")
    if body.status and body.status != ticket.status:
        await svc.change_status(session, ticket, body.status, principal, body.note)
        changes.append("status")
    if changes:
        audit(session, principal, "ticket.update", "ticket", ticket.id, {"fields": changes})
    await session.commit()
    out = await _reload_out(session, ticket.id)
    svc.publish_update(ticket, ",".join(changes) or "none")
    return Envelope(data=out)


@router.post("/{ticket_id}/assign", response_model=Envelope[TicketOut])
async def assign(ticket_id: str, body: AssignIn,
                 principal: Principal = Depends(require_roles("agent", EM, LEAD)),
                 session: AsyncSession = Depends(get_session)) -> Envelope[TicketOut]:
    ticket = await _get_visible(session, ticket_id, principal)
    ensure_can_modify(ticket, principal)
    await svc.set_owner(session, ticket, body.user_id or principal.id, principal, "assigned")
    await session.commit()
    svc.publish_update(ticket, "assigned", {"owner_id": ticket.owner_id})
    return Envelope(data=await _reload_out(session, ticket.id))


@router.post("/{ticket_id}/unassign", response_model=Envelope[TicketOut])
async def unassign(ticket_id: str, principal: Principal = Depends(require_agent_or_lead),
                   session: AsyncSession = Depends(get_session)) -> Envelope[TicketOut]:
    ticket = await _get_visible(session, ticket_id, principal)
    await svc.set_owner(session, ticket, None, principal, "unassigned")
    await session.commit()
    svc.publish_update(ticket, "unassigned")
    return Envelope(data=await _reload_out(session, ticket.id))


@router.get("/{ticket_id}/handoff-preview", response_model=Envelope[HandoffDiffOut])
async def handoff_preview(ticket_id: str, to_user_id: str,
                          principal: Principal = Depends(require_roles("agent", EM, LEAD)),
                          session: AsyncSession = Depends(get_session)) -> Envelope[HandoffDiffOut]:
    ticket = await _get_visible(session, ticket_id, principal)
    return Envelope(data=await svc.handoff_diff(session, ticket, to_user_id))


@router.post("/{ticket_id}/reassign", response_model=Envelope[TicketOut])
async def reassign(ticket_id: str, body: ReassignIn,
                   principal: Principal = Depends(require_roles("agent", EM, LEAD)),
                   session: AsyncSession = Depends(get_session)) -> Envelope[TicketOut]:
    """Transfer ownership. With open Frequencies, the handoff check must be confirmed."""
    ticket = await _get_visible(session, ticket_id, principal)
    ensure_can_modify(ticket, principal)
    await svc.reassign(session, ticket, body.to_user_id, body.handoff_confirmed, principal, body.note)
    await session.commit()
    svc.publish_update(ticket, "reassigned", {"owner_id": ticket.owner_id})
    return Envelope(data=await _reload_out(session, ticket.id))


@router.post("/{ticket_id}/escalate", response_model=Envelope[TicketOut])
async def escalate(ticket_id: str, body: EscalateIn,
                   principal: Principal = Depends(require_roles("agent", EM, LEAD)),
                   session: AsyncSession = Depends(get_session)) -> Envelope[TicketOut]:
    """Escalate to the Tower Chief: changes owner and queue, requires a reason."""
    ticket = await _get_visible(session, ticket_id, principal)
    chief = await svc.escalate(session, ticket, body.reason, principal)
    await session.commit()
    broker.publish("escalation", {"id": ticket.id, "number": ticket.number, "to": chief.name,
                                  "to_id": chief.id, "reason": body.reason},
                   agency_id=ticket.agency_id)
    svc.publish_update(ticket, "escalated", {"owner_id": chief.id})
    return Envelope(data=await _reload_out(session, ticket.id))


@router.post("/{ticket_id}/route", response_model=Envelope[TicketOut])
async def auto_route(ticket_id: str, body: RouteIn,
                     principal: Principal = Depends(require_agent_or_lead),
                     session: AsyncSession = Depends(get_session)) -> Envelope[TicketOut]:
    """Run Vectoring now (triage auto-route button)."""
    ticket = await _get_visible(session, ticket_id, principal)
    now = svc.utcnow()
    result, _ = await routing_service.vector_ticket(session, ticket, now, body.preset)
    if result.chosen_id and ticket.status == "new":
        ticket.status = "open"
    timeline(session, ticket.id, "routed", principal,
             {"owner_id": result.chosen_id, "owner_name": result.chosen_name,
              "reason": result.reason, "preset": result.preset, "total": result.total})
    audit(session, principal, "ticket.route", "ticket", ticket.id, {"preset": result.preset})
    await session.commit()
    svc.publish_update(ticket, "routed", {"owner_id": result.chosen_id, "reason": result.reason})
    return Envelope(data=await _reload_out(session, ticket.id))
