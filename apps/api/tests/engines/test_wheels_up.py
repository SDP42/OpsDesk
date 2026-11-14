from datetime import UTC, datetime, timedelta

import pytest

from app.engines.wheels_up import SlaInput, compute_sla, state_for, urgency_factor

NOW = datetime(2026, 11, 14, 10, 0, tzinfo=UTC)


@pytest.mark.parametrize(
    ("pct", "state"),
    [(59, "ok"), (59.9, "ok"), (60, "at_risk"), (84.9, "at_risk"), (85, "critical"),
     (100, "critical"), (101, "breached")],
)
def test_state_thresholds(pct: float, state: str) -> None:
    assert state_for(pct) == state


@pytest.mark.parametrize(("elapsed_min", "state"), [(141.6, "ok"), (144, "at_risk"),
                                                    (204, "critical"), (242.4, "breached")])
def test_state_from_elapsed_time_p2(elapsed_min: float, state: str) -> None:
    # P2, no travel dates -> 240 minute target. 59%, 60%, 85%, 101%.
    created = NOW - timedelta(minutes=elapsed_min)
    assert compute_sla(SlaInput(created_at=created, now=NOW, priority="P2")).state == state


@pytest.mark.parametrize(("hours", "factor"), [(5, 0.25), (12, 0.25), (20, 0.40), (48, 0.60),
                                               (100, 0.80), (500, 1.0), (None, 1.0)])
def test_urgency_factor_steps(hours: float | None, factor: float) -> None:
    assert urgency_factor(hours) == factor


def test_checkin_in_nine_hours_compresses_deadline() -> None:
    created = NOW - timedelta(minutes=52)
    result = compute_sla(SlaInput(created_at=created, now=NOW, priority="P2",
                                  check_in=NOW + timedelta(hours=9)))
    assert result.urgency_factor == 0.25
    assert result.due_at == created + timedelta(minutes=60)
    assert result.state == "critical"
    assert result.propose_escalation
    assert "check-in in 9h" in result.reason


def test_lcd_nearer_than_checkin_drives_factor() -> None:
    result = compute_sla(SlaInput(created_at=NOW, now=NOW, priority="P3",
                                  check_in=NOW + timedelta(days=20),
                                  lcd=NOW + timedelta(hours=30)))
    assert result.urgency_factor == 0.60
    assert result.urgency_driver.startswith("LCD")


def test_holiday_pause_extends_deadline() -> None:
    plain = compute_sla(SlaInput(created_at=NOW, now=NOW, priority="P1"))
    paused = compute_sla(SlaInput(created_at=NOW, now=NOW, priority="P1", holiday_hours=24))
    assert paused.due_at - plain.due_at == timedelta(hours=24)
    assert paused.holiday_paused


def test_resolved_ticket_is_met_or_breached() -> None:
    created = NOW - timedelta(hours=2)
    met = compute_sla(SlaInput(created_at=created, now=NOW, priority="P2",
                               resolved_at=created + timedelta(hours=1)))
    late = compute_sla(SlaInput(created_at=created, now=NOW, priority="P1",
                                resolved_at=created + timedelta(hours=2)))
    assert met.state == "met"
    assert late.state == "breached"


def test_fuel_drains() -> None:
    fresh = compute_sla(SlaInput(created_at=NOW, now=NOW, priority="P3"))
    half = compute_sla(SlaInput(created_at=NOW - timedelta(hours=4), now=NOW, priority="P3"))
    assert fresh.fuel == 1.0
    assert half.fuel == pytest.approx(0.5)
