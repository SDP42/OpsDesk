from datetime import UTC, date, datetime

from app.engines.follow_the_sun import HandoffController, HandoffFlight, non_working, plan_handoffs

NOW = datetime(2026, 11, 16, 10, 0, tzinfo=UTC)  # a Monday


def test_regional_calendars() -> None:
    assert non_working("IN", date(2026, 1, 26))  # Republic Day
    assert "weekend" in (non_working("AE", date(2026, 11, 13)) or "")  # Friday in the UAE
    assert non_working("UK", date(2026, 11, 16)) is None


def test_urgent_flight_moves_to_on_shift_controller_with_brief() -> None:
    flights = [
        HandoffFlight(
            id="1",
            number="OD-1",
            title="Voucher missing",
            owner_id="off",
            owner_region="IN",
            owner_on_shift=False,
            hours_to_deadline=6,
            sla_state="at_risk",
            open_promises=1,
        ),
        HandoffFlight(
            id="2",
            number="OD-2",
            title="Not urgent",
            owner_id="off",
            owner_region="IN",
            owner_on_shift=False,
            hours_to_deadline=200,
            sla_state="ok",
        ),
    ]
    team = [
        HandoffController(id="a", name="Omar", region="AE", on_shift=True, available=True, load=3),
        HandoffController(id="b", name="Wei", region="SEA", on_shift=True, available=True, load=1),
        HandoffController(id="c", name="Off", region="UK", on_shift=False, available=True, load=0),
    ]
    plans = plan_handoffs(flights, team, NOW)
    assert len(plans) == 1 and plans[0].to_user_id == "b"
    assert "Handoff Brief for OD-1" in plans[0].brief and "promise" in plans[0].brief
    assert plans[0].reason
