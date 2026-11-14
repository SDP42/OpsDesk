"""Executes Tower Radio plans against the database and composes spoken-friendly replies."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import REGION_LABELS
from app.core.rbac import Principal, scope_tickets
from app.db.base import utcnow
from app.db.models import Agency, Frequency, FrequencyRecipient, Ticket
from app.engines.assistant import KNOWLEDGE, PERSONA_HELP, AssistantPlan, plan
from app.engines.lifecycle import OPEN_STATUSES
from app.services.serializers import sla_for


class AnswerCard(BaseModel):
    number: str
    title: str
    status: str
    sla_state: str
    detail: str
    href: str


class AssistantAnswer(BaseModel):
    answer: str
    speak: str
    cards: list[AnswerCard] = []
    suggestions: list[str] = []
    understood: str


def _hours(dt: datetime | None, now: datetime) -> str:
    if dt is None:
        return "no travel date"
    h = (dt - now).total_seconds() / 3600
    if h < 0:
        return "check-in passed"
    return f"check-in in {h:.0f} hours" if h < 48 else f"check-in in {h / 24:.0f} days"


def _card(t: Ticket, principal: Principal, now: datetime) -> AnswerCard:
    href = f"/pilot?flight={t.id}" if principal.is_requester else f"/tower/t/{t.number}"
    sla = sla_for(t, now)
    owner = t.owner.callsign if t.owner else "triage"
    return AnswerCard(
        number=t.number,
        title=t.title,
        status=t.status,
        sla_state=sla.state,
        detail=f"{owner} · {_hours(t.check_in, now)}",
        href=href,
    )


async def _open(session: AsyncSession, principal: Principal, **where: object):  # type: ignore[no-untyped-def]
    stmt = scope_tickets(select(Ticket), principal).where(Ticket.status.in_(OPEN_STATUSES))
    if where.get("owner"):
        stmt = stmt.where(Ticket.owner_id == where["owner"])
    if where.get("region"):
        stmt = stmt.where(Ticket.region == where["region"])
    if where.get("sla_state"):
        stmt = stmt.where(Ticket.sla_state == where["sla_state"])
    if where.get("status"):
        stmt = stmt.where(Ticket.status == where["status"])
    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (await session.scalars(stmt.order_by(Ticket.sla_due_at.asc()).limit(5))).unique().all()
    return int(total or 0), list(rows)


async def answer(session: AsyncSession, principal: Principal, question: str) -> AssistantAnswer:
    p: AssistantPlan = plan(question, principal.role)
    now = utcnow()
    first = principal.name.split(" ")[0].split("(")[0].strip()
    suggestions = PERSONA_HELP.get(principal.role, PERSONA_HELP["agent"])

    if p.intent == "greeting":
        total, _ = await _open(session, principal)
        breached, _ = await _open(session, principal, sla_state="breached")
        text = f"Hello {first}. You have {total} open flights in view, {breached} of them breached. What do you need?"
        return AssistantAnswer(
            answer=text, speak=text, suggestions=suggestions, understood=p.reason
        )

    if p.intent == "explain" and p.topic:
        text = KNOWLEDGE[p.topic]
        return AssistantAnswer(
            answer=text,
            speak=text.split(". ")[0] + ".",
            suggestions=suggestions,
            understood=p.reason,
        )

    if p.intent == "find_ticket":
        t = await session.scalar(
            scope_tickets(select(Ticket), principal).where(Ticket.number == p.filters["number"])
        )
        if t is None:
            text = f"I can't see {p.filters['number']} in your airspace."
            return AssistantAnswer(
                answer=text, speak=text, suggestions=suggestions, understood=p.reason
            )
        card = _card(t, principal, now)
        text = (
            f"{t.number} is {t.status}, {card.sla_state.replace('_', ' ')} on the wheels-up clock, "
            f"with {card.detail}."
            + (
                f" Routed because: {t.routing_reason['reason']}."
                if t.routing_reason and not principal.is_requester
                else ""
            )
        )
        return AssistantAnswer(
            answer=text, speak=text, cards=[card], suggestions=suggestions, understood=p.reason
        )

    if p.intent == "find_tboh":
        rows = (
            (
                await session.scalars(
                    scope_tickets(select(Ticket), principal)
                    .where(Ticket.tboh == p.filters["tboh"])
                    .order_by(Ticket.created_at.desc())
                    .limit(5)
                )
            )
            .unique()
            .all()
        )
        if not rows:
            text = f"No flights on {p.filters['tboh']} in your airspace."
            return AssistantAnswer(
                answer=text, speak=text, suggestions=suggestions, understood=p.reason
            )
        open_n = sum(1 for r in rows if r.status in OPEN_STATUSES)
        text = (
            f"{len(rows)} flights on {p.filters['tboh']}, {open_n} still open. "
            f"The latest, {rows[0].number}, is {rows[0].status}."
        )
        return AssistantAnswer(
            answer=text,
            speak=text,
            cards=[_card(r, principal, now) for r in rows],
            suggestions=suggestions,
            understood=p.reason,
        )

    if p.intent == "my_queue":
        owner = None if principal.is_requester or principal.role == "lead" else principal.id
        total, rows = await _open(session, principal, owner=owner)
        if not rows:
            text = "Your queue is clear. Nothing open right now."
        elif principal.is_requester:
            text = f"You have {total} open flights. The most urgent is {rows[0].number}: {rows[0].title}, currently {rows[0].status}."
        else:
            t = rows[0]
            text = (
                f"{total} flights in your queue. Work {t.number} first: {t.title}. "
                f"It is {sla_for(t, now).state.replace('_', ' ')} with {_hours(t.check_in, now)}."
            )
        return AssistantAnswer(
            answer=text,
            speak=text,
            cards=[_card(r, principal, now) for r in rows],
            suggestions=suggestions,
            understood=p.reason,
        )

    if p.intent == "escalations":
        total, rows = await _open(
            session, principal, status="escalated", region=p.filters.get("region")
        )
        text = f"{total} flights are with the Tower Chief." + (
            f" Soonest deadline: {rows[0].number}, {_hours(rows[0].check_in, now)}." if rows else ""
        )
        return AssistantAnswer(
            answer=text,
            speak=text,
            cards=[_card(r, principal, now) for r in rows],
            suggestions=suggestions,
            understood=p.reason,
        )

    if p.intent == "turbulence" and not principal.is_requester:
        agencies = (
            await session.scalars(select(Agency).order_by(Agency.turbulence_score.desc()).limit(3))
        ).all()
        parts = [f"{a.name} at {a.turbulence_score:.0f}" for a in agencies]
        text = (
            "Most turbulent agencies right now: "
            + ", ".join(parts)
            + ". Scores rise with repeat contacts, unresolved age and escalations."
        )
        return AssistantAnswer(
            answer=text, speak=text, suggestions=suggestions, understood=p.reason
        )

    if p.intent == "briefing":
        total, _ = await _open(session, principal)
        breached, rows = await _open(session, principal, sla_state="breached")
        critical, _ = await _open(session, principal, sla_state="critical")
        esc, _ = await _open(session, principal, status="escalated")
        triage = await session.scalar(
            select(func.count()).select_from(
                scope_tickets(select(Ticket), principal)
                .where(Ticket.status.in_(OPEN_STATUSES), Ticket.owner_id.is_(None))
                .subquery()
            )
        )
        text = (
            f"Tower briefing: {total} open flights, {critical} critical and {breached} breached. "
            f"{esc} are with the Tower Chief and {triage} wait in triage."
        )
        return AssistantAnswer(
            answer=text,
            speak=text,
            cards=[_card(r, principal, now) for r in rows[:3]],
            suggestions=suggestions,
            understood=p.reason,
        )

    if p.intent == "supplier_inbox" and principal.role == "supplier":
        rows = (
            (
                await session.scalars(
                    select(Frequency)
                    .join(FrequencyRecipient, FrequencyRecipient.frequency_id == Frequency.id)
                    .where(
                        FrequencyRecipient.party_type == "supplier",
                        FrequencyRecipient.party_id == principal.supplier_id,
                        FrequencyRecipient.removed_at.is_(None),
                        Frequency.status == "open",
                    )
                )
            )
            .unique()
            .all()
        )
        text = f"You are on {len(rows)} open channels with TBO operations." + (
            f" Latest: {rows[0].subject}." if rows else ""
        )
        return AssistantAnswer(
            answer=text, speak=text, suggestions=suggestions, understood=p.reason
        )

    if p.intent == "search":
        total, rows = await _open(
            session, principal, region=p.filters.get("region"), sla_state=p.filters.get("sla_state")
        )
        where = (
            f" in {REGION_LABELS.get(p.filters['region'], p.filters['region'])}"
            if p.filters.get("region")
            else ""
        )
        state = (
            f" {p.filters['sla_state'].replace('_', ' ')}"
            if p.filters.get("sla_state")
            else " open"
        )
        text = f"{total}{state} flights{where}." + (
            f" Lowest fuel: {rows[0].number}, {rows[0].title}." if rows else ""
        )
        return AssistantAnswer(
            answer=text,
            speak=text,
            cards=[_card(r, principal, now) for r in rows],
            suggestions=suggestions,
            understood=p.reason,
        )

    text = "I can find flights by callsign or TBOH, brief you on the tower, explain routing, SLAs and linking, or list what to work on next."
    return AssistantAnswer(answer=text, speak=text, suggestions=suggestions, understood=p.reason)
