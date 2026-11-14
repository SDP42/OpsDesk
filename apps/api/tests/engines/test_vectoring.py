from datetime import UTC, datetime

import pytest

from app.engines.vectoring import Controller, RoutingTicket, format_reason, is_on_shift, route

# 10:00 UTC = 14:00 Dubai = 15:30 Mumbai = 10:00 London = 18:00 Singapore
NOW = datetime(2026, 11, 14, 10, 0, tzinfo=UTC)


def ctl(id_: str, region: str, **kw) -> Controller:
    base = dict(name=id_.title(), shift_start="08:00", shift_end="20:00", rank=2,
                capacity=20, open_tickets=5, skills=["refund"], availability="online")
    base.update(kw)
    return Controller(id=id_, region=region, **base)


TEAM = [
    ctl("priya", "IN", rank=3),
    ctl("arjun", "IN", open_tickets=12),
    ctl("omar", "AE", rank=3, open_tickets=3),
    ctl("layla", "AE", open_tickets=9),
    ctl("james", "UK"),
    ctl("wei", "SEA", shift_start="22:00", shift_end="06:00"),
]

CASES = [
    # (ticket, expected controller)
    (RoutingTicket(region="AE", priority="P1", intent_code="refund.delay"), "omar"),
    (RoutingTicket(region="IN", priority="P1", intent_code="refund.status"), "priya"),
    (RoutingTicket(region="UK", priority="P3", intent_code="voucher.not_received"), "james"),
    (RoutingTicket(region="AE", priority="P4", intent_code="refund.status"), "omar"),
    (RoutingTicket(region="IN", priority="P2", intent_code="cancellation.request"), "priya"),
    # SEA controller off shift -> adjacent India senior wins
    (RoutingTicket(region="SEA", priority="P1", intent_code="refund.delay"), "priya"),
]


@pytest.mark.parametrize(("ticket", "expected"), CASES)
def test_route_picks_expected_controller(ticket: RoutingTicket, expected: str) -> None:
    result = route(ticket, TEAM, NOW)
    assert result.chosen_id == expected
    assert result.reason and "(+" in result.reason


def test_away_controller_is_never_chosen() -> None:
    team = [ctl("omar", "AE", rank=3, availability="away"), ctl("layla", "AE")]
    result = route(RoutingTicket(region="AE", priority="P1"), team, NOW)
    assert result.chosen_id == "layla"
    assert result.excluded[0].id == "omar"


def test_no_controllers_parks_in_triage() -> None:
    result = route(RoutingTicket(region="AE", priority="P1"), [], NOW)
    assert result.chosen_id is None
    assert "triage" in result.reason


def test_reason_matches_spec_shape_for_dubai_p1() -> None:
    result = route(RoutingTicket(region="AE", priority="P1", intent_code="refund.delay"), TEAM, NOW)
    assert result.reason.startswith("Region match UAE (+40), P1 urgency (+30), on shift (+15)")


def test_runners_up_explain_why_they_lost() -> None:
    result = route(RoutingTicket(region="AE", priority="P1"), TEAM, NOW)
    assert result.runners_up
    assert all(r.why and r.gap >= 0 for r in result.runners_up)


def test_fairness_preset_prefers_lighter_load() -> None:
    team = [ctl("a", "AE", open_tickets=18, rank=3), ctl("b", "AE", open_tickets=0, rank=3)]
    ticket = RoutingTicket(region="AE", priority="P3")
    assert route(ticket, team, NOW, preset="fairness").chosen_id == "b"


def test_regional_affinity_doubles_region_weight() -> None:
    result = route(RoutingTicket(region="UK", priority="P2"), TEAM, NOW, preset="regional_affinity")
    region_part = next(p for p in result.breakdown if p.key == "region")
    assert region_part.points == 80


def test_shift_window_wraps_midnight() -> None:
    night = ctl("n", "SEA", shift_start="22:00", shift_end="06:00")
    assert not is_on_shift(night, NOW)  # 18:00 SGT
    assert is_on_shift(night, datetime(2026, 11, 14, 16, 0, tzinfo=UTC))  # 00:00 SGT


def test_format_reason_skips_zero_parts() -> None:
    result = route(RoutingTicket(region="AE", priority="P1"), [ctl("x", "UK")], NOW)
    assert "Out of region" not in format_reason(result.breakdown)
