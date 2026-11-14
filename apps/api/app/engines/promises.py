"""Promise Tracker: extract commitments from messages (Round two #5).

Stub for the BASE run. Backend piece: Regex plus dateparser; promises table.
TODO(phase-4): implement; keep it pure and return a human-readable reason.
"""

from __future__ import annotations

from pydantic import BaseModel


class Promise(BaseModel):
    text: str
    due_epoch: float | None = None
    reason: str


def extract_promises(message: str, now_epoch: float) -> list[Promise]:
    """Find 'will confirm by 5 pm IST' style commitments. TODO(phase-4)."""
    return []
