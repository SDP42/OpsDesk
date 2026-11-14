"""Follow-the-Sun Autopilot: shift-change handoffs (Round two #4).

Stub for the BASE run. Backend piece: APScheduler plus a region_calendar table and a handoff brief generator.
TODO(phase-4): implement; keep it pure and return a human-readable reason.
"""

from __future__ import annotations

from pydantic import BaseModel


class HandoffPlan(BaseModel):
    ticket_id: str
    from_user_id: str | None
    to_user_id: str | None
    brief: str
    reason: str


def plan_handoffs(
    open_ticket_ids: list[str], outgoing_region: str, incoming_region: str
) -> list[HandoffPlan]:
    """Plan handoffs at shift change. TODO(phase-4)."""
    return []
