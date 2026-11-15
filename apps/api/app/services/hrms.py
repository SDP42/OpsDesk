"""Darwinbox HRMS adapter: pull approved leave and shift changes into the Crew Roster.

Live mode (DARWINBOX_BASE_URL + DARWINBOX_API_KEY set): one date-ranged request to the
attendance/leave API, matched to controllers by work email. Darwinbox can answer 200 OK
with a partial `errors` array, so both `data` and `errors` are inspected on every call.
Simulated mode (no credentials): deterministic records so the demo always works.
Endpoint path and field names are configurable because tenants differ.
"""

from __future__ import annotations

import hashlib
from datetime import date, timedelta
from typing import Any

import httpx
from pydantic import BaseModel

from app.core.config import get_settings


class HrmsRecord(BaseModel):
    email: str
    kind: str  # leave | weekly_off | shift_change
    start: date
    end: date
    note: str = ""
    shift_start: str | None = None
    shift_end: str | None = None


class HrmsPull(BaseModel):
    mode: str  # live | simulated
    records: list[HrmsRecord]
    errors: list[str]


_KIND = {
    "leave": "leave",
    "annual leave": "leave",
    "sick leave": "leave",
    "casual leave": "leave",
    "weekly off": "weekly_off",
    "weekly_off": "weekly_off",
    "shift change": "shift_change",
    "shift_change": "shift_change",
}


def parse_darwinbox(payload: dict[str, Any]) -> HrmsPull:
    """Map a Darwinbox leave/shift response into roster records (pure, unit-tested)."""
    records: list[HrmsRecord] = []
    errors = [
        str(e.get("message", e)) if isinstance(e, dict) else str(e)
        for e in payload.get("errors", []) or []
    ]
    for row in payload.get("data", []) or []:
        status = str(row.get("status", "approved")).lower()
        if status not in {"approved", "auto approved"}:
            continue
        kind = _KIND.get(str(row.get("leave_type", row.get("type", "leave"))).lower(), "leave")
        try:
            records.append(
                HrmsRecord(
                    email=str(row["employee_email"]).lower(),
                    kind=kind,
                    start=date.fromisoformat(str(row["from_date"])[:10]),
                    end=date.fromisoformat(str(row["to_date"])[:10]),
                    note=str(row.get("reason", row.get("leave_type", ""))),
                    shift_start=row.get("shift_start"),
                    shift_end=row.get("shift_end"),
                )
            )
        except (KeyError, ValueError) as exc:
            errors.append(f"skipped row: {exc}")
    return HrmsPull(mode="live", records=records, errors=errors)


def simulated(emails: list[str], today: date) -> HrmsPull:
    """Deterministic, realistic feed: about one controller in four has leave or a shift change this fortnight."""
    out = []
    for email in emails:
        h = int(hashlib.sha1(f"{email}{today.isocalendar()[1]}".encode()).hexdigest(), 16)
        if h % 4 == 0:
            start = today + timedelta(days=h % 10)
            out.append(
                HrmsRecord(
                    email=email,
                    kind="leave",
                    start=start,
                    end=start + timedelta(days=1 + h % 3),
                    note=["Annual leave", "Sick leave", "Casual leave"][h % 3],
                )
            )
        elif h % 4 == 1:
            d = today + timedelta(days=h % 7)
            out.append(
                HrmsRecord(
                    email=email,
                    kind="shift_change",
                    start=d,
                    end=d,
                    note="Shift swap",
                    shift_start="14:00",
                    shift_end="23:00",
                )
            )
    return HrmsPull(mode="simulated", records=out, errors=[])


async def pull(emails: list[str], today: date, client: httpx.AsyncClient | None = None) -> HrmsPull:
    s = get_settings()
    if not (s.darwinbox_base_url and s.darwinbox_api_key):
        return simulated(emails, today)
    params = {"from_date": today.isoformat(), "to_date": (today + timedelta(days=14)).isoformat()}
    headers = {"Authorization": f"Bearer {s.darwinbox_api_key}", "Accept": "application/json"}
    own = client is None
    client = client or httpx.AsyncClient(base_url=s.darwinbox_base_url, timeout=15)
    try:
        r = await client.get(s.darwinbox_leave_path, params=params, headers=headers)
        if r.status_code >= 400:
            return HrmsPull(
                mode="live", records=[], errors=[f"HTTP {r.status_code} from Darwinbox"]
            )
        return parse_darwinbox(r.json())
    except httpx.HTTPError as exc:
        return HrmsPull(mode="live", records=[], errors=[f"Darwinbox unreachable: {exc}"])
    finally:
        if own:
            await client.aclose()
