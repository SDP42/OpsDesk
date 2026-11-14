"""In-process realtime hub for Server-Sent Events.

Each subscriber gets a bounded asyncio queue; slow consumers drop the oldest
event instead of blocking publishers. Events: ticket.created, ticket.updated,
sla.tick, escalation, export.progress.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any


@dataclass
class Subscriber:
    role: str
    agency_id: str | None
    queue: asyncio.Queue[dict[str, Any]] = field(default_factory=lambda: asyncio.Queue(maxsize=500))


class Broker:
    def __init__(self) -> None:
        self._subs: set[Subscriber] = set()
        self._seq = 0

    @property
    def subscriber_count(self) -> int:
        return len(self._subs)

    def publish(self, event: str, data: dict[str, Any], agency_id: str | None = None) -> None:
        """Fan out an event. ``agency_id`` scopes it for requester subscribers."""
        self._seq += 1
        message = {
            "id": str(self._seq),
            "event": event,
            "data": json.dumps({**data, "at": datetime.now(UTC).isoformat()}, default=str),
        }
        for sub in list(self._subs):
            if sub.role == "requester" and (agency_id is None or agency_id != sub.agency_id):
                continue
            if sub.queue.full():
                with contextlib.suppress(asyncio.QueueEmpty):
                    sub.queue.get_nowait()
            sub.queue.put_nowait(message)

    async def subscribe(self, role: str, agency_id: str | None) -> AsyncIterator[dict[str, Any]]:
        sub = Subscriber(role=role, agency_id=agency_id)
        self._subs.add(sub)
        try:
            yield {"event": "hello", "data": json.dumps({"subscribers": len(self._subs)})}
            while True:
                yield await sub.queue.get()
        finally:
            self._subs.discard(sub)


broker = Broker()
