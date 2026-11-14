"""Ask the Tower: plain-English queries to filter chips (Round two #10).

Stub for the BASE run. Backend piece: Deterministic parser (dateparser plus intent, region and status lexicons); LLM optional.
TODO(phase-4): implement; keep it pure and return a human-readable reason.
"""

from __future__ import annotations

from pydantic import BaseModel


class ParsedQuery(BaseModel):
    filters: dict[str, str]
    chips: list[str]
    reason: str


def parse_query(text: str) -> ParsedQuery:
    """Parse 'breached tickets in UAE this week'. TODO(phase-4)."""
    return ParsedQuery(filters={}, chips=[], reason="stub: not implemented")
