"""Promise Tracker: extract commitments ("will confirm by 5 pm IST", "refund in 3 working days")."""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta

import dateparser
from pydantic import BaseModel

_PATTERNS = [
    re.compile(
        r"\b(?:will|we'll|shall|going to)\b[^.!?]{0,80}?\b(?:by|before|within|in)\b\s+([^.!?,;]{2,40})",
        re.I,
    ),
    re.compile(
        r"\b(?:refund|update|confirmation|voucher)\b[^.!?]{0,40}?\bin\s+(\d+\s+(?:working\s+)?(?:hours?|days?))",
        re.I,
    ),
]


class Promise(BaseModel):
    text: str
    due_epoch: float | None = None
    reason: str


def _parse_due(phrase: str, now: datetime) -> datetime | None:
    m = re.match(r"(\d+)\s+working\s+days?", phrase, re.I)
    if m:
        d, added = now, 0
        while added < int(m.group(1)):
            d += timedelta(days=1)
            if d.weekday() < 5:
                added += 1
        return d
    m = re.match(r"(?:the\s+)?next\s+(\d+)\s+(hours?|days?)", phrase, re.I) or re.match(
        r"(\d+)\s+(hours?|days?)", phrase, re.I
    )
    if m:
        n = int(m.group(1))
        return now + (
            timedelta(hours=n) if m.group(2).lower().startswith("hour") else timedelta(days=n)
        )
    parsed = dateparser.parse(
        phrase,
        settings={
            "RELATIVE_BASE": now.replace(tzinfo=None),
            "PREFER_DATES_FROM": "future",
            "RETURN_AS_TIMEZONE_AWARE": True,
            "TIMEZONE": "Asia/Kolkata",
        },
    )
    return parsed.astimezone(UTC) if parsed else None


def extract_promises(message: str, now_epoch: float) -> list[Promise]:
    now = datetime.fromtimestamp(now_epoch, UTC)
    found: list[Promise] = []
    for pat in _PATTERNS:
        for m in pat.finditer(message):
            due = _parse_due(m.group(1).strip(), now)
            found.append(
                Promise(
                    text=m.group(0).strip(),
                    due_epoch=due.timestamp() if due else None,
                    reason=f"Commitment phrase '{m.group(1).strip()}'"
                    + (f" -> due {due:%d %b %H:%M} UTC" if due else " (no date)"),
                )
            )
    return found
