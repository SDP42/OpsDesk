"""Remaining stubs import cleanly; implemented engines have their own test files."""

from app.engines import follow_the_sun, nlq


def test_follow_the_sun_stub() -> None:
    assert follow_the_sun.plan_handoffs([], "IN", "AE") == []


def test_nlq_stub() -> None:
    assert nlq.parse_query("breached tickets in UAE").filters == {}
