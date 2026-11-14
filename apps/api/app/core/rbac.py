"""Role-based access control. The ONLY place that decides who can do what.

Roles: requester (Pilot), agent (Controller), escalation_manager (Tower Chief),
lead (Airport Director). Requesters are scoped to their own agency in every
query, and cross-agency reads return 404 so existence never leaks.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from fastapi import Depends, Request
from sqlalchemy import Select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError, forbidden, not_found
from app.core.security import decode_access_token
from app.db.models import Ticket, User
from app.db.session import get_session

REQUESTER, AGENT, EM, LEAD = "requester", "agent", "escalation_manager", "lead"
STAFF = frozenset({AGENT, EM, LEAD})
ALL_ROLES = frozenset({REQUESTER, AGENT, EM, LEAD})


@dataclass(frozen=True)
class Principal:
    id: str
    name: str
    role: str
    agency_id: str | None
    region: str | None
    data_mode: str = "demo"

    @property
    def is_staff(self) -> bool:
        return self.role in STAFF

    @property
    def is_requester(self) -> bool:
        return self.role == REQUESTER


def _token_from(request: Request) -> str | None:
    token = request.cookies.get(get_settings().session_cookie_name)
    if token:
        return token
    auth = request.headers.get("authorization", "")
    return auth[7:] if auth.lower().startswith("bearer ") else None


async def current_principal(
    request: Request, session: AsyncSession = Depends(get_session)
) -> Principal:
    token = _token_from(request)
    claims = decode_access_token(token) if token else None
    if not claims:
        raise AppError(401, "unauthorized", "Sign in to continue")
    user = await session.get(User, claims.get("sub"))
    if user is None or not user.is_active:
        raise AppError(401, "unauthorized", "Session is no longer valid")
    principal = Principal(
        user.id, user.name, user.role, user.agency_id, user.region, user.data_mode
    )
    request.state.principal = principal
    return principal


def require_roles(*roles: str) -> Callable[..., Awaitable[Principal]]:
    """Dependency factory: allow only the given roles (403 otherwise)."""
    allowed = frozenset(roles)

    async def _dep(principal: Principal = Depends(current_principal)) -> Principal:
        if principal.role not in allowed:
            raise forbidden(f"Role '{principal.role}' cannot use this route")
        return principal

    return _dep


require_staff = require_roles(AGENT, EM, LEAD)
require_agent_or_lead = require_roles(AGENT, LEAD)
require_lead = require_roles(LEAD)
require_any = require_roles(*ALL_ROLES)


# --- Row-level policies ------------------------------------------------------


def scope_tickets(stmt: Select[Any], principal: Principal) -> Select[Any]:
    """Requesters only ever see their own agency's tickets; data mode picks demo vs live flights."""
    stmt = stmt.where(Ticket.is_demo.is_(principal.data_mode == "demo"))
    if principal.is_requester:
        return stmt.where(Ticket.agency_id == (principal.agency_id or "__none__"))
    return stmt


def ensure_visible(ticket: Ticket | None, principal: Principal) -> Ticket:
    """404 for missing tickets AND for tickets of another agency (never leak existence)."""
    if ticket is None:
        raise not_found("Flight")
    if principal.is_requester and ticket.agency_id != principal.agency_id:
        raise not_found("Flight")
    return ticket


def can_read_internal(principal: Principal) -> bool:
    return principal.is_staff


def ensure_can_modify(ticket: Ticket, principal: Principal) -> None:
    """Agents and leads modify any flight; Tower Chiefs only flights in escalation."""
    if principal.role in {AGENT, LEAD}:
        return
    if principal.role == EM and (ticket.status == "escalated" or ticket.escalated_to):
        return
    raise forbidden(
        "Only controllers, the Airport Director, or the Tower Chief on escalated flights"
    )
