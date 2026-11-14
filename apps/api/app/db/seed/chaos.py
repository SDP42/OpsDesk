"""Chaos Mode: post 40 tickets about one hotel's overbooking through the live API.

    uv run python -m app.db.seed.chaos [--api http://localhost:8000] [--count 40]

Requests go through HTTP so routing, linking and SSE fire exactly as in production.
"""

from __future__ import annotations

import argparse
import asyncio
import random

import httpx

from app.core.config import get_settings
from app.db.seed.fixtures import AGENCIES, DOMAIN

HOTEL = "Palm Crescent Resort, Dubai"
LINES = [
    "{hotel} says it is overbooked and walked our guest to another property",
    "Guest arrived at {hotel}, no room available, hotel overbooked",
    "Overbooking at {hotel}: guest stranded in the lobby, please help",
    "{hotel} refusing check-in due to overbooking, family of four waiting",
    "Another guest walked from {hotel} tonight, overbooked again",
]


async def run(api: str, count: int) -> None:
    password = get_settings().demo_password
    rng = random.Random()
    pilots = [f"pilot.{code.lower()}@{DOMAIN}" for code, *_ in AGENCIES]
    clients: dict[str, httpx.AsyncClient] = {}
    try:
        for email in pilots:
            client = httpx.AsyncClient(base_url=api, timeout=20)
            r = await client.post("/api/auth/login", json={"email": email, "password": password})
            r.raise_for_status()
            clients[email] = client
        created = 0
        for i in range(count):
            email = rng.choice(pilots)
            body = {
                "title": rng.choice(LINES).format(hotel=HOTEL)[:200],
                "description": f"Chaos #{i + 1}: {rng.choice(LINES).format(hotel=HOTEL)}. "
                               "Supplier not answering the phone.",
                "priority": rng.choice(["P1", "P2", "P2", "P3"]),
            }
            r = await clients[email].post("/api/tickets", json=body)
            if r.status_code == 201:
                created += 1
                t = r.json()["data"]["ticket"]
                print(f"  {t['number']:<10} {t['status']:<8} {email.split('@')[0]}", flush=True)
            await asyncio.sleep(rng.uniform(0.05, 0.25))
        print(f"Chaos Mode: {created}/{count} flights injected about {HOTEL}")
    finally:
        for c in clients.values():
            await c.aclose()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default="http://localhost:8000")
    parser.add_argument("--count", type=int, default=40)
    args = parser.parse_args()
    asyncio.run(run(args.api, args.count))


if __name__ == "__main__":
    main()
