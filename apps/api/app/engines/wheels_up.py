"""Wheels-Up SLA: a fuel clock that drains as the guest's check-in or LCD nears.

Spec section 8.2::

    baseTarget    = { P1: 60 min, P2: 4 h, P3: 8 h, P4: 24 h }
    urgencyFactor = min over (hoursToCheckIn, hoursToLCD) of
                    <= 12 h -> 0.25 | <= 24 h -> 0.40 | <= 72 h -> 0.60 | <= 7 d -> 0.80 | else 1.00
    dueAt         = createdAt + baseTarget * urgencyFactor  (+ paused holiday hours)
    elapsed%      = (now - createdAt) / (dueAt - createdAt)
    state         = ok (<60%) | at_risk (60-85%) | critical (>=85%) | breached (>100%)

Hours to check-in / LCD are measured from *now*, so the deadline tightens in
steps as the departure approaches, exactly like fuel burning down.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from pydantic import BaseModel

from app.core.config import (
    SLA_AT_RISK_PCT,
    SLA_BASE_MINUTES,
    SLA_CRITICAL_PCT,
    SLA_URGENCY_STEPS,
)


class SlaInput(BaseModel):
    created_at: datetime
    now: datetime
    priority: str = "P3"
    check_in: datetime | None = None
    lcd: datetime | None = None
    holiday_hours: float = 0.0
    resolved_at: datetime | None = None


class SlaResult(BaseModel):
    due_at: datetime
    state: str
    elapsed_pct: float
    fuel: float  # 1.0 full tank .. 0.0 empty
    remaining_seconds: int
    base_minutes: int
    urgency_factor: float
    urgency_driver: str
    holiday_paused: bool
    propose_escalation: bool
    reason: str


def _hours_until(target: datetime | None, now: datetime) -> float | None:
    if target is None:
        return None
    hours = (target - now).total_seconds() / 3600
    return hours if hours > 0 else None


def urgency_factor(hours: float | None) -> float:
    if hours is None:
        return 1.0
    for limit, factor in SLA_URGENCY_STEPS:
        if hours <= limit:
            return factor
    return 1.0


def state_for(elapsed_pct: float) -> str:
    if elapsed_pct > 100:
        return "breached"
    if elapsed_pct >= SLA_CRITICAL_PCT:
        return "critical"
    if elapsed_pct >= SLA_AT_RISK_PCT:
        return "at_risk"
    return "ok"


def _fmt_hours(hours: float) -> str:
    return f"{hours:.0f}h" if hours >= 1 else f"{hours * 60:.0f}m"


def compute_sla(data: SlaInput) -> SlaResult:
    """Compute the deadline, state and fuel level for one ticket."""
    base = SLA_BASE_MINUTES.get(data.priority, SLA_BASE_MINUTES["P3"])
    h_checkin = _hours_until(data.check_in, data.now)
    h_lcd = _hours_until(data.lcd, data.now)
    candidates = [(h, "check-in") for h in [h_checkin] if h is not None]
    candidates += [(h, "LCD") for h in [h_lcd] if h is not None]
    if candidates:
        nearest_hours, nearest_label = min(candidates, key=lambda c: c[0])
        factor = urgency_factor(nearest_hours)
        driver = f"{nearest_label} in {_fmt_hours(nearest_hours)}"
    else:
        nearest_hours, factor, driver = None, 1.0, "no travel date"

    target = timedelta(minutes=base * factor)
    paused = data.holiday_hours > 0
    due_at = data.created_at + target + timedelta(hours=data.holiday_hours)
    span = max((due_at - data.created_at).total_seconds(), 1.0)
    clock = data.resolved_at or data.now
    elapsed = (clock - data.created_at).total_seconds()
    elapsed_pct = round(elapsed / span * 100, 1)

    if data.resolved_at is not None:
        state = "met" if data.resolved_at <= due_at else "breached"
    else:
        state = state_for(elapsed_pct)

    remaining = int((due_at - data.now).total_seconds())
    fuel = max(0.0, min(1.0, 1 - elapsed_pct / 100))
    propose = (
        data.resolved_at is None
        and state in {"critical", "breached"}
        and data.priority in {"P1", "P2"}
        and h_checkin is not None
        and h_checkin <= 12
    )
    reason = (
        f"{data.priority} base {base}m x {factor:g} ({driver}) = {target.total_seconds() / 60:.0f}m"
        f"{f' + {data.holiday_hours:g}h holiday pause' if paused else ''}; "
        f"{elapsed_pct:g}% elapsed -> {state}"
    )
    return SlaResult(
        due_at=due_at,
        state=state,
        elapsed_pct=elapsed_pct,
        fuel=round(fuel, 3),
        remaining_seconds=remaining,
        base_minutes=base,
        urgency_factor=factor,
        urgency_driver=driver,
        holiday_paused=paused,
        propose_escalation=propose,
        reason=reason,
    )
