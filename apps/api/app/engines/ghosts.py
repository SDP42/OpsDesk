"""Ghost Flights: predict tickets before the agency writes in (Round two #1).

Stub for the BASE run. Backend piece: risk_scorer using gradient boosting over booking features; APScheduler every 5 minutes; GET /ghosts.
TODO(phase-4): implement; keep it pure and return a human-readable reason.
"""

from __future__ import annotations

from pydantic import BaseModel


class GhostInput(BaseModel):
    tboh: str
    supplier_status: str = "confirmed"
    hours_to_check_in: float = 999.0
    rate_changed: bool = False
    agency_repeat_contacts: int = 0


class GhostPrediction(BaseModel):
    tboh: str
    risk: float
    recommended_message: str
    reason: str


def score_booking(data: GhostInput) -> GhostPrediction:
    """Score one booking's risk of becoming a ticket. TODO(phase-4): gradient boosting."""
    return GhostPrediction(
        tboh=data.tboh, risk=0.0, recommended_message="", reason="stub: not implemented"
    )
