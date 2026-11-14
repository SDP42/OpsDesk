"""Supplier Partner portal: external organisations work their Frequencies inside OpsDesk.

A supplier user only sees channels where their supplier is an active recipient,
never internal notes or other tickets. Replies land on the ticket timeline and
reach controllers live over SSE.
"""

from __future__ import annotations

import statistics
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import not_found
from app.core.rbac import Principal, require_supplier
from app.core.sse import broker
from app.db.base import utcnow
from app.db.models import Booking, Frequency, FrequencyMessage, FrequencyRecipient, Supplier, Ticket
from app.db.session import get_session
from app.schemas.common import Envelope, StrictModel
from app.services.audit import audit, timeline

router = APIRouter(prefix="/partner", tags=["partner"])


class ChannelMessage(BaseModel):
    id: str
    sender_type: str
    sender_name: str
    body: str
    at: datetime


class Channel(BaseModel):
    id: str
    subject: str
    status: str
    ticket_number: str
    hotel: str | None
    check_in: datetime | None
    tboh: str | None
    awaiting_reply: bool
    last_at: datetime | None
    messages: list[ChannelMessage] = []


class PartnerStats(BaseModel):
    supplier: str
    open_channels: int
    awaiting_reply: int
    median_response_minutes: float | None
    reason: str


class ReplyIn(StrictModel):
    body: str = Field(min_length=1, max_length=5000)


async def _channels(session: AsyncSession, principal: Principal) -> list[Frequency]:
    return list(
        (
            await session.scalars(
                select(Frequency)
                .join(FrequencyRecipient, FrequencyRecipient.frequency_id == Frequency.id)
                .where(
                    FrequencyRecipient.party_type == "supplier",
                    FrequencyRecipient.party_id == principal.supplier_id,
                    FrequencyRecipient.removed_at.is_(None),
                )
                .order_by(Frequency.created_at.desc())
            )
        )
        .unique()
        .all()
    )


async def _channel_out(session: AsyncSession, f: Frequency, with_messages: bool) -> Channel:
    t = await session.get(Ticket, f.ticket_id)
    b = (
        await session.scalar(select(Booking).where(Booking.tboh == t.tboh))
        if t and t.tboh
        else None
    )
    msgs = (
        await session.scalars(
            select(FrequencyMessage)
            .where(FrequencyMessage.frequency_id == f.id)
            .order_by(FrequencyMessage.at)
        )
    ).all()
    last = msgs[-1] if msgs else None
    return Channel(
        id=f.id,
        subject=f.subject,
        status=f.status,
        ticket_number=t.number if t else "",
        hotel=b.hotel_name if b else None,
        check_in=t.check_in if t else None,
        tboh=t.tboh if t else None,
        awaiting_reply=bool(last and last.sender_type == "internal"),
        last_at=last.at if last else None,
        messages=[
            ChannelMessage(
                id=m.id, sender_type=m.sender_type, sender_name=m.sender_name, body=m.body, at=m.at
            )
            for m in msgs
        ]
        if with_messages
        else [],
    )


@router.get("/channels", response_model=Envelope[list[Channel]])
async def channels(
    principal: Principal = Depends(require_supplier), session: AsyncSession = Depends(get_session)
) -> Envelope[list[Channel]]:
    return Envelope(
        data=[await _channel_out(session, f, False) for f in await _channels(session, principal)]
    )


@router.get("/channels/{channel_id}", response_model=Envelope[Channel])
async def channel(
    channel_id: str,
    principal: Principal = Depends(require_supplier),
    session: AsyncSession = Depends(get_session),
) -> Envelope[Channel]:
    f = next((c for c in await _channels(session, principal) if c.id == channel_id), None)
    if f is None:
        raise not_found("Channel")
    return Envelope(data=await _channel_out(session, f, True))


@router.post("/channels/{channel_id}/messages", response_model=Envelope[Channel], status_code=201)
async def reply(
    channel_id: str,
    body: ReplyIn,
    principal: Principal = Depends(require_supplier),
    session: AsyncSession = Depends(get_session),
) -> Envelope[Channel]:
    f = next((c for c in await _channels(session, principal) if c.id == channel_id), None)
    if f is None:
        raise not_found("Channel")
    supplier = await session.get(Supplier, principal.supplier_id)
    name = supplier.name if supplier else principal.name
    session.add(
        FrequencyMessage(
            frequency_id=f.id,
            sender_type="supplier",
            sender_name=name,
            sender_id=principal.id,
            body=body.body,
            at=utcnow(),
        )
    )
    timeline(
        session,
        f.ticket_id,
        "supplier_reply",
        principal,
        {"frequency_id": f.id, "supplier": name, "preview": body.body[:120]},
    )
    audit(session, principal, "partner.reply", "frequency", f.id)
    await session.commit()
    t = await session.get(Ticket, f.ticket_id)
    broker.publish(
        "ticket.updated",
        {
            "id": f.ticket_id,
            "number": t.number if t else "",
            "change": "supplier_reply",
            "supplier": name,
        },
    )
    return Envelope(data=await _channel_out(session, f, True))


@router.get("/stats", response_model=Envelope[PartnerStats])
async def stats(
    principal: Principal = Depends(require_supplier), session: AsyncSession = Depends(get_session)
) -> Envelope[PartnerStats]:
    """Supplier reliability: median minutes from a TBO message to this supplier's reply."""
    supplier = await session.get(Supplier, principal.supplier_id)
    chans = await _channels(session, principal)
    gaps: list[float] = []
    awaiting = 0
    for f in chans:
        msgs = (
            await session.scalars(
                select(FrequencyMessage)
                .where(FrequencyMessage.frequency_id == f.id)
                .order_by(FrequencyMessage.at)
            )
        ).all()
        pending: datetime | None = None
        for m in msgs:
            if m.sender_type == "internal":
                pending = pending or m.at
            elif m.sender_type == "supplier" and pending:
                gaps.append((m.at - pending).total_seconds() / 60)
                pending = None
        if msgs and msgs[-1].sender_type == "internal":
            awaiting += 1
    median = round(statistics.median(gaps), 1) if gaps else None
    return Envelope(
        data=PartnerStats(
            supplier=supplier.name if supplier else "",
            open_channels=sum(1 for f in chans if f.status == "open"),
            awaiting_reply=awaiting,
            median_response_minutes=median,
            reason=f"Median of {len(gaps)} reply gaps across {len(chans)} channels"
            if gaps
            else "No replies yet",
        )
    )
