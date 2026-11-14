"""Vectoring: route a flight to the best controller, with a visible reason.

Spec section 8.1::

    score = W.region   * regionMatch     (exact 40, adjacent 15, none 0)
          + W.priority * priorityFit     (P1 goes to senior ranks first)
          + W.time     * onShift         (15 if on shift, else 0)
          + W.avail    * availability    (online 10, busy 4, away excluded)
          + W.skill    * skill           (up to 10)
          - W.load     * normalisedLoad  (up to 12)

The load term is expressed as *headroom* (``12 * (1 - open/capacity)``) so every
part of the breakdown is a non-negative contribution; this differs from the
spec's subtraction only by a constant, so rankings are identical.
"""

from __future__ import annotations

from datetime import datetime, time
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field

from app.core.config import REGION_ADJACENCY, REGION_LABELS, REGION_TIMEZONES, ROUTING_PRESETS

PRIORITY_POINTS = {"P1": 30.0, "P2": 20.0, "P3": 10.0, "P4": 5.0}
PRIORITY_REQUIRED_RANK = {"P1": 3, "P2": 2, "P3": 1, "P4": 1}
AGENCY_TIER_POINTS = {1: 5.0, 2: 2.0, 3: 0.0}
AVAILABILITY_POINTS = {"online": 10.0, "busy": 4.0}
REGION_EXACT, REGION_ADJACENT = 40.0, 15.0
ON_SHIFT_POINTS = 15.0
SKILL_POINTS = 10.0
LOAD_POINTS = 12.0


class RoutingTicket(BaseModel):
    id: str | None = None
    region: str
    priority: str = "P3"
    intent_code: str | None = None
    agency_tier: int = 2


class Controller(BaseModel):
    id: str
    name: str
    region: str
    languages: list[str] = Field(default_factory=list)
    shift_start: str | None = None  # "HH:MM" in the controller's regional time
    shift_end: str | None = None
    availability: str = "online"
    open_tickets: int = 0
    capacity: int = 20
    skills: list[str] = Field(default_factory=list)
    rank: int = 1


class ScorePart(BaseModel):
    key: str
    label: str
    raw: float
    weight: float
    points: float


class Candidate(BaseModel):
    id: str
    name: str
    region: str
    total: float
    parts: list[ScorePart]


class RunnerUp(BaseModel):
    id: str
    name: str
    total: float
    gap: float
    lost_on: str
    lost_by: float
    why: str


class Excluded(BaseModel):
    id: str
    name: str
    reason: str


class RoutingResult(BaseModel):
    chosen_id: str | None
    chosen_name: str | None
    queue_region: str
    preset: str
    total: float
    breakdown: list[ScorePart]
    reason: str
    runners_up: list[RunnerUp]
    excluded: list[Excluded]


def _parse_hhmm(value: str) -> time:
    hours, minutes = value.split(":")
    return time(int(hours), int(minutes))


def is_on_shift(controller: Controller, now: datetime) -> bool:
    """True when ``now`` falls in the controller's regional shift window (wraps midnight)."""
    if not controller.shift_start or not controller.shift_end:
        return True
    tz = ZoneInfo(REGION_TIMEZONES.get(controller.region, "UTC"))
    local = now.astimezone(tz).time()
    start, end = _parse_hhmm(controller.shift_start), _parse_hhmm(controller.shift_end)
    if start <= end:
        return start <= local < end
    return local >= start or local < end


def _intent_parent(code: str | None) -> str | None:
    return code.split(".")[0] if code else None


def score_controller(
    ticket: RoutingTicket,
    controller: Controller,
    now: datetime,
    weights: dict[str, float],
    is_lowest_load: bool = False,
) -> Candidate:
    """Score one controller; returns every part so the UI can draw a waterfall."""
    region_label = REGION_LABELS.get(ticket.region, ticket.region)
    parts: list[ScorePart] = []

    if controller.region == ticket.region:
        parts.append(
            ScorePart(
                key="region",
                label=f"Region match {region_label}",
                raw=REGION_EXACT,
                weight=weights["region"],
                points=0,
            )
        )
    elif controller.region in REGION_ADJACENCY.get(ticket.region, set()):
        parts.append(
            ScorePart(
                key="region",
                label=f"Adjacent region {controller.region}",
                raw=REGION_ADJACENT,
                weight=weights["region"],
                points=0,
            )
        )
    else:
        parts.append(
            ScorePart(
                key="region", label="Out of region", raw=0, weight=weights["region"], points=0
            )
        )

    base = PRIORITY_POINTS.get(ticket.priority, 10.0)
    required = PRIORITY_REQUIRED_RANK.get(ticket.priority, 1)
    if controller.rank >= required:
        fit, fit_label = 1.0, f"{ticket.priority} urgency"
    elif controller.rank == required - 1:
        fit, fit_label = 0.5, f"{ticket.priority} urgency (rank {controller.rank})"
    else:
        fit, fit_label = 0.2, f"{ticket.priority} urgency (junior)"
    parts.append(
        ScorePart(
            key="priority", label=fit_label, raw=base * fit, weight=weights["priority"], points=0
        )
    )
    tier_pts = AGENCY_TIER_POINTS.get(ticket.agency_tier, 0.0)
    parts.append(
        ScorePart(
            key="agency",
            label=f"Tier {ticket.agency_tier} agency",
            raw=tier_pts,
            weight=weights["priority"],
            points=0,
        )
    )

    on_shift = is_on_shift(controller, now)
    parts.append(
        ScorePart(
            key="time",
            label="on shift" if on_shift else "off shift",
            raw=ON_SHIFT_POINTS if on_shift else 0.0,
            weight=weights["time"],
            points=0,
        )
    )

    parts.append(
        ScorePart(
            key="avail",
            label=controller.availability,
            raw=AVAILABILITY_POINTS.get(controller.availability, 0.0),
            weight=weights["avail"],
            points=0,
        )
    )

    parent = _intent_parent(ticket.intent_code)
    has_skill = bool(
        parent and (parent in controller.skills or ticket.intent_code in controller.skills)
    )
    parts.append(
        ScorePart(
            key="skill",
            label=f"{parent} skill" if has_skill else "no intent skill",
            raw=SKILL_POINTS if has_skill else 0.0,
            weight=weights["skill"],
            points=0,
        )
    )

    ratio = min(controller.open_tickets / max(controller.capacity, 1), 1.0)
    parts.append(
        ScorePart(
            key="load",
            label="lowest load" if is_lowest_load else "load headroom",
            raw=round(LOAD_POINTS * (1.0 - ratio), 2),
            weight=weights["load"],
            points=0,
        )
    )

    for part in parts:
        part.points = round(part.raw * part.weight, 2)
    total = round(sum(p.points for p in parts), 2)
    return Candidate(
        id=controller.id, name=controller.name, region=controller.region, total=total, parts=parts
    )


def format_reason(parts: list[ScorePart], limit: int = 4) -> str:
    """One-line reason: the biggest positive contributions, e.g. "Region match UAE (+40)"."""
    positive = sorted((p for p in parts if p.points > 0), key=lambda p: p.points, reverse=True)
    return ", ".join(f"{p.label} (+{p.points:g})" for p in positive[:limit]) or "No positive signal"


def route(
    ticket: RoutingTicket,
    controllers: list[Controller],
    now: datetime,
    preset: str = "balanced",
) -> RoutingResult:
    """Pick the best controller for ``ticket``. Away controllers are never chosen."""
    weights = ROUTING_PRESETS.get(preset, ROUTING_PRESETS["balanced"])
    excluded: list[Excluded] = []
    eligible: list[Controller] = []
    for c in controllers:
        if c.availability == "away":
            excluded.append(Excluded(id=c.id, name=c.name, reason="away (availability -inf)"))
        elif c.open_tickets >= c.capacity:
            excluded.append(Excluded(id=c.id, name=c.name, reason="at capacity"))
        else:
            eligible.append(c)

    if not eligible:
        return RoutingResult(
            chosen_id=None,
            chosen_name=None,
            queue_region=ticket.region,
            preset=preset,
            total=0.0,
            breakdown=[],
            reason="No controller available; parked in triage",
            runners_up=[],
            excluded=excluded,
        )

    min_ratio = min(c.open_tickets / max(c.capacity, 1) for c in eligible)
    scored = [
        score_controller(
            ticket,
            c,
            now,
            weights,
            is_lowest_load=(c.open_tickets / max(c.capacity, 1)) == min_ratio,
        )
        for c in eligible
    ]
    load_of = {c.id: c.open_tickets / max(c.capacity, 1) for c in eligible}
    scored.sort(key=lambda s: (-s.total, load_of[s.id], s.id))
    winner = scored[0]
    winner_parts = {p.key: p for p in winner.parts}

    runners_up: list[RunnerUp] = []
    for cand in scored[1:4]:
        deficits = [
            (winner_parts[p.key].points - p.points, winner_parts[p.key], p) for p in cand.parts
        ]
        lost_by, wpart, cpart = max(deficits, key=lambda d: d[0])
        why = (
            f"{cand.name} lost {round(winner.total - cand.total, 2):g} pts; biggest gap: "
            f"{wpart.label} (+{wpart.points:g}) vs {cpart.label} (+{cpart.points:g})"
        )
        runners_up.append(
            RunnerUp(
                id=cand.id,
                name=cand.name,
                total=cand.total,
                gap=round(winner.total - cand.total, 2),
                lost_on=wpart.key,
                lost_by=round(lost_by, 2),
                why=why,
            )
        )

    winner_region = next(c.region for c in eligible if c.id == winner.id)
    return RoutingResult(
        chosen_id=winner.id,
        chosen_name=winner.name,
        queue_region=winner_region,
        preset=preset,
        total=winner.total,
        breakdown=winner.parts,
        reason=format_reason(winner.parts),
        runners_up=runners_up,
        excluded=excluded,
    )
