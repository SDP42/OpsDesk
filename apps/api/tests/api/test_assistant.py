import pytest

from app.engines.assistant import plan
from tests.conftest import AGENT, LEAD, PILOT


@pytest.mark.parametrize(
    ("q", "role", "intent"),
    [
        ("Find OD-24817", "agent", "find_ticket"),
        ("anything on tboh 88213?", "agent", "find_tboh"),
        ("show breached flights in Dubai", "agent", "search"),
        ("how is routing decided?", "agent", "explain"),
        ("give me today's briefing", "lead", "briefing"),
        ("where is my refund", "requester", "my_queue"),
        ("which agencies are most turbulent", "lead", "turbulence"),
    ],
)
def test_plan_reads_questions(q: str, role: str, intent: str) -> None:
    assert plan(q, role).intent == intent


def test_plan_extracts_region_and_sla() -> None:
    p = plan("show breached flights in UAE", "agent")
    assert p.filters == {"region": "AE", "sla_state": "breached"}


@pytest.mark.parametrize("email", [AGENT, LEAD, PILOT])
async def test_ask_answers_every_persona(client_factory, email: str) -> None:
    client = await client_factory(email)
    r = await client.post("/api/assistant/ask", json={"question": "what should I work on first?"})
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["answer"] and data["suggestions"]


async def test_pilot_cannot_find_other_agency_ticket_via_assistant(client_factory) -> None:
    lead = await client_factory(LEAD)
    other = (await lead.get("/api/tickets", params={"agency": "x", "limit": 50})).json()["data"]
    pilot = await client_factory(PILOT)
    me = (await pilot.get("/api/me")).json()["data"]
    foreign = next((t for t in other if t["agency"]["id"] != me["agency"]["id"]), None)
    if foreign:
        r = (await pilot.post("/api/assistant/ask", json={"question": f"find {foreign['number']}"})).json()["data"]
        assert "can't see" in r["answer"]
