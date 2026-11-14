import json
from datetime import timedelta

from sqlalchemy import func, select, update

from tests.conftest import AGENT, LEAD


async def test_export_streams_every_row_csv_and_ndjson(client_factory) -> None:
    from app.db.models import Ticket
    from app.db.session import get_sessionmaker

    async with get_sessionmaker()() as s:
        total = await s.scalar(select(func.count()).select_from(Ticket))
    lead = await client_factory(LEAD)
    csv_resp = await lead.get("/api/export/tickets", params={"format": "csv"})
    assert csv_resp.status_code == 200
    assert int(csv_resp.headers["x-total-count"]) == total
    lines = csv_resp.text.strip().splitlines()
    assert lines[0].startswith("number,title")
    assert len(lines) - 1 == total
    nd = await lead.get("/api/export/tickets", params={"format": "ndjson"})
    rows = [json.loads(line) for line in nd.text.strip().splitlines()]
    assert len(rows) == total
    assert len({r["id"] for r in rows}) == total


async def test_archive_job_moves_old_closed_tickets(client_factory) -> None:
    from app.db.base import utcnow
    from app.db.models import ArchiveTicket, Ticket
    from app.db.session import get_sessionmaker

    async with get_sessionmaker()() as s:
        ids = (await s.scalars(select(Ticket.id).where(Ticket.status == "closed").limit(5))).all()
        await s.execute(
            update(Ticket)
            .where(Ticket.id.in_(ids))
            .values(closed_at=utcnow() - timedelta(days=200))
        )
        await s.commit()
    lead = await client_factory(LEAD)
    r = await lead.post("/api/admin/archive-run", json={})
    assert r.status_code == 200
    assert r.json()["data"]["archived"] >= 5
    async with get_sessionmaker()() as s:
        archived = await s.scalar(
            select(func.count()).select_from(ArchiveTicket).where(ArchiveTicket.id.in_(ids))
        )
        remaining = await s.scalar(
            select(func.count()).select_from(Ticket).where(Ticket.id.in_(ids))
        )
    assert archived == 5 and remaining == 0


async def test_insights_themes(client_factory) -> None:
    agent = await client_factory(AGENT)
    data = (await agent.get("/api/insights/themes")).json()["data"]
    assert data["themes"]
    top = data["themes"][0]
    assert top["count"] > 0 and top["reason"]


async def test_overview_and_controllers(client_factory) -> None:
    agent = await client_factory(AGENT)
    ov = (await agent.get("/api/stats/overview")).json()["data"]
    assert ov["open"] > 0 and set(ov["by_region"]) <= {"IN", "AE", "UK", "SEA"}
    ctl = (await agent.get("/api/controllers")).json()["data"]
    assert any(c["on_shift"] for c in ctl)


async def test_sla_tick_job_runs(client_factory) -> None:
    from app.jobs.sla_tick import sla_tick

    result = await sla_tick()
    assert result["evaluated"] > 0


async def test_sse_broker_scopes_requesters() -> None:
    from app.core.sse import Broker

    broker = Broker()
    staff = broker.subscribe("agent", None)
    pilot = broker.subscribe("requester", "ag1")
    assert (await anext(staff))["event"] == "hello"
    assert (await anext(pilot))["event"] == "hello"
    broker.publish("ticket.updated", {"id": "x"}, agency_id="ag2")
    broker.publish("ticket.updated", {"id": "y"}, agency_id="ag1")
    assert json.loads((await anext(staff))["data"])["id"] == "x"
    assert json.loads((await anext(pilot))["data"])["id"] == "y"
