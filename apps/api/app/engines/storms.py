"""Storm Cells: auto-incident detection (Round two #3).

Stub for the BASE run. Backend piece: Sliding-window clustering plus networkx incident graph; SSE 'storm' event.
TODO(phase-4): implement; keep it pure and return a human-readable reason.
"""

from __future__ import annotations

from pydantic import BaseModel


class StormTicket(BaseModel):
    id: str
    supplier_id: str | None = None
    destination: str | None = None
    theme: str | None = None
    created_at_epoch: float = 0.0


class StormCell(BaseModel):
    key: str
    ticket_ids: list[str]
    reason: str


def detect_storms(
    tickets: list[StormTicket], window_minutes: int = 60, threshold: int = 5
) -> list[StormCell]:
    """Group >= threshold tickets sharing a key within the window. TODO(phase-4)."""
    return []
