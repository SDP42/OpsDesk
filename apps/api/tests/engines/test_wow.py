from datetime import UTC, date, datetime

from app.engines.forecast import ForecastInput, forecast_breach
from app.engines.frustration import score_frustration
from app.engines.ghosts import GhostInput, score_booking
from app.engines.promises import extract_promises
from app.engines.roster import CrewMember, HrRecord, OpenFlight, effective_status, orphan_risks
from app.engines.storms import StormTicket, detect_storms

TODAY = date(2026, 11, 15)


def test_roster_leave_forces_away_and_flags_orphans() -> None:
    m = CrewMember(id="a", name="Priya", presence="online")
    rec = HrRecord(
        employee_id="a", kind="leave", start=TODAY, end=date(2026, 11, 17), note="Diwali"
    )
    s = effective_status(m, [rec], TODAY)
    assert s.availability == "away" and s.on_leave and "Diwali" in s.reason
    risks = orphan_risks([OpenFlight(id="t", number="OD-1", owner_id="a", due_at=None)], [s])
    assert risks and "reassign" in risks[0].reason


def test_roster_shift_change_moves_window() -> None:
    m = CrewMember(id="a", name="Omar", presence="online", shift_start="08:00", shift_end="17:00")
    rec = HrRecord(
        employee_id="a",
        kind="shift_change",
        start=TODAY,
        end=TODAY,
        shift_start="14:00",
        shift_end="23:00",
    )
    s = effective_status(m, [rec], TODAY)
    assert (s.shift_start, s.availability) == ("14:00", "online")


def test_ghost_risk_ranks_unconfirmed_near_checkin_high() -> None:
    risky = score_booking(
        GhostInput(
            tboh="T1",
            supplier_status="unconfirmed",
            hours_to_check_in=36,
            supplier_median_reply_minutes=300,
        )
    )
    calm = score_booking(GhostInput(tboh="T2", hours_to_check_in=200))
    assert risky.risk > 0.5 > calm.risk
    assert risky.drivers[0].feature in {
        "supplier_unconfirmed",
        "hours_to_check_in",
        "supplier_slow",
    }
    assert "T1" in risky.recommended_message and risky.reason


def test_storm_forms_from_burst_and_merges_keys() -> None:
    t0 = 1_700_000_000.0
    tickets = [
        StormTicket(
            id=f"t{i}",
            created_at_epoch=t0 + i * 60,
            keys=["hotel:Palm Crescent Resort", "theme:overbooking"],
        )
        for i in range(6)
    ]
    tickets.append(
        StormTicket(id="far", created_at_epoch=t0 + 9000, keys=["hotel:Palm Crescent Resort"])
    )
    cells = detect_storms(tickets)
    assert len(cells) == 1 and cells[0].key.startswith("hotel:") and len(cells[0].ticket_ids) == 6


def test_forecast_escalation_lowers_breach() -> None:
    r = forecast_breach(
        ForecastInput(minutes_remaining=120, history_minutes=[90, 150, 200, 260, 400])
    )
    probs = {a.action: a.breach_probability for a in r.actions}
    assert probs["escalate"] < probs["none"] and r.best_action != "none"
    assert len(r.actions[0].histogram) == 20 and r.reason


def test_frustration_detects_heat() -> None:
    hot = score_frustration(
        "Third time asking!! Still NO UPDATE, this is UNACCEPTABLE, we will switch supplier"
    )
    assert hot.band in {"heated", "boiling"} and hot.priority_bump
    assert score_frustration("Thanks, appreciate the update").band == "calm"


def test_promises_extracted_with_due_dates() -> None:
    now = datetime(2026, 11, 13, 9, 0, tzinfo=UTC).timestamp()  # Friday
    ps = extract_promises(
        "We will confirm by 5 pm IST. Your refund will be processed in 3 working days.", now
    )
    assert len(ps) >= 2 and all(p.due_epoch for p in ps)
