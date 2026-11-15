"""Ask the Tower: plain-English queries become explainable filter chips.

Deterministic parser: region, SLA state, status, priority, intent family, TBOH,
agency and check-in windows from small lexicons plus dateparser-free date words.
Every chip says which words produced it, so the query stays explainable.
"""

from __future__ import annotations

import re

from pydantic import BaseModel

REGION = {
    "india": "IN",
    "mumbai": "IN",
    "delhi": "IN",
    "uae": "AE",
    "dubai": "AE",
    "abu dhabi": "AE",
    "uk": "UK",
    "london": "UK",
    "singapore": "SEA",
    "sea": "SEA",
    "south-east asia": "SEA",
    "bangkok": "SEA",
}
SLA = {
    "breached": "breached",
    "overdue": "breached",
    "late": "breached",
    "critical": "critical",
    "at risk": "at_risk",
    "risky": "at_risk",
    "on course": "ok",
    "healthy": "ok",
}
STATUS = {
    "escalated": "escalated",
    "with tower chief": "escalated",
    "pending": "pending",
    "on hold": "pending",
    "resolved": "resolved",
    "closed": "closed",
    "new": "new",
    "unassigned": "triage",
    "triage": "triage",
    "open": "open",
}
INTENT = {
    "refund": "refund",
    "cancel": "cancellation",
    "amend": "amendment",
    "voucher": "voucher",
    "payment": "payment",
    "rate": "rates",
    "inventory": "rates",
    "overbook": "supplier",
    "supplier": "supplier",
    "special request": "special_request",
    "visa": "visa",
    "login": "platform",
    "api": "platform",
}
WINDOW = {
    "today": 1,
    "tomorrow": 2,
    "next 48 hours": 2,
    "this week": 7,
    "next week": 14,
    "this month": 31,
}


class Chip(BaseModel):
    key: str
    value: str
    label: str
    because: str


class ParsedQuery(BaseModel):
    filters: dict[str, str]
    chips: list[Chip]
    reason: str


def _first(q: str, table: dict[str, str]) -> tuple[str, str] | None:
    for word in sorted(table, key=len, reverse=True):
        if re.search(rf"(?<![a-z]){re.escape(word)}", q):
            return word, table[word]
    return None


def parse_query(text: str) -> ParsedQuery:
    q = text.lower().strip()
    chips: list[Chip] = []

    def add(key: str, value: str, label: str, because: str) -> None:
        chips.append(Chip(key=key, value=value, label=label, because=because))

    if m := re.search(r"\btboh-?\s?(\d{3,10})\b", q):
        add("tboh", f"TBOH-{m.group(1)}", f"Booking TBOH-{m.group(1)}", m.group(0))
    if m := re.search(r"\bp([1-4])\b", q):
        add("priority", f"P{m.group(1)}", f"Priority P{m.group(1)}", m.group(0))
    elif "urgent" in q:
        add("priority", "P1", "Priority P1", "urgent")
    if hit := _first(q, REGION):
        add("region", hit[1], f"Region {hit[1]}", hit[0])
    if hit := _first(q, SLA):
        add("sla_state", hit[1], f"SLA {hit[1].replace('_', ' ')}", hit[0])
    if hit := _first(q, STATUS):
        if hit[1] == "triage":
            add("view", "triage", "Unassigned (triage)", hit[0])
        else:
            add("status", hit[1], f"Status {hit[1]}", hit[0])
    if hit := _first(q, INTENT):
        add("intent", hit[1], f"Intent {hit[1].replace('_', ' ')}", hit[0])
    if re.search(r"check.?in|arriv|travel", q) and (
        hit := _first(q, {k: str(v) for k, v in WINDOW.items()})
    ):
        add("checkin_within_days", hit[1], f"Check-in within {hit[1]} day(s)", hit[0])
    if "mine" in q or "my " in q:
        add("view", "mine", "Assigned to me", "my / mine")

    filters = {c.key: c.value for c in chips}
    reason = (
        ("Read as: " + "; ".join(f"'{c.because}' → {c.label}" for c in chips))
        if chips
        else "No filters recognised; try a region, SLA state, priority or intent"
    )
    return ParsedQuery(filters=filters, chips=chips, reason=reason)
