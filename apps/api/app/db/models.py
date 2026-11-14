"""SQLAlchemy 2.0 models for every table in spec section 7.

Cases, links, conversations and decisions live in separate tables so every UI
claim can be traced back to a row.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UTCDateTime, new_id, utcnow

# --- Enumerations (stored as strings for portability) ------------------------

ROLES = ("requester", "agent", "escalation_manager", "lead")
AVAILABILITY = ("online", "busy", "away")
PRIORITIES = ("P1", "P2", "P3", "P4")
STATUSES = ("new", "open", "pending", "escalated", "resolved", "closed")
SLA_STATES = ("ok", "at_risk", "critical", "breached", "paused", "met")
LINK_TYPES = ("tboh", "agency_intent", "semantic", "manual")
VISIBILITIES = ("internal", "external")
PARTY_TYPES = ("supplier", "agency", "internal")
QUEUE_KINDS = ("triage", "region", "escalation")


def _id() -> Mapped[str]:
    return mapped_column(String(32), primary_key=True, default=new_id)


def _created() -> Mapped[datetime]:
    return mapped_column(UTCDateTime(), default=utcnow, nullable=False)


class Agency(Base):
    """An airport: the requester's origin, with a churn-risk (turbulence) meter."""

    __tablename__ = "agencies"

    id: Mapped[str] = _id()
    code: Mapped[str] = mapped_column(String(8), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    city: Mapped[str] = mapped_column(String(80))
    country: Mapped[str] = mapped_column(String(80))
    region: Mapped[str] = mapped_column(String(8), index=True)
    tier: Mapped[int] = mapped_column(Integer, default=2)  # 1 platinum .. 3 standard
    turbulence_score: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = _created()


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = _id()
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), index=True)
    callsign: Mapped[str | None] = mapped_column(String(32))
    region: Mapped[str | None] = mapped_column(String(8), index=True)
    languages: Mapped[list[str]] = mapped_column(JSON, default=list)
    skills: Mapped[list[str]] = mapped_column(JSON, default=list)
    shift_start: Mapped[str | None] = mapped_column(String(5))  # "HH:MM" regional time
    shift_end: Mapped[str | None] = mapped_column(String(5))
    capacity: Mapped[int] = mapped_column(Integer, default=20)
    availability: Mapped[str] = mapped_column(String(8), default="online")
    rank: Mapped[int] = mapped_column(Integer, default=1)  # 1 junior .. 3 senior
    agency_id: Mapped[str | None] = mapped_column(
        ForeignKey("agencies.id", ondelete="SET NULL"), index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = _created()

    agency: Mapped[Agency | None] = relationship(lazy="joined")


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[str] = _id()
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254))
    region: Mapped[str] = mapped_column(String(8))
    kind: Mapped[str] = mapped_column(String(16), default="hotel")
    created_at: Mapped[datetime] = _created()


class Booking(Base):
    """A flight path: the TBOH booking every related ticket shares."""

    __tablename__ = "bookings"

    id: Mapped[str] = _id()
    tboh: Mapped[str] = mapped_column(String(24), unique=True)
    agency_id: Mapped[str] = mapped_column(ForeignKey("agencies.id"), index=True)
    supplier_id: Mapped[str] = mapped_column(ForeignKey("suppliers.id"), index=True)
    hotel_name: Mapped[str] = mapped_column(String(160))
    destination: Mapped[str] = mapped_column(String(80))
    guest_name: Mapped[str] = mapped_column(String(120), default="")
    check_in: Mapped[datetime] = mapped_column(UTCDateTime())
    lcd: Mapped[datetime | None] = mapped_column(UTCDateTime())  # last cancellation date
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(3))
    supplier_status: Mapped[str] = mapped_column(String(16), default="confirmed")
    created_at: Mapped[datetime] = _created()

    agency: Mapped[Agency] = relationship(lazy="joined")
    supplier: Mapped[Supplier] = relationship(lazy="joined")


class Intent(Base):
    __tablename__ = "intents"

    id: Mapped[str] = _id()
    code: Mapped[str] = mapped_column(String(64), unique=True)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("intents.id"), index=True)
    label: Mapped[str] = mapped_column(String(120))
    keywords: Mapped[list[str]] = mapped_column(JSON, default=list)


class Queue(Base):
    __tablename__ = "queues"

    id: Mapped[str] = _id()
    name: Mapped[str] = mapped_column(String(80), unique=True)
    region: Mapped[str | None] = mapped_column(String(8))
    kind: Mapped[str] = mapped_column(String(16))


class Ticket(Base):
    """A flight: one case, with a flight number like OD-24817."""

    __tablename__ = "tickets"
    __table_args__ = (
        Index("ix_tickets_status_sla_due", "status", "sla_due_at"),
        Index("ix_tickets_agency_intent_created", "agency_id", "intent_id", "created_at"),
        Index("ix_tickets_created_id", "created_at", "id"),
    )

    id: Mapped[str] = _id()
    seq: Mapped[int] = mapped_column(Integer, unique=True)
    number: Mapped[str] = mapped_column(String(16), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    agency_id: Mapped[str] = mapped_column(ForeignKey("agencies.id"), index=True)
    requester_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    tboh: Mapped[str | None] = mapped_column(String(24), index=True)
    booking_id: Mapped[str | None] = mapped_column(
        ForeignKey("bookings.id", ondelete="SET NULL"), index=True
    )
    intent_id: Mapped[str | None] = mapped_column(ForeignKey("intents.id"), index=True)
    intent_confidence: Mapped[float | None] = mapped_column(Float)
    intent_source: Mapped[str] = mapped_column(String(16), default="auto")
    priority: Mapped[str] = mapped_column(String(2), default="P3")
    status: Mapped[str] = mapped_column(String(16), default="new", index=True)
    owner_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    queue_id: Mapped[str | None] = mapped_column(ForeignKey("queues.id"), index=True)
    region: Mapped[str] = mapped_column(String(8), index=True)
    check_in: Mapped[datetime | None] = mapped_column(UTCDateTime())
    lcd: Mapped[datetime | None] = mapped_column(UTCDateTime())
    sla_due_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    sla_state: Mapped[str] = mapped_column(String(16), default="ok", index=True)
    sla_elapsed_pct: Mapped[float] = mapped_column(Float, default=0.0)
    escalated_to: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    escalation_reason: Mapped[str | None] = mapped_column(Text)
    routing_reason: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    contact_count: Mapped[int] = mapped_column(Integer, default=1)
    guardian_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, onupdate=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    closed_at: Mapped[datetime | None] = mapped_column(UTCDateTime())

    agency: Mapped[Agency] = relationship(lazy="joined")
    intent: Mapped[Intent | None] = relationship(lazy="joined")
    owner: Mapped[User | None] = relationship(foreign_keys=[owner_id], lazy="joined")
    queue: Mapped[Queue | None] = relationship(lazy="joined")


class TicketLink(Base):
    """An edge in the Constellation. Unique on the (ordered) pair."""

    __tablename__ = "ticket_links"
    __table_args__ = (UniqueConstraint("ticket_a", "ticket_b", name="uq_ticket_links_pair"),)

    id: Mapped[str] = _id()
    ticket_a: Mapped[str] = mapped_column(ForeignKey("tickets.id", ondelete="CASCADE"), index=True)
    ticket_b: Mapped[str] = mapped_column(ForeignKey("tickets.id", ondelete="CASCADE"), index=True)
    link_type: Mapped[str] = mapped_column(String(16))
    strength: Mapped[float] = mapped_column(Float)
    reason: Mapped[str] = mapped_column(String(300), default="")
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = _created()


class TimelineEvent(Base):
    """Append-only activity log; the timeline scrubber replays it."""

    __tablename__ = "timeline_events"
    __table_args__ = (Index("ix_timeline_ticket_at", "ticket_id", "at"),)

    id: Mapped[str] = _id()
    ticket_id: Mapped[str] = mapped_column(ForeignKey("tickets.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(40))
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class Comment(Base):
    __tablename__ = "comments"
    __table_args__ = (Index("ix_comments_ticket_created", "ticket_id", "created_at"),)

    id: Mapped[str] = _id()
    ticket_id: Mapped[str] = mapped_column(ForeignKey("tickets.id", ondelete="CASCADE"))
    visibility: Mapped[str] = mapped_column(String(10))
    body: Mapped[str] = mapped_column(Text)
    author_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    created_at: Mapped[datetime] = _created()

    author: Mapped[User | None] = relationship(lazy="joined")


class Frequency(Base):
    """A side conversation: a radio channel with its own explicit recipients."""

    __tablename__ = "frequencies"

    id: Mapped[str] = _id()
    ticket_id: Mapped[str] = mapped_column(ForeignKey("tickets.id", ondelete="CASCADE"), index=True)
    subject: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(10), default="open")
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = _created()

    recipients: Mapped[list[FrequencyRecipient]] = relationship(
        lazy="selectin", cascade="all, delete-orphan", order_by="FrequencyRecipient.added_at"
    )


class FrequencyRecipient(Base):
    """Independent of the ticket group, so it survives transfers."""

    __tablename__ = "frequency_recipients"

    id: Mapped[str] = _id()
    frequency_id: Mapped[str] = mapped_column(
        ForeignKey("frequencies.id", ondelete="CASCADE"), index=True
    )
    party_type: Mapped[str] = mapped_column(String(10))
    party_id: Mapped[str | None] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254))
    locked: Mapped[bool] = mapped_column(Boolean, default=True)
    added_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    removed_at: Mapped[datetime | None] = mapped_column(UTCDateTime())


class FrequencyMessage(Base):
    __tablename__ = "frequency_messages"

    id: Mapped[str] = _id()
    frequency_id: Mapped[str] = mapped_column(
        ForeignKey("frequencies.id", ondelete="CASCADE"), index=True
    )
    sender_type: Mapped[str] = mapped_column(String(10))  # internal | supplier | agency
    sender_name: Mapped[str] = mapped_column(String(120))
    sender_id: Mapped[str | None] = mapped_column(String(32))
    body: Mapped[str] = mapped_column(Text)
    at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class Theme(Base):
    __tablename__ = "themes"

    id: Mapped[str] = _id()
    code: Mapped[str] = mapped_column(String(48), unique=True)
    label: Mapped[str] = mapped_column(String(120))
    product_link: Mapped[str | None] = mapped_column(String(300))


class TicketTheme(Base):
    __tablename__ = "ticket_themes"

    ticket_id: Mapped[str] = mapped_column(
        ForeignKey("tickets.id", ondelete="CASCADE"), primary_key=True
    )
    theme_id: Mapped[str] = mapped_column(ForeignKey("themes.id"), primary_key=True, index=True)
    score: Mapped[float] = mapped_column(Float, default=1.0)
    source: Mapped[str] = mapped_column(String(10), default="auto")


class RoutingDecision(Base):
    """Powers the Vectoring Explainer and the simulator."""

    __tablename__ = "routing_decisions"

    id: Mapped[str] = _id()
    ticket_id: Mapped[str] = mapped_column(ForeignKey("tickets.id", ondelete="CASCADE"), index=True)
    chosen_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    queue_id: Mapped[str | None] = mapped_column(ForeignKey("queues.id"))
    scores: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    reason: Mapped[str] = mapped_column(String(400))
    preset: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = _created()


class AuditLog(Base):
    __tablename__ = "audit_log"
    __table_args__ = (Index("ix_audit_entity", "entity", "entity_id"),)

    id: Mapped[str] = _id()
    actor_id: Mapped[str | None] = mapped_column(String(32), index=True)
    action: Mapped[str] = mapped_column(String(64))
    entity: Mapped[str] = mapped_column(String(32))
    entity_id: Mapped[str | None] = mapped_column(String(32))
    meta: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    ip: Mapped[str | None] = mapped_column(String(64))
    at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class ArchiveTicket(Base):
    """Cold-ish storage for closed tickets past the retention window (section 8.6)."""

    __tablename__ = "archive_tickets"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    number: Mapped[str] = mapped_column(String(16), index=True)
    title: Mapped[str] = mapped_column(String(200))
    agency_id: Mapped[str] = mapped_column(String(32), index=True)
    tboh: Mapped[str | None] = mapped_column(String(24), index=True)
    intent_code: Mapped[str | None] = mapped_column(String(64))
    priority: Mapped[str] = mapped_column(String(2))
    status: Mapped[str] = mapped_column(String(16))
    region: Mapped[str] = mapped_column(String(8))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime())
    resolved_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    closed_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    archived_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
