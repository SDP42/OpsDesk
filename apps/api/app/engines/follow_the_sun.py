"""Follow-the-Sun Autopilot: hand urgent flights to the region whose day is starting.

At shift change, open flights near check-in or LCD owned by controllers going off shift
move to controllers who are on shift now, each with an auto-written Handoff Brief.
Regional public holidays (from the open-source `holidays` calendars) and weekends
(Friday-Saturday in the UAE) count as non-working days for the receiving region.
"""

from __future__ import annotations

from datetime import date, datetime

import holidays
from pydantic import BaseModel

COUNTRY = {"IN": "IN", "AE": "AE", "UK": "GB", "SEA": "SG"}
WEEKEND = {"AE": {4, 5}}  # Fri, Sat; others Sat, Sun


class HandoffFlight(BaseModel):
    id: str
    number: str
    title: str
    owner_id: str | None
    owner_region: str | None
    owner_on_shift: bool
    hours_to_deadline: float | None  # min(check-in, LCD, SLA due) in hours
    sla_state: str
    last_update: str | None = None
    open_promises: int = 0


class HandoffController(BaseModel):
    id: str
    name: str
    region: str
    on_shift: bool
    available: bool
    load: int


class HandoffPlan(BaseModel):
    ticket_id: str
    number: str
    from_user_id: str | None
    to_user_id: str | None
    to_name: str | None
    brief: str
    reason: str


def non_working(region: str, day: date) -> str | None:
    """Return the reason a region is off on ``day`` (holiday or weekend), else None."""
    country = COUNTRY.get(region)
    if country:
        name = holidays.country_holidays(country, years=day.year).get(day)
        if name:
            return f"{name} ({region} public holiday)"
    if day.weekday() in WEEKEND.get(region, {5, 6}):
        return f"weekend in {region}"
    return None


def plan_handoffs(
    flights: list[HandoffFlight],
    controllers: list[HandoffController],
    now: datetime,
    horizon_hours: float = 24.0,
) -> list[HandoffPlan]:
    """Pick urgent flights whose owner is off shift and assign each to the least-loaded on-shift controller."""
    today = now.date()
    pool = [
        c for c in controllers if c.on_shift and c.available and not non_working(c.region, today)
    ]
    load = {c.id: c.load for c in pool}
    plans: list[HandoffPlan] = []
    urgent = sorted(
        (
            f
            for f in flights
            if not f.owner_on_shift and (f.hours_to_deadline or 1e9) <= horizon_hours
        ),
        key=lambda f: f.hours_to_deadline or 1e9,
    )
    for f in urgent:
        if not pool:
            plans.append(
                HandoffPlan(
                    ticket_id=f.id,
                    number=f.number,
                    from_user_id=f.owner_id,
                    to_user_id=None,
                    to_name=None,
                    brief="",
                    reason="No controller is on shift in a working region right now",
                )
            )
            continue
        same = [c for c in pool if c.region == f.owner_region]
        target = min(same or pool, key=lambda c: (load[c.id], c.name))
        load[target.id] += 1
        hours = f"{f.hours_to_deadline:.0f}h" if f.hours_to_deadline is not None else "no deadline"
        brief = (
            f"Handoff Brief for {f.number}: {f.title}. Deadline in {hours}, SLA {f.sla_state.replace('_', ' ')}."
            + (f" Last update: {f.last_update[:140]}" if f.last_update else " No reply sent yet.")
            + (f" {f.open_promises} open promise(s) to keep." if f.open_promises else "")
        )
        off = non_working(f.owner_region or "", today)
        why = (
            "previous owner is off shift"
            + (f" ({off})" if off else "")
            + f"; {target.name} is on shift in {target.region} with the lightest load ({load[target.id] - 1})"
        )
        plans.append(
            HandoffPlan(
                ticket_id=f.id,
                number=f.number,
                from_user_id=f.owner_id,
                to_user_id=target.id,
                to_name=target.name,
                brief=brief,
                reason=why,
            )
        )
    return plans
