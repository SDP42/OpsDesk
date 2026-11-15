"""Crew Roster: HRMS (Darwinbox-style) leave, weekly-off and shift data drives availability.

Today the helpdesk and the HR system never talk, so tickets get routed to people who
are on leave. This pure engine merges HRMS records with live presence and returns, per
controller, the effective availability for routing plus a plain reason, and flags
flights whose owner will be away before the flight's deadline ("orphan risk").
"""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel


class HrRecord(BaseModel):
    employee_id: str
    kind: str  # "leave" | "weekly_off" | "shift_change"
    start: date
    end: date
    note: str = ""
    shift_start: str | None = None  # for shift_change
    shift_end: str | None = None


class CrewMember(BaseModel):
    id: str
    name: str
    presence: str  # online | busy | away (self-reported)
    shift_start: str | None = None
    shift_end: str | None = None


class CrewStatus(BaseModel):
    id: str
    name: str
    availability: str  # online | busy | away
    on_leave: bool
    returns_on: date | None
    shift_start: str | None
    shift_end: str | None
    source: str  # "hrms" | "presence"
    reason: str


class OpenFlight(BaseModel):
    id: str
    number: str
    owner_id: str | None
    due_at: datetime | None


class OrphanRisk(BaseModel):
    ticket_id: str
    number: str
    owner_id: str
    reason: str


def effective_status(member: CrewMember, records: list[HrRecord], today: date) -> CrewStatus:
    """HRMS wins over self-reported presence: leave or weekly off forces 'away'."""
    mine = [r for r in records if r.employee_id == member.id and r.start <= today <= r.end]
    leave = next((r for r in mine if r.kind in {"leave", "weekly_off"}), None)
    shift = next((r for r in mine if r.kind == "shift_change"), None)
    s_start = shift.shift_start if shift and shift.shift_start else member.shift_start
    s_end = shift.shift_end if shift and shift.shift_end else member.shift_end
    if leave:
        label = "on leave" if leave.kind == "leave" else "weekly off"
        return CrewStatus(id=member.id, name=member.name, availability="away", on_leave=True,
                          returns_on=leave.end, shift_start=s_start, shift_end=s_end, source="hrms",
                          reason=f"HRMS: {label} until {leave.end.isoformat()}" + (f" ({leave.note})" if leave.note else ""))
    reason = f"Presence: {member.presence}" + (f"; HRMS shift moved to {s_start}-{s_end}" if shift else "")
    return CrewStatus(id=member.id, name=member.name, availability=member.presence, on_leave=False,
                      returns_on=None, shift_start=s_start, shift_end=s_end,
                      source="hrms" if shift else "presence", reason=reason)


def orphan_risks(flights: list[OpenFlight], statuses: list[CrewStatus]) -> list[OrphanRisk]:
    """Open flights owned by someone the HRMS says is away: they need a new owner."""
    away = {s.id: s for s in statuses if s.on_leave}
    out = []
    for f in flights:
        if f.owner_id and f.owner_id in away:
            s = away[f.owner_id]
            out.append(OrphanRisk(ticket_id=f.id, number=f.number, owner_id=f.owner_id,
                                  reason=f"{s.name} is {s.reason.split(': ', 1)[1]}; reassign before the deadline"))
    return out
