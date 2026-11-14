from tests.conftest import AGENT, CHIEF, DUBAI_PILOT, LEAD, PILOT


async def test_journey_a_refund_ticket_links_history(client_factory) -> None:
    """MVP-1 acceptance: refund on a TBOH with two prior tickets links both, suggests the
    intent, and writes at least four timeline events (plus the Third-Contact Guardian)."""
    pilot = await client_factory(PILOT)
    booking = (await pilot.get("/api/bookings/TBOH-88213")).json()["data"]
    assert len(booking["earlier_cases"]) >= 2
    r = await pilot.post("/api/tickets", json={
        "title": "Refund for TBOH-88213 still not received",
        "description": "Asking again: the refund is still pending for TBOH-88213.",
        "tboh": "TBOH-88213"})
    assert r.status_code == 201, r.text
    body = r.json()["data"]
    tboh_links = [lk for lk in body["links"] if lk["link_type"] == "tboh"]
    assert len(tboh_links) >= 2
    assert body["ticket"]["intent"]["code"] == "refund.delay"
    assert body["guardian"]["triggered"] and body["guardian"]["contact_count"] >= 3

    agent = await client_factory(AGENT)
    detail = (await agent.get(f"/api/tickets/{body['ticket']['id']}")).json()["data"]
    types = [e["type"] for e in detail["timeline"]]
    assert len(types) >= 4
    assert {"created", "intent_classified", "linked", "routed"} <= set(types)
    assert detail["routing"]["reason"]
    assert detail["ticket"]["guardian_flag"]


async def test_journey_b_dubai_p1_routes_to_uae_controller(client_factory) -> None:
    pilot = await client_factory(DUBAI_PILOT)
    r = await pilot.post("/api/tickets", json={
        "title": "Urgent: guest stranded, hotel refusing check-in",
        "description": "Guest is at the desk now, please help urgently.", "priority": "P1"})
    ticket_id = r.json()["data"]["ticket"]["id"]
    agent = await client_factory(AGENT)
    detail = (await agent.get(f"/api/tickets/{ticket_id}")).json()["data"]
    assert detail["ticket"]["owner"]["region"] == "AE"
    assert detail["routing"]["reason"].startswith("Region match UAE (+40)")
    assert detail["routing"]["scores"]["runners_up"]


async def test_state_machine_rejects_illegal_transition(client_factory) -> None:
    agent = await client_factory(AGENT)
    t = (await agent.get("/api/tickets", params={"status": "closed", "limit": 1})).json()["data"][0]
    r = await agent.patch(f"/api/tickets/{t['id']}", json={"status": "open"})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "illegal_transition"


async def test_status_flow_open_to_resolved_to_closed(client_factory) -> None:
    agent = await client_factory(AGENT)
    t = (await agent.get("/api/tickets", params={"status": "open", "limit": 1})).json()["data"][0]
    r1 = await agent.patch(f"/api/tickets/{t['id']}", json={"status": "resolved", "note": "done"})
    assert r1.json()["data"]["status"] == "resolved"
    r2 = await agent.patch(f"/api/tickets/{t['id']}", json={"status": "closed"})
    assert r2.json()["data"]["status"] == "closed"


async def test_journey_c_handoff_keeps_supplier_recipients(client_factory) -> None:
    agent = await client_factory(AGENT)
    ticket = (await agent.get("/api/tickets", params={"tboh": "TBOH-66120"})).json()["data"][0]
    controllers = (await agent.get("/api/controllers")).json()["data"]
    omar = next(c for c in controllers if c["callsign"] == "AE-01")
    blocked = await agent.post(f"/api/tickets/{ticket['id']}/reassign", json={"to_user_id": omar["id"]})
    assert blocked.status_code == 409
    diff = blocked.json()["error"]["details"]
    assert {s["party_type"] for s in diff["stayed"]} >= {"supplier"}
    ok = await agent.post(f"/api/tickets/{ticket['id']}/reassign",
                          json={"to_user_id": omar["id"], "handoff_confirmed": True})
    assert ok.json()["data"]["owner"]["id"] == omar["id"]
    assert ok.json()["data"]["queue"]["region"] == "AE"
    freq = (await agent.get(f"/api/tickets/{ticket['id']}/frequencies")).json()["data"][0]
    active_suppliers = [r for r in freq["recipients"] if r["party_type"] == "supplier" and not r["removed_at"]]
    assert len(active_suppliers) == 2
    timeline = (await agent.get(f"/api/tickets/{ticket['id']}")).json()["data"]["timeline"]
    assert any(e["type"] == "handoff_check" for e in timeline)


async def test_journey_d_escalation_lands_in_tower_chief_queue(client_factory) -> None:
    agent = await client_factory(AGENT)
    ticket = (await agent.get("/api/tickets", params={"tboh": "TBOH-90009"})).json()["data"][0]
    assert ticket["sla"]["urgency_driver"].startswith("check-in in")
    assert ticket["sla"]["state"] in {"at_risk", "critical", "breached"}
    r = await agent.post(f"/api/tickets/{ticket['id']}/escalate", json={"reason": "Check-in in 9h"})
    assert r.json()["data"]["status"] == "escalated"
    chief = await client_factory(CHIEF)
    queue = (await chief.get("/api/tickets", params={"view": "escalations", "limit": 200})).json()["data"]
    assert ticket["id"] in {t["id"] for t in queue}


async def test_escalate_requires_reason(client_factory) -> None:
    agent = await client_factory(AGENT)
    t = (await agent.get("/api/tickets", params={"status": "open", "limit": 1})).json()["data"][0]
    assert (await agent.post(f"/api/tickets/{t['id']}/escalate", json={"reason": ""})).status_code == 422


async def test_cursor_pagination_has_no_duplicates(client_factory) -> None:
    lead = await client_factory(LEAD)
    seen: list[str] = []
    cursor = None
    for _ in range(4):
        params = {"limit": 50, **({"cursor": cursor} if cursor else {})}
        page = (await lead.get("/api/tickets", params=params)).json()
        seen += [t["id"] for t in page["data"]]
        cursor = page["meta"]["next_cursor"]
        if not cursor:
            break
    assert len(seen) == len(set(seen)) == 200


async def test_manual_link_and_intent_suggest(client_factory) -> None:
    agent = await client_factory(AGENT)
    tickets = (await agent.get("/api/tickets", params={"limit": 2})).json()["data"]
    r = await agent.post(f"/api/tickets/{tickets[0]['id']}/links", json={"target": tickets[1]["number"]})
    assert r.status_code in {201, 409}
    s = (await agent.post("/api/intents/suggest", json={"text": "voucher not received for Dubai"})).json()["data"]
    assert len(s["top"]) == 3 and s["top"][0]["code"].startswith("voucher")
