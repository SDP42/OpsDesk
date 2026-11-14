"""Test setup: a fresh seeded SQLite database per test session."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="opsdesk-test-"))
os.environ.update({
    "APP_ENV": "test",
    "DATABASE_URL": f"sqlite+aiosqlite:///{_TMP / 'test.db'}",
    "INTENT_MODEL_PATH": str(_TMP / "intent.joblib"),
    "JWT_SECRET": "test-secret-not-for-production-000000000000",
    "SCHEDULER_ENABLED": "false",
    "LOGIN_RATE_LIMIT_PER_MINUTE": "10000",
})

import pytest  # noqa: E402

PASSWORD = "cleared-for-takeoff"


def pytest_sessionstart(session: pytest.Session) -> None:
    from app.db.seed.seed import reset_schema

    reset_schema()


@pytest.fixture(scope="session", autouse=True)
async def seeded() -> None:
    from app.db.seed.seed import seed

    await seed(600)


@pytest.fixture
async def client_factory():
    import httpx

    from app.main import app

    clients: list[httpx.AsyncClient] = []

    async def make(email: str | None = None) -> httpx.AsyncClient:
        client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        clients.append(client)
        if email:
            r = await client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
            assert r.status_code == 200, r.text
        return client

    yield make
    for c in clients:
        await c.aclose()


PILOT = "pilot.saf@opsdesk.demo"
DUBAI_PILOT = "pilot.dun@opsdesk.demo"
AGENT = "priya.nair@opsdesk.demo"
UAE_AGENT = "omar.haddad@opsdesk.demo"
CHIEF = "rahul.kapoor@opsdesk.demo"
LEAD = "meera.iyer@opsdesk.demo"
