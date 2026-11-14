from datetime import UTC, datetime, timedelta

from app.engines.weather import (
    ThemeObservation,
    aggregate_week,
    emerging_zscore,
    iso_week,
    tag_themes,
)


def test_tag_themes_from_lexicon() -> None:
    tags = tag_themes("Hotel overbooked and guest walked; refund still no update")
    codes = [t.code for t in tags]
    assert "overbooking" in codes
    assert all(t.matched for t in tags)


def test_aggregate_week_wow_and_emerging() -> None:
    now = datetime(2026, 11, 14, tzinfo=UTC)
    obs: list[ThemeObservation] = []
    for w in range(1, 7):  # 2 per week for 6 previous weeks
        for i in range(2):
            obs.append(
                ThemeObservation(
                    theme="overbooking",
                    ticket_id=f"p{w}{i}",
                    agency_id="a",
                    created_at=now - timedelta(weeks=w),
                )
            )
    for i in range(12):
        obs.append(
            ThemeObservation(
                theme="overbooking", ticket_id=f"c{i}", agency_id=f"a{i % 3}", created_at=now
            )
        )
    week = aggregate_week(obs, iso_week(now))[0]
    assert week.count == 12 and week.previous == 2
    assert week.wow_change_pct == 500.0
    assert week.emerging and week.agencies == 3
    assert len(week.sample_ticket_ids) == 5


def test_zscore_needs_history() -> None:
    assert emerging_zscore(5, [1, 2]) is None
