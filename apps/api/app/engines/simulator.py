"""Routing What-If Simulator: replay a day's flights under each routing preset.

Pure discrete-event replay: flights arrive in order, Vectoring picks a controller
with the preset's weights (load updates as the day goes), each controller works
their queue first-in-first-out, and a flight breaches if it finishes after its
Wheels-Up deadline. Handle time grows when the controller lacks the intent skill
or works out of region, so presets trade speed against fairness visibly.
"""

from __future__ import annotations

import statistics
from datetime import datetime, timedelta

from pydantic import BaseModel

from app.engines import vectoring
from app.engines.wheels_up import SlaInput, compute_sla

BASE_HANDLE_MINUTES = {"P1": 25.0, "P2": 35.0, "P3": 45.0, "P4": 50.0}


class SimFlight(BaseModel):
    id: str
    region: str
    priority: str
    intent_code: str | None = None
    agency_tier: int = 2
    created_at: datetime
    check_in: datetime | None = None
    lcd: datetime | None = None


class PresetOutcome(BaseModel):
    preset: str
    flights: int
    breaches: int
    breach_rate: float
    avg_wait_minutes: float
    region_match_pct: float
    load: dict[str, int]
    load_spread: float
    unrouted: int
    reason: str


class SimulationResult(BaseModel):
    outcomes: list[PresetOutcome]
    best_preset: str
    reason: str


def _handle(flight: SimFlight, c: vectoring.Controller) -> float:
    t = BASE_HANDLE_MINUTES.get(flight.priority, 45.0)
    parent = (flight.intent_code or "").split(".")[0]
    if parent and parent not in c.skills:
        t *= 1.4
    if c.region != flight.region:
        t *= 1.25
    return t * (1.0 if c.rank >= 3 else 1.1 if c.rank == 2 else 1.25)


def simulate(
    flights: list[SimFlight], controllers: list[vectoring.Controller], preset: str
) -> PresetOutcome:
    ordered = sorted(flights, key=lambda f: f.created_at)
    team = {c.id: c.model_copy(update={"open_tickets": 0}) for c in controllers}
    free_at: dict[str, datetime] = {}
    load: dict[str, int] = {c.name: 0 for c in controllers}
    breaches = unrouted = region_hits = 0
    waits: list[float] = []
    for f in ordered:
        result = vectoring.route(
            vectoring.RoutingTicket(
                region=f.region,
                priority=f.priority,
                intent_code=f.intent_code,
                agency_tier=f.agency_tier,
            ),
            list(team.values()),
            f.created_at,
            preset,
        )
        sla = compute_sla(
            SlaInput(
                created_at=f.created_at,
                now=f.created_at,
                priority=f.priority,
                check_in=f.check_in,
                lcd=f.lcd,
            )
        )
        if not result.chosen_id:
            unrouted += 1
            breaches += 1
            continue
        c = team[result.chosen_id]
        start = max(f.created_at, free_at.get(c.id, f.created_at))
        finish = start + timedelta(minutes=_handle(f, c))
        free_at[c.id] = finish
        c.open_tickets += 1
        load[c.name] += 1
        waits.append((start - f.created_at).total_seconds() / 60)
        region_hits += c.region == f.region
        breaches += finish > sla.due_at
    n = len(ordered) or 1
    loads = list(load.values()) or [0]
    spread = round(statistics.pstdev(loads), 2)
    rate = round(breaches / n, 3)
    return PresetOutcome(
        preset=preset,
        flights=len(ordered),
        breaches=breaches,
        breach_rate=rate,
        avg_wait_minutes=round(statistics.fmean(waits), 1) if waits else 0.0,
        region_match_pct=round(region_hits / max(len(waits), 1) * 100, 1),
        load=load,
        load_spread=spread,
        unrouted=unrouted,
        reason=f"{breaches}/{len(ordered)} breached ({rate:.0%}), average wait {statistics.fmean(waits) if waits else 0:.0f} min, "
        f"load spread {spread} flights, {region_hits / max(len(waits), 1):.0%} handled in-region",
    )


def compare(
    flights: list[SimFlight], controllers: list[vectoring.Controller], presets: list[str]
) -> SimulationResult:
    outcomes = [simulate(flights, controllers, p) for p in presets]
    best = min(outcomes, key=lambda o: (o.breaches, o.avg_wait_minutes, o.load_spread))
    worst = max(outcomes, key=lambda o: o.breaches)
    saved = worst.breaches - best.breaches
    reason = (
        f"Replaying {best.flights} flights: '{best.preset.replace('_', ' ')}' gives the fewest breaches ({best.breaches})"
        + (
            f", {saved} fewer than '{worst.preset.replace('_', ' ')}'"
            if saved > 0
            else "; presets tie on breaches"
        )
    )
    return SimulationResult(outcomes=outcomes, best_preset=best.preset, reason=reason)
