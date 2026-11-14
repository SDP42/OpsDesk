"""Near-realtime feed over Server-Sent Events."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from app.core.rbac import Principal, require_any
from app.core.sse import broker

router = APIRouter(tags=["stream"])


@router.get("/stream")
async def stream(principal: Principal = Depends(require_any)) -> EventSourceResponse:
    """ticket.created, ticket.updated, sla.tick, escalation, guardian.

    Staff receive every event; Pilots only events about their own agency.
    """
    return EventSourceResponse(broker.subscribe(principal.role, principal.agency_id), ping=15)
