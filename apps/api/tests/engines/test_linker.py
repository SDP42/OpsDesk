from datetime import UTC, datetime, timedelta

from app.engines.linker import (
    LinkTicket,
    TurbulenceInput,
    agency_turbulence,
    find_links,
    third_contact_guardian,
)

NOW = datetime(2026, 11, 14, 10, 0, tzinfo=UTC)


def t(id_: str, days_ago: float, **kw) -> LinkTicket:
    base = dict(number=f"OD-{id_}", agency_id="ag1", title="", description="")
    base.update(kw)
    return LinkTicket(id=id_, created_at=NOW - timedelta(days=days_ago), **base)


def test_tboh_link_is_full_strength() -> None:
    new = t("new", 0, tboh="TBOH-88213", intent_code="refund.delay")
    old = t("a", 3, tboh="TBOH-88213", intent_code="refund.status")
    result = find_links(new, [old], NOW)
    assert result.links[0].link_type == "tboh"
    assert result.links[0].strength == 1.0


def test_agency_intent_link_within_30_days_only() -> None:
    new = t("new", 0, intent_code="voucher.not_received")
    recent = t("a", 10, intent_code="voucher.not_received")
    stale = t("b", 45, intent_code="voucher.not_received")
    other_agency = t("c", 2, intent_code="voucher.not_received", agency_id="ag2")
    ids = {link.ticket_id: link for link in find_links(new, [recent, stale, other_agency], NOW).links}
    assert ids["a"].link_type == "agency_intent" and ids["a"].strength == 0.8
    assert "b" not in ids and "c" not in ids


def test_semantic_link_same_agency() -> None:
    new = t("new", 0, title="Hotel overbooked guest walked to another property",
            description="The hotel says it is overbooked and walked our guest")
    similar = t("a", 40, title="Guest walked, hotel overbooked",
                description="hotel overbooked so guest was walked to another property")
    unrelated = t("b", 40, title="Visa documents missing", description="passport scan needed")
    links = find_links(new, [similar, unrelated], NOW).links
    assert [lk.ticket_id for lk in links] == ["a"]
    assert links[0].link_type == "semantic"
    assert 0.5 <= links[0].strength <= 0.7


def test_strongest_link_type_wins_per_pair() -> None:
    new = t("new", 0, tboh="TBOH-1", intent_code="refund.delay", title="refund delayed")
    old = t("a", 1, tboh="TBOH-1", intent_code="refund.delay", title="refund delayed")
    links = find_links(new, [old], NOW).links
    assert len(links) == 1 and links[0].link_type == "tboh"


def test_guardian_fires_on_third_contact() -> None:
    new = t("new", 0, tboh="TBOH-88213", intent_code="refund.delay")
    first = t("a", 9, tboh="TBOH-88213", intent_code="refund.delay")
    assert not third_contact_guardian(new, [first], NOW).triggered
    second = t("b", 4, tboh="TBOH-88213", intent_code="refund.status")
    result = third_contact_guardian(new, [first, second], NOW)
    assert result.triggered and result.contact_count == 3
    assert result.reason.startswith("3rd contact in 14 days")


def test_guardian_ignores_contacts_outside_window() -> None:
    new = t("new", 0, intent_code="refund.delay")
    old = [t("a", 20, intent_code="refund.delay"), t("b", 30, intent_code="refund.delay")]
    assert not third_contact_guardian(new, old, NOW).triggered


def test_turbulence_rises_and_decays() -> None:
    hot = agency_turbulence(TurbulenceInput(repeat_contacts_14d=3, escalations_30d=2,
                                            avg_unresolved_age_hours=48, open_tickets=5))
    cooled = agency_turbulence(TurbulenceInput(repeat_contacts_14d=3, escalations_30d=2,
                                               avg_unresolved_age_hours=48, open_tickets=5,
                                               days_since_last_contact=28))
    assert hot.score > cooled.score
    assert hot.band in {"moderate", "severe"}
    assert "repeat contacts" in hot.reason
