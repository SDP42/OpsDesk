"""Storm Cells: auto-incident detection.

When 5+ flights share a hotel, supplier or theme within 60 minutes, OpsDesk forms a
parent incident so one controller can broadcast one approved reply to every agency.
Uses a sliding window per key and a networkx graph to merge overlapping cells.
"""

from __future__ import annotations

import networkx as nx
from pydantic import BaseModel


class StormTicket(BaseModel):
    id: str
    created_at_epoch: float
    keys: list[
        str
    ]  # e.g. "hotel:Palm Crescent Resort", "supplier:Atlas Bedbank", "theme:overbooking"


class StormCell(BaseModel):
    key: str
    label: str
    ticket_ids: list[str]
    agencies: int = 0
    reason: str


def _label(key: str) -> str:
    kind, _, value = key.partition(":")
    return {
        "hotel": f"{value} disruption",
        "supplier": f"{value} outage",
        "theme": f"{value.replace('_', ' ').title()} wave",
    }.get(kind, value)


def detect_storms(
    tickets: list[StormTicket], window_minutes: int = 60, threshold: int = 5
) -> list[StormCell]:
    window = window_minutes * 60
    by_key: dict[str, list[StormTicket]] = {}
    for t in tickets:
        for k in t.keys:
            by_key.setdefault(k, []).append(t)
    cells: list[tuple[str, set[str]]] = []
    for key, items in by_key.items():
        items.sort(key=lambda t: t.created_at_epoch)
        best: list[StormTicket] = []
        left = 0
        for right in range(len(items)):
            while items[right].created_at_epoch - items[left].created_at_epoch > window:
                left += 1
            if right - left + 1 > len(best):
                best = items[left : right + 1]
        if len(best) >= threshold:
            cells.append((key, {t.id for t in best}))
    # Merge cells that share most of their flights (same storm seen through several keys).
    g = nx.Graph()
    for i, (_, ids) in enumerate(cells):
        g.add_node(i)
        for j in range(i):
            other = cells[j][1]
            if len(ids & other) >= 0.6 * min(len(ids), len(other)):
                g.add_edge(i, j)
    out: list[StormCell] = []
    for comp in nx.connected_components(g):
        members = sorted(
            comp, key=lambda i: (not cells[i][0].startswith("hotel"), -len(cells[i][1]))
        )
        key = cells[members[0]][0]
        ids = set().union(*(cells[i][1] for i in comp))
        keys = ", ".join(cells[i][0] for i in members)
        out.append(
            StormCell(
                key=key,
                label=_label(key),
                ticket_ids=sorted(ids),
                reason=f"{len(ids)} flights within {window_minutes} min share {keys}",
            )
        )
    out.sort(key=lambda c: -len(c.ticket_ids))
    return out
