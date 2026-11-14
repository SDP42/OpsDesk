"""Ticket status state machine: New > Open > Pending > Escalated > Resolved > Closed."""

from __future__ import annotations

from pydantic import BaseModel

TRANSITIONS: dict[str, frozenset[str]] = {
    "new": frozenset({"open", "pending", "escalated", "resolved"}),
    "open": frozenset({"pending", "escalated", "resolved"}),
    "pending": frozenset({"open", "escalated", "resolved"}),
    "escalated": frozenset({"open", "pending", "resolved"}),
    "resolved": frozenset({"closed", "open"}),
    "closed": frozenset(),
}

OPEN_STATUSES = frozenset({"new", "open", "pending", "escalated"})


class TransitionResult(BaseModel):
    allowed: bool
    reason: str


def can_transition(current: str, target: str) -> TransitionResult:
    """Return whether ``current -> target`` is allowed, with a reason either way."""
    if current not in TRANSITIONS:
        return TransitionResult(allowed=False, reason=f"Unknown status '{current}'")
    if target not in TRANSITIONS:
        return TransitionResult(allowed=False, reason=f"Unknown status '{target}'")
    if current == target:
        return TransitionResult(allowed=False, reason=f"Flight is already {current}")
    if target in TRANSITIONS[current]:
        return TransitionResult(allowed=True, reason=f"{current} -> {target} is a valid transition")
    allowed = ", ".join(sorted(TRANSITIONS[current])) or "nothing (terminal)"
    return TransitionResult(
        allowed=False, reason=f"Cannot move from {current} to {target}; allowed: {allowed}"
    )


def bump_priority(priority: str) -> str:
    """Raise priority by one level (P4 -> P3 ... P1 stays P1)."""
    order = ["P1", "P2", "P3", "P4"]
    idx = order.index(priority) if priority in order else 2
    return order[max(0, idx - 1)]
