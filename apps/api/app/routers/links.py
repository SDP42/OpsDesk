"""Linked flights (the Constellation edges) and manual links."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import Principal, ensure_visible, require_agent_or_lead, require_any
from app.db.session import get_session
from app.schemas.common import Envelope
from app.schemas.tickets import LinkOut, ManualLinkIn
from app.services import tickets as svc

router = APIRouter(prefix="/tickets/{ticket_id}/links", tags=["links"])


@router.get("", response_model=Envelope[list[LinkOut]])
async def list_links(ticket_id: str, principal: Principal = Depends(require_any),
                     session: AsyncSession = Depends(get_session)) -> Envelope[list[LinkOut]]:
    ticket = ensure_visible(await svc.load_ticket(session, ticket_id), principal)
    return Envelope(data=await svc.get_links(session, ticket.id))


@router.post("", response_model=Envelope[list[LinkOut]], status_code=201)
async def add_link(ticket_id: str, body: ManualLinkIn,
                   principal: Principal = Depends(require_agent_or_lead),
                   session: AsyncSession = Depends(get_session)) -> Envelope[list[LinkOut]]:
    ticket = ensure_visible(await svc.load_ticket(session, ticket_id), principal)
    await svc.manual_link(session, ticket, body.target, body.reason, principal)
    await session.commit()
    svc.publish_update(ticket, "linked")
    return Envelope(data=await svc.get_links(session, ticket.id))
