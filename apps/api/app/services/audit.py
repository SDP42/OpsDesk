"""Audit trail and timeline helpers: every mutation writes both."""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import Principal
from app.db.base import utcnow
from app.db.models import AuditLog, TimelineEvent


def audit(
    session: AsyncSession,
    actor: Principal | None,
    action: str,
    entity: str,
    entity_id: str | None,
    meta: dict[str, Any] | None = None,
    ip: str | None = None,
) -> None:
    session.add(
        AuditLog(
            actor_id=actor.id if actor else None,
            action=action,
            entity=entity,
            entity_id=entity_id,
            meta=meta or {},
            ip=ip,
            at=utcnow(),
        )
    )


def timeline(
    session: AsyncSession,
    ticket_id: str,
    type_: str,
    actor: Principal | None,
    payload: dict[str, Any] | None = None,
) -> TimelineEvent:
    event = TimelineEvent(
        ticket_id=ticket_id,
        type=type_,
        actor_id=actor.id if actor else None,
        payload=payload or {},
        at=utcnow(),
    )
    session.add(event)
    return event
