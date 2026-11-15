from tests.conftest import AGENT, LEAD

SUPPLIER = "partner.atlas@opsdesk.demo"


async def test_supplier_sees_only_their_channels_and_no_tickets(client_factory) -> None:
    sup = await client_factory(SUPPLIER)
    chans = (await sup.get("/api/partner/channels")).json()["data"]
    assert chans, "journey C frequency includes Atlas Bedbank"
    assert (await sup.get("/api/tickets")).json()["data"] == []
    t = chans[0]["ticket_number"]
    assert (await sup.get(f"/api/tickets/{t}")).status_code == 404
    assert (await sup.get(f"/api/tickets/{t}/comments")).status_code == 404


async def test_supplier_reply_lands_on_ticket_timeline(client_factory) -> None:
    sup = await client_factory(SUPPLIER)
    chan = (await sup.get("/api/partner/channels")).json()["data"][0]
    r = await sup.post(
        f"/api/partner/channels/{chan['id']}/messages", json={"body": "Confirmed, HCN 55821."}
    )
    assert r.status_code == 201
    agent = await client_factory(AGENT)
    detail = (await agent.get(f"/api/tickets/{chan['ticket_number']}")).json()["data"]
    assert any(e["type"] == "supplier_reply" for e in detail["timeline"])
    stats = (await sup.get("/api/partner/stats")).json()["data"]
    assert stats["open_channels"] >= 1


async def test_staff_cannot_use_partner_routes(client_factory) -> None:
    agent = await client_factory(AGENT)
    assert (await agent.get("/api/partner/channels")).status_code == 403


async def test_copilot_brief_and_chaos(client_factory) -> None:
    lead = await client_factory(LEAD)
    t = (await lead.get("/api/tickets", params={"tboh": "TBOH-88213"})).json()["data"][0]
    brief = (await lead.get(f"/api/tickets/{t['id']}/brief")).json()["data"]
    assert brief["next_action"] and brief["lines"] and brief["reply_draft"]
    r = await lead.post("/api/admin/chaos", params={"count": 3})
    assert r.json()["data"]["created"] == 3
