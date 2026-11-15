"""Seed the demo world (spec section 13).

    uv run python -m app.db.seed.seed            # 3,000 tickets + journey fixtures
    uv run python -m app.db.seed.seed --big      # 60,000 tickets for the export demo

Everything is generated relative to *now*, so re-seed right before a demo.
"""

from __future__ import annotations

import argparse
import asyncio
import random
import time
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from alembic import command
from alembic.config import Config
from sqlalchemy import insert, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import API_ROOT, REGION_TIMEZONES, SLA_BASE_MINUTES, get_settings
from app.core.security import hash_password
from app.db import models as m
from app.db.base import Base, new_id, utcnow
from app.db.seed import fixtures as fx
from app.db.session import build_engine, set_engine
from app.engines import intent as intent_engine
from app.engines import vectoring
from app.engines.intent_taxonomy import (
    INTENT_CODES,
    PARENTS,
    SUB_INTENTS,
    label_of,
    parent_of,
    render_example,
)
from app.engines.lifecycle import OPEN_STATUSES
from app.engines.weather import tag_themes
from app.engines.wheels_up import SlaInput, compute_sla

BATCH = 2000


def log(msg: str) -> None:
    print(f"  [seed] {msg}", flush=True)


# ---------------------------------------------------------------------------
# Schema reset
# ---------------------------------------------------------------------------


def reset_schema() -> None:
    """Bring the schema to head, then empty every table in place.

    The database file is never deleted, so a running API keeps a valid connection
    and picks up the fresh demo data immediately (no restart after `make seed`).
    """
    settings = get_settings()
    if settings.is_sqlite:
        Path(settings.database_url.split(":///", 1)[1]).parent.mkdir(parents=True, exist_ok=True)
    cfg = Config(str(API_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(API_ROOT / "app/db/migrations"))
    cfg.attributes["configure_logger"] = False
    command.upgrade(cfg, "head")
    sync_url = settings.database_url.replace("+aiosqlite", "").replace("+asyncpg", "+psycopg")
    if settings.is_sqlite:
        import sqlite3

        con = sqlite3.connect(sync_url.split(":///", 1)[1], timeout=30)
        try:
            con.execute("PRAGMA foreign_keys=OFF")
            for table in reversed(Base.metadata.sorted_tables):
                con.execute(f'DELETE FROM "{table.name}"')
            con.commit()
            con.execute("PRAGMA foreign_keys=ON")
        finally:
            con.close()
    else:
        command.downgrade(cfg, "base")
        command.upgrade(cfg, "head")


async def bulk(session: AsyncSession, model: type[Any], rows: list[dict[str, Any]]) -> None:
    for i in range(0, len(rows), BATCH):
        await session.execute(insert(model), rows[i : i + BATCH])


# ---------------------------------------------------------------------------
# World builder
# ---------------------------------------------------------------------------


class World:
    def __init__(self, now: datetime, rng: random.Random) -> None:
        self.now = now
        self.rng = rng
        self.agencies: list[dict[str, Any]] = []
        self.agency_by_code: dict[str, dict[str, Any]] = {}
        self.suppliers: list[dict[str, Any]] = []
        self.users: list[dict[str, Any]] = []
        self.agents: list[dict[str, Any]] = []
        self.requesters_by_agency: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self.bookings: list[dict[str, Any]] = []
        self.bookings_by_agency: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self.booking_by_tboh: dict[str, dict[str, Any]] = {}
        self.intent_ids: dict[str, str] = {}
        self.queue_ids: dict[str, str] = {}
        self.theme_ids: dict[str, str] = {}
        self.tickets: list[dict[str, Any]] = []
        self.timeline: list[dict[str, Any]] = []
        self.links: list[dict[str, Any]] = []
        self.ticket_themes: list[dict[str, Any]] = []
        self.decisions: list[dict[str, Any]] = []
        self.comments: list[dict[str, Any]] = []
        self.chiefs: list[dict[str, Any]] = []
        self.lead: dict[str, Any] = {}

    # --- reference data --------------------------------------------------

    def build_reference(self) -> None:
        for code, name, city, country, region, tier in fx.AGENCIES:
            row = dict(
                id=new_id(),
                code=code,
                name=name,
                city=city,
                country=country,
                region=region,
                tier=tier,
                turbulence_score=0.0,
                created_at=self.now,
            )
            self.agencies.append(row)
            self.agency_by_code[code] = row
        for name, email, region, kind in fx.SUPPLIERS:
            self.suppliers.append(
                dict(
                    id=new_id(),
                    name=name,
                    email=email,
                    region=region,
                    kind=kind,
                    created_at=self.now,
                )
            )
        for _name, q_region, q_kind in fx.QUEUES:
            self.queue_ids[q_region or q_kind] = new_id()
        for code, _, _ in fx.THEMES:
            self.theme_ids[code] = new_id()
        for parent in PARENTS:
            self.intent_ids[parent] = new_id()
        for sub in SUB_INTENTS:
            self.intent_ids[sub.code] = new_id()

    def _shift_for(self, region: str, slot: str) -> tuple[str, str]:
        local = self.now.astimezone(ZoneInfo(REGION_TIMEZONES[region]))
        if slot == "off":
            start = (local.hour + 6) % 24
        else:
            start = (local.hour - 3) % 24
        return f"{start:02d}:00", f"{(start + 9) % 24:02d}:00"

    def build_users(self) -> None:
        pw = hash_password(get_settings().demo_password)
        for name, local, region, rank, skills, callsign, slot in fx.AGENTS:
            start, end = self._shift_for(region, slot)
            availability = {"away": "away", "busy": "busy"}.get(slot, "online")
            row = dict(
                id=new_id(),
                name=name,
                email=f"{local}@{fx.DOMAIN}",
                password_hash=pw,
                role="agent",
                callsign=callsign,
                region=region,
                languages=["en"] + (["hi"] if region == "IN" else ["ar"] if region == "AE" else []),
                skills=skills,
                shift_start=start,
                shift_end=end,
                capacity=80,
                availability=availability,
                rank=rank,
                agency_id=None,
                is_active=True,
                created_at=self.now,
            )
            self.users.append(row)
            self.agents.append(row)
        for name, local, callsign in fx.TOWER_CHIEFS:
            row = dict(
                id=new_id(),
                name=name,
                email=f"{local}@{fx.DOMAIN}",
                password_hash=pw,
                role="escalation_manager",
                callsign=callsign,
                region=None,
                languages=["en"],
                skills=[],
                shift_start=None,
                shift_end=None,
                capacity=40,
                availability="online",
                rank=3,
                agency_id=None,
                is_active=True,
                created_at=self.now,
            )
            self.users.append(row)
            self.chiefs.append(row)
        name, local, callsign = fx.LEAD
        self.lead = dict(
            id=new_id(),
            name=name,
            email=f"{local}@{fx.DOMAIN}",
            password_hash=pw,
            role="lead",
            callsign=callsign,
            region=None,
            languages=["en"],
            skills=[],
            shift_start=None,
            shift_end=None,
            capacity=0,
            availability="online",
            rank=3,
            agency_id=None,
            is_active=True,
            created_at=self.now,
        )
        self.users.append(self.lead)
        for idx, name, local, callsign in fx.SUPPLIER_USERS:
            self.users.append(
                dict(
                    id=new_id(),
                    name=name,
                    email=f"{local}@{fx.DOMAIN}",
                    password_hash=pw,
                    role="supplier",
                    callsign=callsign,
                    region=self.suppliers[idx]["region"],
                    languages=["en"],
                    skills=[],
                    shift_start=None,
                    shift_end=None,
                    capacity=0,
                    availability="online",
                    rank=1,
                    agency_id=None,
                    supplier_id=self.suppliers[idx]["id"],
                    is_active=True,
                    created_at=self.now,
                )
            )
        names = iter(fx.REQUESTER_FIRST)
        for agency in self.agencies:
            for prefix in ("pilot", "ops"):
                first = next(names)
                row = dict(
                    id=new_id(),
                    name=f"{first} ({agency['name']})",
                    email=f"{prefix}.{agency['code'].lower()}@{fx.DOMAIN}",
                    password_hash=pw,
                    role="requester",
                    callsign=f"PILOT-{agency['code']}" if prefix == "pilot" else None,
                    region=agency["region"],
                    languages=["en"],
                    skills=[],
                    shift_start=None,
                    shift_end=None,
                    capacity=0,
                    availability="online",
                    rank=1,
                    agency_id=agency["id"],
                    is_active=True,
                    created_at=self.now,
                )
                self.users.append(row)
                self.requesters_by_agency[agency["id"]].append(row)

    def _booking(
        self,
        agency: dict[str, Any],
        tboh: str,
        check_in: datetime,
        supplier_status: str = "confirmed",
        city: str | None = None,
        hotel: str | None = None,
    ) -> dict[str, Any]:
        rng = self.rng
        city = city or rng.choice(list(fx.HOTELS))
        hotel = hotel or rng.choice(fx.HOTELS[city])
        supplier = rng.choice(self.suppliers)
        row = dict(
            id=new_id(),
            tboh=tboh,
            agency_id=agency["id"],
            supplier_id=supplier["id"],
            hotel_name=hotel,
            destination=city,
            guest_name=rng.choice(fx.GUESTS),
            check_in=check_in,
            lcd=check_in - timedelta(days=rng.randint(1, 7)),
            amount=round(rng.uniform(120, 4200), 2),
            currency={"IN": "INR", "AE": "AED", "UK": "GBP", "SEA": "SGD"}[agency["region"]],
            supplier_status=supplier_status,
            created_at=self.now - timedelta(days=60),
        )
        self.bookings.append(row)
        self.booking_by_tboh[tboh] = row
        return row

    def build_bookings(self, count: int) -> None:
        rng = self.rng
        used: set[int] = {88213, 66120, 90009, 77341}
        # Journey fixtures first.
        saf, kon, mon, dun = (self.agency_by_code[c] for c in ("SAF", "KON", "MON", "DUN"))
        self._booking(
            saf,
            "TBOH-88213",
            self.now + timedelta(days=18),
            city="Dubai",
            hotel="Marina Pearl Hotel",
        )
        self._booking(
            kon,
            "TBOH-66120",
            self.now + timedelta(days=2),
            city="Dubai",
            hotel="Palm Crescent Resort",
        )
        self._booking(
            mon,
            "TBOH-90009",
            self.now + timedelta(hours=9),
            city="London",
            hotel="Thames View Hotel",
        )
        self._booking(
            dun,
            "TBOH-77341",
            self.now + timedelta(hours=36),
            "unconfirmed",
            city="Singapore",
            hotel="Raffles Quay Suites",
        )
        while len(self.bookings) < count:
            n = rng.randint(10000, 99999)
            if n in used:
                continue
            used.add(n)
            agency = rng.choice(self.agencies)
            check_in = self.now + timedelta(days=rng.uniform(-56, 30))
            status = "pending" if rng.random() < 0.05 else "confirmed"
            row = self._booking(agency, f"TBOH-{n}", check_in, status)
            self.bookings_by_agency[agency["id"]].append(row)

    # --- tickets ---------------------------------------------------------

    def _route(
        self, region: str, priority: str, intent_code: str, tier: int, load: dict[str, int]
    ) -> vectoring.RoutingResult:
        controllers = [
            vectoring.Controller(
                id=a["id"],
                name=a["name"],
                region=a["region"],
                shift_start=a["shift_start"],
                shift_end=a["shift_end"],
                availability=a["availability"],
                open_tickets=load.get(a["id"], 0),
                capacity=a["capacity"],
                skills=a["skills"],
                rank=a["rank"],
            )
            for a in self.agents
        ]
        return vectoring.route(
            vectoring.RoutingTicket(
                region=region, priority=priority, intent_code=intent_code, agency_tier=tier
            ),
            controllers,
            self.now,
        )

    def add_ticket(
        self,
        *,
        agency: dict[str, Any],
        intent_code: str,
        created_at: datetime,
        title: str,
        description: str,
        priority: str,
        status: str,
        tboh: str | None = None,
        owner_id: str | bool | None = True,
        load: dict[str, int] | None = None,
        light: bool = False,
        resolved_after_h: float | None = None,
    ) -> dict[str, Any]:
        rng = self.rng
        booking = self.booking_by_tboh.get(tboh) if tboh else None
        check_in = booking["check_in"] if booking else None
        lcd = booking["lcd"] if booking else None
        requester = rng.choice(self.requesters_by_agency[agency["id"]])
        resolved_at = closed_at = None
        if status in {"resolved", "closed"}:
            hours = resolved_after_h if resolved_after_h is not None else rng.uniform(0.3, 30)
            resolved_at = min(created_at + timedelta(hours=hours), self.now)
            if status == "closed":
                closed_at = min(resolved_at + timedelta(hours=rng.uniform(1, 72)), self.now)
        sla = compute_sla(
            SlaInput(
                created_at=created_at,
                now=self.now,
                priority=priority,
                check_in=check_in,
                lcd=lcd,
                resolved_at=resolved_at,
            )
        )
        tid = new_id()
        load = load if load is not None else {}
        routing_reason = None
        owner: str | None = None
        queue = self.queue_ids["triage"]
        if owner_id is True:
            result = self._route(agency["region"], priority, intent_code, agency["tier"], load)
            owner = result.chosen_id
            if owner:
                queue = self.queue_ids[result.queue_region]
                routing_reason = {
                    "reason": result.reason,
                    "preset": "balanced",
                    "total": result.total,
                    "breakdown": [p.model_dump() for p in result.breakdown],
                }
                if not light and status in OPEN_STATUSES:
                    self.decisions.append(
                        dict(
                            id=new_id(),
                            ticket_id=tid,
                            chosen_user_id=owner,
                            queue_id=queue,
                            scores=result.model_dump(mode="json"),
                            reason=result.reason,
                            preset="balanced",
                            created_at=created_at,
                        )
                    )
        elif isinstance(owner_id, str):
            owner = owner_id
            agent = next((a for a in self.agents if a["id"] == owner), None)
            queue = self.queue_ids[agent["region"]] if agent else queue
        if owner and status in OPEN_STATUSES:
            load[owner] = load.get(owner, 0) + 1
        if status == "new" and owner:
            status = "open"
        row = dict(
            id=tid,
            seq=0,
            number="",
            title=title[:200],
            description=description,
            agency_id=agency["id"],
            requester_id=requester["id"],
            tboh=tboh,
            booking_id=booking["id"] if booking else None,
            intent_id=self.intent_ids[intent_code],
            intent_confidence=round(rng.uniform(0.62, 0.97), 3),
            intent_source="auto",
            priority=priority,
            status=status,
            owner_id=owner,
            queue_id=queue,
            region=agency["region"],
            check_in=check_in,
            lcd=lcd,
            sla_due_at=sla.due_at,
            sla_state=sla.state,
            sla_elapsed_pct=sla.elapsed_pct,
            escalated_to=None,
            escalation_reason=None,
            routing_reason=routing_reason,
            contact_count=1,
            guardian_flag=False,
            is_demo=True,
            created_at=created_at,
            updated_at=closed_at or resolved_at or created_at,
            resolved_at=resolved_at,
            closed_at=closed_at,
        )
        if status == "escalated":
            chief = rng.choice(self.chiefs)
            row.update(
                owner_id=chief["id"],
                escalated_to=chief["id"],
                queue_id=self.queue_ids["escalation"],
                escalation_reason="Check-in imminent and supplier unresponsive",
            )
        self.tickets.append(row)

        def ev(type_: str, at: datetime, payload: dict[str, Any], actor: str | None = None) -> None:
            self.timeline.append(
                dict(id=new_id(), ticket_id=tid, type=type_, actor_id=actor, payload=payload, at=at)
            )

        ev(
            "created",
            created_at,
            {"priority": priority, "tboh": tboh, "channel": "pilot"},
            requester["id"],
        )
        if not light:
            ev(
                "intent_classified",
                created_at + timedelta(seconds=1),
                {
                    "code": intent_code,
                    "label": label_of(intent_code),
                    "confidence": row["intent_confidence"],
                    "source": "auto",
                },
            )
            ev(
                "sla_set",
                created_at + timedelta(seconds=2),
                {"due_at": sla.due_at.isoformat(), "state": "ok"},
            )
            if owner:
                ev(
                    "routed",
                    created_at + timedelta(seconds=3),
                    {
                        "owner_id": owner,
                        "reason": (routing_reason or {}).get("reason", "Assigned"),
                        "preset": "balanced",
                    },
                )
            if status == "escalated":
                ev(
                    "escalated",
                    created_at + timedelta(hours=1),
                    {"reason": row["escalation_reason"], "to": row["escalated_to"]},
                    owner,
                )
            if resolved_at:
                ev("status_changed", resolved_at, {"from": "open", "to": "resolved"}, owner)
            if closed_at:
                ev("status_changed", closed_at, {"from": "resolved", "to": "closed"}, owner)
            for tag in tag_themes(f"{title} {description}"):
                self.ticket_themes.append(
                    dict(
                        ticket_id=tid,
                        theme_id=self.theme_ids[tag.code],
                        score=tag.score,
                        source="auto",
                    )
                )
        return row

    def generate_tickets(self, count: int, light: bool = False) -> None:
        rng = self.rng
        codes = list(fx.INTENT_WEIGHTS)
        weights = list(fx.INTENT_WEIGHTS.values())
        saf_id = self.agency_by_code["SAF"]["id"]
        load: dict[str, int] = {}
        for _ in range(count):
            agency = rng.choice(self.agencies)
            age_days = rng.betavariate(1.0, 1.6) * 56
            created = self.now - timedelta(days=age_days, minutes=rng.randint(0, 59))
            code = rng.choices(codes, weights)[0]
            # Keep journey A's "3rd contact" exact: no extra recent Saffron refunds.
            if agency["id"] == saf_id and code.startswith("refund") and age_days < 15:
                code = "voucher.not_received"
            pool = self.bookings_by_agency[agency["id"]]
            booking = rng.choice(pool) if pool and rng.random() < 0.7 else None
            tboh = booking["tboh"] if booking else None
            text = render_example(
                code,
                rng,
                tboh=tboh,
                hotel=booking["hotel_name"] if booking else None,
                city=booking["destination"] if booking else None,
            )
            title = text if len(text) < 90 else text[:87].rsplit(" ", 1)[0] + "..."
            description = text + " " + render_example(code, rng, tboh=tboh)
            if age_days > 10:
                status = rng.choices(["closed", "resolved", "pending"], [80, 17, 3])[0]
            elif age_days > 3:
                status = rng.choices(
                    ["closed", "resolved", "open", "pending", "escalated"], [40, 25, 20, 12, 3]
                )[0]
            else:
                status = rng.choices(
                    ["open", "pending", "new", "resolved", "escalated"], [52, 18, 12, 14, 4]
                )[0]
            priority = rng.choices(["P1", "P2", "P3", "P4"], [8, 22, 45, 25])[0]
            if status in OPEN_STATUSES and not light:
                # Live queue: open flights sit inside a realistic window of their SLA.
                span = SLA_BASE_MINUTES[priority] * rng.choice([0.4, 0.7, 0.9, 1.1, 1.4])
                created = self.now - timedelta(minutes=rng.uniform(3, span))
            unassigned = status == "new" and rng.random() < 0.8
            self.add_ticket(
                agency=agency,
                intent_code=code,
                created_at=created,
                title=title,
                description=description,
                priority=priority,
                status=status,
                tboh=tboh,
                owner_id=None if unassigned else True,
                load=load,
                light=light,
            )

    def generate_theme_spike(self) -> None:
        """An 'emerging' Weather Radar theme this week: inventory sync spike."""
        rng = self.rng
        for _ in range(36):
            agency = rng.choice(self.agencies)
            created = self.now - timedelta(hours=rng.uniform(1, 96))
            text = render_example("rates.inventory_sync", rng)
            self.add_ticket(
                agency=agency,
                intent_code="rates.inventory_sync",
                created_at=created,
                title=text[:120],
                description=text + " Inventory not updated.",
                priority="P3",
                status=rng.choice(["open", "resolved", "pending"]),
            )

    def journey_fixtures(self) -> None:
        now = self.now
        priya = next(a for a in self.agents if a["callsign"] == "IN-01")
        arjun = next(a for a in self.agents if a["callsign"] == "IN-02")
        saf, kon, mon = (self.agency_by_code[c] for c in ("SAF", "KON", "MON"))

        # Journey A: two prior refund tickets on TBOH-88213.
        a1 = self.add_ticket(
            agency=saf,
            intent_code="refund.status",
            created_at=now - timedelta(days=9, hours=3),
            title="Refund status for cancelled Marina Pearl booking TBOH-88213",
            description="Booking TBOH-88213 was cancelled within free cancellation. "
            "Please share the refund status.",
            priority="P3",
            status="pending",
            tboh="TBOH-88213",
            owner_id=priya["id"],
        )
        a2 = self.add_ticket(
            agency=saf,
            intent_code="refund.delay",
            created_at=now - timedelta(days=4, hours=6),
            title="Refund for TBOH-88213 still not received",
            description="Following up again: refund for TBOH-88213 still pending, "
            "the guest keeps calling us.",
            priority="P3",
            status="open",
            tboh="TBOH-88213",
            owner_id=priya["id"],
        )
        self.links.append(
            dict(
                id=new_id(),
                ticket_a=min(a1["id"], a2["id"]),
                ticket_b=max(a1["id"], a2["id"]),
                link_type="tboh",
                strength=1.0,
                reason="Same booking TBOH-88213",
                created_by=None,
                created_at=a2["created_at"],
            )
        )

        # Journey C: open Frequency with two suppliers and one internal recipient.
        c1 = self.add_ticket(
            agency=kon,
            intent_code="supplier.confirmation_pending",
            created_at=now - timedelta(hours=20),
            title="Hotel cannot find reservation TBOH-66120, guest arrives in 2 days",
            description="Palm Crescent Resort says there is no booking under "
            "TBOH-66120. Please confirm with the supplier urgently.",
            priority="P2",
            status="open",
            tboh="TBOH-66120",
            owner_id=priya["id"],
        )
        self.journey_c_ticket = c1
        self.journey_c_owner = priya

        # Journey D: check-in in 9 hours, already at risk and about to go critical.
        self.add_ticket(
            agency=mon,
            intent_code="voucher.confirmation_number",
            created_at=now - timedelta(minutes=48),
            title="Guest checks in tonight, hotel has no confirmation number for TBOH-90009",
            description="Thames View Hotel cannot see the reservation. Guest lands in "
            "London tonight; please share the hotel confirmation number.",
            priority="P2",
            status="open",
            tboh="TBOH-90009",
            owner_id=arjun["id"],
        )

    # --- links -------------------------------------------------------------

    def build_links(self) -> None:
        seen = {(lk["ticket_a"], lk["ticket_b"]) for lk in self.links}

        def link(
            a: dict[str, Any], b: dict[str, Any], kind: str, strength: float, reason: str
        ) -> None:
            x, y = sorted((a["id"], b["id"]))
            if (x, y) in seen:
                return
            seen.add((x, y))
            self.links.append(
                dict(
                    id=new_id(),
                    ticket_a=x,
                    ticket_b=y,
                    link_type=kind,
                    strength=strength,
                    reason=reason,
                    created_by=None,
                    created_at=max(a["created_at"], b["created_at"]),
                )
            )

        by_tboh: dict[str, list[dict[str, Any]]] = defaultdict(list)
        by_agency_intent: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
        for t in sorted(self.tickets, key=lambda r: r["created_at"]):
            if t["tboh"]:
                for prev in by_tboh[t["tboh"]][-2:]:
                    link(t, prev, "tboh", 1.0, f"Same booking {t['tboh']}")
                by_tboh[t["tboh"]].append(t)
            key = (t["agency_id"], t["intent_id"])
            prev_list = by_agency_intent[key]
            if prev_list and (t["created_at"] - prev_list[-1]["created_at"]).days <= 30:
                link(t, prev_list[-1], "agency_intent", 0.8, "Same agency and intent")
            prev_list.append(t)

    def finalize_numbers(self) -> None:
        for i, t in enumerate(sorted(self.tickets, key=lambda r: r["created_at"])):
            t["seq"] = 24001 + i
            t["number"] = f"OD-{24001 + i}"


async def write_world(world: World, session: AsyncSession, light: bool) -> None:
    await bulk(session, m.Agency, world.agencies)
    await bulk(session, m.Supplier, world.suppliers)
    await bulk(
        session,
        m.Queue,
        [
            dict(id=world.queue_ids[region or kind], name=name, region=region, kind=kind)
            for name, region, kind in fx.QUEUES
        ],
    )
    await bulk(
        session,
        m.Intent,
        [
            dict(id=world.intent_ids[p], code=p, parent_id=None, label=label, keywords=[])
            for p, label in PARENTS.items()
        ],
    )
    await bulk(
        session,
        m.Intent,
        [
            dict(
                id=world.intent_ids[s.code],
                code=s.code,
                parent_id=world.intent_ids[parent_of(s.code)],
                label=s.label,
                keywords=s.keywords,
            )
            for s in SUB_INTENTS
        ],
    )
    await bulk(
        session,
        m.Theme,
        [
            dict(id=world.theme_ids[c], code=c, label=label, product_link=link)
            for c, label, link in fx.THEMES
        ],
    )
    await bulk(session, m.User, world.users)
    await bulk(session, m.Booking, world.bookings)
    await bulk(session, m.Ticket, world.tickets)
    await bulk(session, m.TimelineEvent, world.timeline)
    await bulk(session, m.TicketLink, world.links)
    await bulk(session, m.TicketTheme, world.ticket_themes)
    await bulk(session, m.RoutingDecision, world.decisions)
    await session.flush()

    if not light and hasattr(world, "journey_c_ticket"):
        ticket, owner = world.journey_c_ticket, world.journey_c_owner
        sup_a, sup_b = world.suppliers[0], world.suppliers[1]
        fid = new_id()
        opened = ticket["created_at"] + timedelta(minutes=20)
        session.add(
            m.Frequency(
                id=fid,
                ticket_id=ticket["id"],
                subject="Confirm reservation TBOH-66120 at Palm Crescent Resort",
                status="open",
                created_by=owner["id"],
                created_at=opened,
            )
        )
        await session.flush()
        for ptype, pid, name, email, locked in [
            ("internal", owner["id"], owner["name"], owner["email"], False),
            ("supplier", sup_a["id"], sup_a["name"], sup_a["email"], True),
            ("supplier", sup_b["id"], sup_b["name"], sup_b["email"], True),
            ("internal", None, "Finance Desk", f"finance@{fx.DOMAIN}", True),
        ]:
            session.add(
                m.FrequencyRecipient(
                    frequency_id=fid,
                    party_type=ptype,
                    party_id=pid,
                    name=name,
                    email=email,
                    locked=locked,
                    added_at=opened,
                )
            )
        for sender_type, name, body, mins in [
            (
                "internal",
                owner["name"],
                "Please confirm TBOH-66120 is live in your system; the guest arrives in 48 hours.",
                21,
            ),
            (
                "supplier",
                sup_a["name"],
                "We see the booking on our side; chasing the hotel now.",
                95,
            ),
            ("supplier", sup_b["name"], "Allotment was released by mistake, re-instating.", 240),
        ]:
            session.add(
                m.FrequencyMessage(
                    frequency_id=fid,
                    sender_type=sender_type,
                    sender_name=name,
                    body=body,
                    at=ticket["created_at"] + timedelta(minutes=mins),
                )
            )
        session.add(
            m.TimelineEvent(
                ticket_id=ticket["id"],
                type="frequency_opened",
                actor_id=owner["id"],
                at=opened,
                payload={
                    "frequency_id": fid,
                    "subject": "Confirm reservation TBOH-66120 at Palm Crescent Resort",
                },
            )
        )

    if not light:
        rng = world.rng
        open_t = [t for t in world.tickets if t["status"] in {"open", "pending"}]
        for t in rng.sample(open_t, min(250, len(open_t))):
            session.add(
                m.Comment(
                    ticket_id=t["id"],
                    visibility="external",
                    body="Thanks, we are checking with the supplier and will update you shortly.",
                    author_id=t["owner_id"],
                    created_at=t["created_at"] + timedelta(minutes=30),
                )
            )
            session.add(
                m.Comment(
                    ticket_id=t["id"],
                    visibility="internal",
                    body="Supplier desk slow today; chase again in 2h.",
                    author_id=t["owner_id"],
                    created_at=t["created_at"] + timedelta(minutes=35),
                )
            )

    # Turbulence: repeat contacts, open backlog and escalations per agency.
    from app.engines.linker import TurbulenceInput, agency_turbulence

    for agency in world.agencies:
        mine = [t for t in world.tickets if t["agency_id"] == agency["id"]]
        recent = [t for t in mine if (world.now - t["created_at"]).days <= 14]
        open_ = [t for t in mine if t["status"] in OPEN_STATUSES]
        intents_seen: dict[str, int] = defaultdict(int)
        for t in recent:
            intents_seen[t["intent_id"]] += 1
        repeats = sum(max(0, n - 1) for n in intents_seen.values())
        avg_age = (
            (sum((world.now - t["created_at"]).total_seconds() / 3600 for t in open_) / len(open_))
            if open_
            else 0.0
        )
        result = agency_turbulence(
            TurbulenceInput(
                repeat_contacts_14d=min(repeats, 8) // 2,
                open_tickets=len(open_),
                avg_unresolved_age_hours=avg_age,
                escalations_30d=sum(1 for t in mine if t["status"] == "escalated"),
                days_since_last_contact=0,
            )
        )
        await session.execute(
            update(m.Agency)
            .where(m.Agency.id == agency["id"])
            .values(turbulence_score=result.score)
        )
    # Crew Roster: HRMS (Darwinbox-style) leave, weekly off and shift changes.
    by_callsign = {a["callsign"]: a for a in world.agents}
    day = world.now.replace(hour=0, minute=0, second=0, microsecond=0)
    for callsign, kind, start, end, note, shift in [
        ("IN-02", "leave", 0, 2, "Diwali leave", None),
        ("UK-02", "weekly_off", 0, 0, "Weekly off", None),
        ("SEA-01", "shift_change", 0, 0, "Covering night desk", ("20:00", "05:00")),
        ("AE-02", "leave", 3, 5, "Annual leave", None),
        ("IN-01", "leave", 9, 11, "Training", None),
    ]:
        agent = by_callsign[callsign]
        session.add(
            m.HrRecord(
                user_id=agent["id"],
                kind=kind,
                start=day + timedelta(days=start),
                end=day + timedelta(days=end),
                note=note,
                shift_start=shift[0] if shift else None,
                shift_end=shift[1] if shift else None,
            )
        )
    await session.commit()


async def seed(total: int, seed_value: int = 42) -> None:
    started = time.perf_counter()
    settings = get_settings()
    now = utcnow()
    rng = random.Random(seed_value)

    log("training intent classifier on generated corpus")
    model = intent_engine.train()
    intent_engine.save(model, settings.intent_model_path)
    from app.engines.intent_taxonomy import HARD_EVAL, generate_corpus
    from app.services import embeddings

    base_acc = intent_engine.accuracy(model, HARD_EVAL)
    corpus = generate_corpus()
    corpus_vecs = embeddings.embed([t for t, _ in corpus])
    if corpus_vecs is not None:
        import joblib

        head = intent_engine.train_embedding_head(corpus_vecs, [c for _, c in corpus])
        joblib.dump(head, settings.intent_model_path.with_name("intent_head.joblib"))
        hard_vecs = embeddings.embed([t for t, _ in HARD_EVAL])
        hybrid_acc = intent_engine.accuracy(model, HARD_EVAL, head=head, vectors=hard_vecs)
        log(
            f"intent accuracy on hand-written phrasings: TF-IDF {base_acc:.0%} -> TF-IDF + MiniLM {hybrid_acc:.0%}"
        )
    else:
        log(
            f"intent accuracy on hand-written phrasings: TF-IDF {base_acc:.0%} (embeddings unavailable)"
        )

    world = World(now, rng)
    world.build_reference()
    world.build_users()
    world.build_bookings(400)
    log(f"generating {total:,} tickets")
    world.generate_tickets(min(total, 3_000) - 40)
    if total > 3_000:
        world.generate_tickets(total - 3_000, light=True)
    world.generate_theme_spike()
    world.journey_fixtures()
    world.build_links()
    world.finalize_numbers()

    engine = build_engine(settings.database_url)
    set_engine(engine)
    from sqlalchemy.ext.asyncio import async_sessionmaker

    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        await write_world(world, session, light=False)
    await engine.dispose()
    log(
        f"agencies={len(world.agencies)} users={len(world.users)} bookings={len(world.bookings)} "
        f"tickets={len(world.tickets):,} links={len(world.links):,} "
        f"timeline={len(world.timeline):,} in {time.perf_counter() - started:.1f}s"
    )
    log(f"demo password: {settings.demo_password}")
    for role, email in fx.DEMO_ACCOUNTS.items():
        log(f"  {role:<20} {email}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the OpsDesk demo world")
    parser.add_argument("--big", action="store_true", help="60,000 tickets for the export demo")
    parser.add_argument("--count", type=int, default=None)
    args = parser.parse_args()
    total = args.count or (60_000 if args.big else 3_000)
    print("OpsDesk seed: resetting schema", flush=True)
    reset_schema()
    asyncio.run(seed(total))


if __name__ == "__main__":
    main()

__all__ = ["INTENT_CODES", "main", "seed"]
