from tests.conftest import AGENT, CHIEF, DUBAI_PILOT, LEAD, PILOT


async def _saffron_ticket(client) -> dict:
    page = (await client.get("/api/tickets", params={"tboh": "TBOH-88213"})).json()
    return page["data"][0]


async def test_requester_gets_404_for_other_agency_ticket(client_factory) -> None:
    pilot = await client_factory(PILOT)
    other = await client_factory(DUBAI_PILOT)
    ticket = await _saffron_ticket(pilot)
    assert (await other.get(f"/api/tickets/{ticket['id']}")).status_code == 404
    assert (await other.get(f"/api/tickets/{ticket['id']}/comments")).status_code == 404
    assert (await other.get(f"/api/tickets/{ticket['id']}/links")).status_code == 404


async def test_requester_list_is_scoped_to_own_agency(client_factory) -> None:
    pilot = await client_factory(DUBAI_PILOT)
    data = (await pilot.get("/api/tickets", params={"limit": 200})).json()["data"]
    assert data and all("tboh" in t and "routing_reason" not in t for t in data)
    me = (await pilot.get("/api/me")).json()["data"]
    staff = await client_factory(AGENT)
    for t in data[:5]:
        full = (await staff.get(f"/api/tickets/{t['id']}")).json()["data"]["ticket"]
        assert full["agency"]["id"] == me["agency"]["id"]


async def test_requester_cannot_read_internal_notes(client_factory) -> None:
    agent = await client_factory(AGENT)
    pilot = await client_factory(PILOT)
    ticket = await _saffron_ticket(pilot)
    await agent.post(
        f"/api/tickets/{ticket['id']}/comments/internal", json={"body": "secret supplier note"}
    )
    await agent.post(
        f"/api/tickets/{ticket['id']}/comments/external", json={"body": "We are on it"}
    )
    seen = (await pilot.get(f"/api/tickets/{ticket['id']}/comments")).json()["data"]
    assert all(c["visibility"] == "external" for c in seen)
    assert not any("secret" in c["body"] for c in seen)
    staff_seen = (await agent.get(f"/api/tickets/{ticket['id']}/comments")).json()["data"]
    assert any(c["visibility"] == "internal" for c in staff_seen)


async def test_requester_cannot_call_agent_routes(client_factory) -> None:
    pilot = await client_factory(PILOT)
    ticket = await _saffron_ticket(pilot)
    tid = ticket["id"]
    assert (
        await pilot.patch(f"/api/tickets/{tid}", json={"status": "resolved"})
    ).status_code == 403
    assert (
        await pilot.post(f"/api/tickets/{tid}/comments/internal", json={"body": "x"})
    ).status_code == 403
    assert (
        await pilot.post(f"/api/tickets/{tid}/escalate", json={"reason": "because"})
    ).status_code == 403
    assert (await pilot.get(f"/api/tickets/{tid}/frequencies")).status_code == 403
    assert (await pilot.get("/api/controllers")).status_code == 403


async def test_agent_cannot_use_lead_routes(client_factory) -> None:
    agent = await client_factory(AGENT)
    assert (await agent.get("/api/export/tickets")).status_code == 403
    assert (await agent.post("/api/admin/archive-run", json={})).status_code == 403
    assert (await agent.put("/api/routing/preset", json={"preset": "fairness"})).status_code == 403


async def test_tower_chief_cannot_patch_non_escalated(client_factory) -> None:
    chief = await client_factory(CHIEF)
    page = (await chief.get("/api/tickets", params={"view": "open", "status": "open"})).json()[
        "data"
    ]
    target = next(t for t in page if t["status"] == "open")
    r = await chief.patch(f"/api/tickets/{target['id']}", json={"priority": "P1"})
    assert r.status_code == 403


async def test_agency_mirror_hides_internal_fields(client_factory) -> None:
    lead = await client_factory(LEAD)
    page = (await lead.get("/api/tickets", params={"limit": 1})).json()["data"]
    mirror = (await lead.get(f"/api/tickets/{page[0]['id']}", params={"as": "requester"})).json()[
        "data"
    ]
    assert "routing" not in mirror and "routing_reason" not in mirror["ticket"]
