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
        r = await pilot.post(
            "/api/tickets", json={"title": f"Voucher missing number {i}", "priority": "P2"}
        )
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
    r = await agent.post(
        "/api/ghosts/TBOH-77341/preempt", json={"message": g["recommended_message"]}
    )
    assert r.json()["data"]["status"] == "dissolved"
    assert "TBOH-77341" not in [x["tboh"] for x in (await agent.get("/api/ghosts")).json()["data"]]


async def test_chaos_forms_storm_and_broadcast_replies_all(client_factory) -> None:
    lead = await client_factory(LEAD)
    await lead.post("/api/admin/chaos", params={"count": 8})
    storms = (await lead.get("/api/storms")).json()["data"]
    assert storms and len(storms[0]["ticket_ids"]) >= 5
    r = await lead.post(
        "/api/storms/broadcast",
        json={"key": storms[0]["key"], "message": "We are rebooking every affected guest tonight."},
    )
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


async def test_simulator_compares_presets(client_factory) -> None:
    lead = await client_factory(LEAD)
    r = (await lead.post("/api/routing/simulate", json={"hours": 72})).json()["data"]
    assert {o["preset"] for o in r["outcomes"]} == {
        "balanced",
        "urgency_first",
        "regional_affinity",
        "fairness",
    }
    assert r["best_preset"] and r["reason"]
    assert all(o["flights"] > 0 and o["reason"] for o in r["outcomes"])
    agent = await client_factory(AGENT)
    assert (await agent.post("/api/routing/simulate", json={})).status_code == 403


async def test_weather_heatmap_and_product_link(client_factory) -> None:
    lead = await client_factory(LEAD)
    h = (await lead.get("/api/insights/heatmap", params={"weeks": 8})).json()["data"]
    assert len(h["weeks"]) == 8 and all(len(t["counts"]) == 8 for t in h["themes"])
    assert any(t["emerging"] for t in h["themes"]), "seeded inventory-sync spike"
    r = await lead.patch(
        "/api/insights/themes/inventory_sync", json={"product_link": "JIRA-OPS-412"}
    )
    assert r.json()["data"]["product_link"] == "JIRA-OPS-412"


async def test_ask_the_tower_and_checkin_filter(client_factory) -> None:
    agent = await client_factory(AGENT)
    p = (
        await agent.get("/api/nlq", params={"q": "critical flights in UAE checking in this week"})
    ).json()["data"]
    assert p["filters"]["region"] == "AE" and p["filters"]["checkin_within_days"] == "7"
    r = await agent.get("/api/tickets", params={"region": "AE", "checkin_within_days": 7})
    assert r.status_code == 200
