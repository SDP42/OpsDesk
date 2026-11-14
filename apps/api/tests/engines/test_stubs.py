"""Placeholder tests: every Round-two stub imports cleanly and returns its typed model."""

from app.engines import follow_the_sun, forecast, frustration, ghosts, nlq, promises, storms


def test_ghosts_stub() -> None:
    assert ghosts.score_booking(ghosts.GhostInput(tboh="TBOH-1")).risk == 0.0


def test_forecast_stub() -> None:
    assert forecast.forecast_breach(forecast.ForecastInput(minutes_remaining=30)).reason


def test_storms_stub() -> None:
    assert storms.detect_storms([]) == []


def test_promises_stub() -> None:
    assert promises.extract_promises("will confirm by 5 pm", 0.0) == []


def test_frustration_stub() -> None:
    assert frustration.score_frustration("again!").score == 0.0


def test_follow_the_sun_stub() -> None:
    assert follow_the_sun.plan_handoffs([], "IN", "AE") == []


def test_nlq_stub() -> None:
    assert nlq.parse_query("breached tickets in UAE").filters == {}
