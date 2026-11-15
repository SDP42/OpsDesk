import pytest

from tests.conftest import AGENT, CHIEF, LEAD, PILOT


@pytest.mark.parametrize(
    ("email", "role"),
    [(PILOT, "requester"), (AGENT, "agent"), (CHIEF, "escalation_manager"), (LEAD, "lead")],
)
async def test_all_four_roles_can_log_in(client_factory, email: str, role: str) -> None:
    client = await client_factory(email)
    me = (await client.get("/api/me")).json()["data"]
    assert me["role"] == role


async def test_bad_password_is_rejected(client_factory) -> None:
    client = await client_factory()
    r = await client.post("/api/auth/login", json={"email": AGENT, "password": "nope"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "invalid_credentials"


async def test_me_requires_session(client_factory) -> None:
    client = await client_factory()
    r = await client.get("/api/me")
    assert r.status_code == 401
    assert set(r.json()["error"]) >= {"code", "message"}


async def test_session_cookie_is_httponly(client_factory) -> None:
    client = await client_factory()
    r = await client.post(
        "/api/auth/login", json={"email": AGENT, "password": "cleared-for-takeoff"}
    )
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie


async def test_logout_clears_session(client_factory) -> None:
    client = await client_factory(AGENT)
    await client.post("/api/auth/logout")
    assert (await client.get("/api/me")).status_code == 401


async def test_demo_accounts_lists_four_cards(client_factory) -> None:
    client = await client_factory()
    data = (await client.get("/api/auth/demo-accounts")).json()["data"]
    assert {d["role"] for d in data} == {
        "requester",
        "agent",
        "escalation_manager",
        "lead",
        "supplier",
    }


async def test_unknown_fields_are_rejected(client_factory) -> None:
    client = await client_factory()
    r = await client.post("/api/auth/login", json={"email": AGENT, "password": "x", "admin": True})
    assert r.status_code == 422


async def test_data_mode_switches_between_demo_and_live(client_factory) -> None:
    client = await client_factory(LEAD)
    demo = (await client.get("/api/tickets", params={"limit": 5})).json()["data"]
    assert demo
    me = (
        await client.patch("/api/me/preferences", json={"data_mode": "live", "onboarded": True})
    ).json()["data"]
    assert me["data_mode"] == "live" and me["onboarded"]
    live = (await client.get("/api/tickets", params={"limit": 200})).json()["data"]
    assert {t["id"] for t in live}.isdisjoint({t["id"] for t in demo})
    await client.patch("/api/me/preferences", json={"data_mode": "demo"})


async def test_login_rate_limit_is_per_account(client_factory, monkeypatch) -> None:
    from app.core.config import get_settings
    from app.routers import auth as auth_router

    monkeypatch.setattr(get_settings(), "login_rate_limit_per_minute", 2)
    auth_router._attempts.clear()
    client = await client_factory()
    bad = {"email": AGENT, "password": "wrong"}
    codes = [(await client.post("/api/auth/login", json=bad)).status_code for _ in range(3)]
    assert codes[-1] == 429
    ok = await client.post("/api/auth/login", json={"email": LEAD, "password": "cleared-for-takeoff"})
    assert ok.status_code == 200
    auth_router._attempts.clear()
