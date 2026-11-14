from datetime import UTC, datetime

from app.engines.copilot import BriefInput, build_brief


def _input(**kw) -> BriefInput:
    base = dict(
        number="OD-1",
        title="Refund",
        status="open",
        priority="P2",
        intent_label="Refund > Delay",
        sla_state="critical",
        hours_to_checkin=9,
        contact_count=3,
        guardian=True,
        linked=[{"number": "OD-0", "status": "open", "title": "x"}],
        last_external=None,
        last_internal=None,
        supplier_last_reply=None,
        open_frequencies=0,
        escalated=False,
        now=datetime(2026, 11, 14, tzinfo=UTC),
    )
    base.update(kw)
    return BriefInput(**base)


def test_brief_recommends_escalation_near_checkin() -> None:
    b = build_brief(_input())
    assert "Escalate" in b.next_action
    assert "not the first time" in b.reply_draft
    assert all(line.why for line in b.lines)


def test_brief_chases_silent_supplier() -> None:
    b = build_brief(
        _input(sla_state="ok", hours_to_checkin=200, open_frequencies=1, guardian=False)
    )
    assert "Chase the supplier" in b.next_action
