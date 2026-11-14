"""Frequencies: side conversations with explicit recipients that survive transfers."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import conflict, not_found
from app.core.rbac import Principal, ensure_visible, require_roles
from app.db.base import utcnow
from app.db.models import Frequency, FrequencyMessage, FrequencyRecipient, User
from app.db.session import get_session
from app.schemas.common import Envelope
from app.schemas.conversations import (
    FrequencyCreateIn,
    FrequencyMessageIn,
    FrequencyMessageOut,
    FrequencyOut,
    RecipientIn,
    RecipientOut,
)
from app.services import tickets as svc
from app.services.audit import audit, timeline

router = APIRouter(tags=["frequencies"])
staff_freq = require_roles("agent", "escalation_manager", "lead")


def _recipient(r: FrequencyRecipient) -> RecipientOut:
    return RecipientOut(
        id=r.id,
        party_type=r.party_type,
        party_id=r.party_id,
        name=r.name,
        email=r.email,
        locked=r.locked,
        added_at=r.added_at,
        removed_at=r.removed_at,
    )


async def _out(session: AsyncSession, f: Frequency, with_messages: bool = True) -> FrequencyOut:
    msgs: list[FrequencyMessageOut] = []
    if with_messages:
        rows = (
            await session.scalars(
                select(FrequencyMessage)
                .where(FrequencyMessage.frequency_id == f.id)
                .order_by(FrequencyMessage.at)
            )
        ).all()
        msgs = [
            FrequencyMessageOut(
                id=m.id, sender_type=m.sender_type, sender_name=m.sender_name, body=m.body, at=m.at
            )
            for m in rows
        ]
    return FrequencyOut(
        id=f.id,
        ticket_id=f.ticket_id,
        subject=f.subject,
        status=f.status,
        created_at=f.created_at,
        recipients=[_recipient(r) for r in f.recipients],
        messages=msgs,
    )


async def _load(session: AsyncSession, frequency_id: str, principal: Principal) -> Frequency:
    f = await session.scalar(
        select(Frequency)
        .where(Frequency.id == frequency_id)
        .execution_options(populate_existing=True)
    )
    if f is None:
        raise not_found("Frequency")
    ensure_visible(await svc.load_ticket(session, f.ticket_id), principal)
    return f


@router.get("/tickets/{ticket_id}/frequencies", response_model=Envelope[list[FrequencyOut]])
async def list_frequencies(
    ticket_id: str,
    principal: Principal = Depends(staff_freq),
    session: AsyncSession = Depends(get_session),
) -> Envelope[list[FrequencyOut]]:
    ticket = ensure_visible(await svc.load_ticket(session, ticket_id), principal)
    rows = (
        await session.scalars(
            select(Frequency).where(Frequency.ticket_id == ticket.id).order_by(Frequency.created_at)
        )
    ).all()
    return Envelope(data=[await _out(session, f) for f in rows])


@router.post(
    "/tickets/{ticket_id}/frequencies", response_model=Envelope[FrequencyOut], status_code=201
)
async def open_frequency(
    ticket_id: str,
    body: FrequencyCreateIn,
    principal: Principal = Depends(staff_freq),
    session: AsyncSession = Depends(get_session),
) -> Envelope[FrequencyOut]:
    ticket = ensure_visible(await svc.load_ticket(session, ticket_id), principal)
    me = await session.get(User, principal.id)
    assert me is not None
    f = Frequency(ticket_id=ticket.id, subject=body.subject, created_by=principal.id)
    session.add(f)
    await session.flush()
    now = utcnow()
    # The opener holds an unlocked "owner seat" that moves with ownership.
    session.add(
        FrequencyRecipient(
            frequency_id=f.id,
            party_type="internal",
            party_id=me.id,
            name=me.name,
            email=me.email,
            locked=False,
            added_at=now,
        )
    )
    for r in body.recipients:
        session.add(
            FrequencyRecipient(
                frequency_id=f.id,
                party_type=r.party_type,
                party_id=r.party_id,
                name=r.name,
                email=r.email,
                locked=r.locked,
                added_at=now,
            )
        )
    if body.first_message:
        session.add(
            FrequencyMessage(
                frequency_id=f.id,
                sender_type="internal",
                sender_name=me.name,
                sender_id=me.id,
                body=body.first_message,
            )
        )
    timeline(
        session,
        ticket.id,
        "frequency_opened",
        principal,
        {
            "frequency_id": f.id,
            "subject": body.subject,
            "recipients": [r.model_dump(mode="json") for r in body.recipients],
        },
    )
    audit(session, principal, "frequency.open", "frequency", f.id, {"ticket": ticket.id})
    await session.commit()
    return Envelope(data=await _out(session, await _load(session, f.id, principal)))


@router.get("/frequencies/{frequency_id}", response_model=Envelope[FrequencyOut])
async def get_frequency(
    frequency_id: str,
    principal: Principal = Depends(staff_freq),
    session: AsyncSession = Depends(get_session),
) -> Envelope[FrequencyOut]:
    return Envelope(data=await _out(session, await _load(session, frequency_id, principal)))


@router.post(
    "/frequencies/{frequency_id}/recipients", response_model=Envelope[FrequencyOut], status_code=201
)
async def add_recipient(
    frequency_id: str,
    body: RecipientIn,
    principal: Principal = Depends(staff_freq),
    session: AsyncSession = Depends(get_session),
) -> Envelope[FrequencyOut]:
    f = await _load(session, frequency_id, principal)
    if any(r.email.lower() == body.email.lower() and r.removed_at is None for r in f.recipients):
        raise conflict("duplicate_recipient", f"{body.email} is already on this Frequency")
    session.add(
        FrequencyRecipient(
            frequency_id=f.id,
            party_type=body.party_type,
            party_id=body.party_id,
            name=body.name,
            email=body.email,
            locked=body.locked,
        )
    )
    timeline(
        session,
        f.ticket_id,
        "recipient_added",
        principal,
        {"frequency_id": f.id, "name": body.name, "party_type": body.party_type},
    )
    audit(session, principal, "frequency.recipient_add", "frequency", f.id, {"email": body.email})
    await session.commit()
    return Envelope(data=await _out(session, await _load(session, f.id, principal)))


@router.delete(
    "/frequencies/{frequency_id}/recipients/{recipient_id}", response_model=Envelope[FrequencyOut]
)
async def remove_recipient(
    frequency_id: str,
    recipient_id: str,
    force: bool = False,
    principal: Principal = Depends(staff_freq),
    session: AsyncSession = Depends(get_session),
) -> Envelope[FrequencyOut]:
    f = await _load(session, frequency_id, principal)
    r = next((x for x in f.recipients if x.id == recipient_id and x.removed_at is None), None)
    if r is None:
        raise not_found("Recipient")
    if r.locked and not force:
        raise conflict("recipient_locked", f"{r.name} is locked on this Frequency; pass force=true")
    r.removed_at = utcnow()
    timeline(
        session,
        f.ticket_id,
        "recipient_removed",
        principal,
        {"frequency_id": f.id, "name": r.name, "party_type": r.party_type},
    )
    audit(session, principal, "frequency.recipient_remove", "frequency", f.id, {"email": r.email})
    await session.commit()
    return Envelope(data=await _out(session, await _load(session, f.id, principal)))


@router.post(
    "/frequencies/{frequency_id}/messages", response_model=Envelope[FrequencyOut], status_code=201
)
async def post_message(
    frequency_id: str,
    body: FrequencyMessageIn,
    principal: Principal = Depends(staff_freq),
    session: AsyncSession = Depends(get_session),
) -> Envelope[FrequencyOut]:
    f = await _load(session, frequency_id, principal)
    session.add(
        FrequencyMessage(
            frequency_id=f.id,
            sender_type="internal",
            sender_name=principal.name,
            sender_id=principal.id,
            body=body.body,
        )
    )
    timeline(
        session,
        f.ticket_id,
        "frequency_message",
        principal,
        {
            "frequency_id": f.id,
            "preview": body.body[:120],
            "to": [r.email for r in f.recipients if r.removed_at is None],
        },
    )
    audit(session, principal, "frequency.message", "frequency", f.id)
    await session.commit()
    return Envelope(data=await _out(session, await _load(session, f.id, principal)))
