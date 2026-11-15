from tests.conftest import AGENT, CHIEF, LEAD, PILOT


async def test_roster_shows_hrms_leave_orphans_and_rebalances(client_factory) -> None:
    lead = await client_factory(LEAD)
    data = (await lead.get("/api/roster")).json()["data"]
    arjun = next(c for c in data["crew"] if c["name"] == "Arjun Mehta")
    assert arjun["on_leave"] and arjun["availability"] == "away" and "Diwali" in arjun["reason"]
    assert data["orphans"], "journey D flight is owned by Arjun"
    moved = (await lead.post("/api/roster/rebalance")).json()["data"]["moved"]
    assert moved >= 1
    assert (await lead.get("/api/roster")).json()["data"]["orphans"] == []


async def test_routing_never_picks_controller_on_leave(client_factory) -> None:
    lead = await client_factory(LEAD)
    crew = (await lead.get("/api/roster")).json()["data"]["crew"]
    away = {c["id"] for c in crew if c["on_leave"]}
    pilot = await client_factory(PILOT)
    for i in range(3):
        r = await pilot.post("/api/tickets", json={"title": f"Voucher missing number {i}", "priority": "P2"})
        tid = r.json()["data"]["ticket"]["id"]
        owner = (await lead.get(f"/api/tickets/{tid}")).json()["data"]["ticket"]["owner"]
        assert owner is None or owner["id"] not in away


async def test_ghosts_rank_unconfirmed_booking_and_preempt_dissolves(client_factory) -> None:
    agent = await client_factory(AGENT)
    ghosts = (await agent.get("/api/ghosts")).json()["data"]
    tbohs = [g["tboh"] for g in ghosts]
    assert "TBOH-77341" in tbohs
    g = next(g for g in ghosts if g["tboh"] == "TBOH-77341")
    assert g["drivers"] and g["reason"]
    r = await agent.post("/api/ghosts/TBOH-77341/preempt", json={"message": g["recommended_message"]})
    assert r.json()["data"]["status"] == "dissolved"
    assert "TBOH-77341" not in [x["tboh"] for x in (await agent.get("/api/ghosts")).json()["data"]]


async def test_chaos_forms_storm_and_broadcast_replies_all(client_factory) -> None:
    lead = await client_factory(LEAD)
    await lead.post("/api/admin/chaos", params={"count": 8})
    storms = (await lead.get("/api/storms")).json()["data"]
    assert storms and len(storms[0]["ticket_ids"]) >= 5
    r = await lead.post("/api/storms/broadcast", json={"key": storms[0]["key"], "message": "We are rebooking every affected guest tonight."})
    assert r.json()["data"]["replied"] == len(storms[0]["ticket_ids"])


async def test_forecast_signals_and_scorecard(client_factory) -> None:
    chief = await client_factory(CHIEF)
    t = (await chief.get("/api/tickets", params={"tboh": "TBOH-88213"})).json()["data"][0]
    f = (await chief.get(f"/api/tickets/{t['id']}/forecast")).json()["data"]
    assert len(f["actions"]) == 4 and f["reason"]
    s = (await chief.get(f"/api/tickets/{t['id']}/signals")).json()["data"]
    assert "band" in s["frustration"]
    card = (await chief.get("/api/suppliers/scorecard")).json()["data"]
    assert card and all(c["reason"] for c in card)


async def test_pilot_cannot_use_ops_routes(client_factory) -> None:
    pilot = await client_factory(PILOT)
    for path in ["/api/roster", "/api/ghosts", "/api/storms", "/api/suppliers/scorecard"]:
        assert (await pilot.get(path)).status_code == 403
