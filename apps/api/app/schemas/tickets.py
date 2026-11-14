"""Ticket (flight) schemas: staff view, pilot (requester) view and mutations."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.auth import AgencyBrief
from app.schemas.common import StrictModel

Priority = Literal["P1", "P2", "P3", "P4"]
Status = Literal["new", "open", "pending", "escalated", "resolved", "closed"]
Preset = Literal["balanced", "urgency_first", "regional_affinity", "fairness"]


class UserBrief(BaseModel):
    id: str
    name: str
    callsign: str | None = None
    region: str | None = None
    role: str | None = None


class QueueBrief(BaseModel):
    id: str
    name: str
    kind: str
    region: str | None = None


class IntentBrief(BaseModel):
    code: str
    label: str
    confidence: float | None = None
    source: str = "auto"


class SlaOut(BaseModel):
    due_at: datetime | None
    state: str
    elapsed_pct: float
    fuel: float
    remaining_seconds: int
    urgency_driver: str
    propose_escalation: bool
    holiday_paused: bool = False
    reason: str


class TicketOut(BaseModel):
    """Staff (controller / tower chief / director) view of a flight."""

    id: str
    number: str
    title: str
    description: str
    agency: AgencyBrief
    requester_id: str | None
    tboh: str | None
    intent: IntentBrief | None
    priority: str
    status: str
    owner: UserBrief | None
    queue: QueueBrief | None
    region: str
    check_in: datetime | None
    lcd: datetime | None
    sla: SlaOut
    escalated_to: str | None
    escalation_reason: str | None
    routing_reason: dict[str, Any] | None
    contact_count: int
    guardian_flag: bool
    link_count: int = 0
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None


class PilotTicketOut(BaseModel):
    """Requester view: status, ETA and external information only (Agency Mirror uses it)."""

    id: str
    number: str
    title: str
    description: str
    tboh: str | None
    intent: IntentBrief | None
    priority: str
    status: str
    controller_callsign: str | None
    check_in: datetime | None
    eta: datetime | None
    sla_state: str
    link_count: int = 0
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None


class TimelineEventOut(BaseModel):
    id: str
    type: str
    actor: UserBrief | None
    payload: dict[str, Any]
    at: datetime


class LinkOut(BaseModel):
    id: str
    link_type: str
    strength: float
    reason: str
    other_id: str
    other_number: str
    other_title: str
    other_status: str
    other_created_at: datetime


class RoutingDecisionOut(BaseModel):
    id: str
    chosen: UserBrief | None
    preset: str
    reason: str
    scores: dict[str, Any]
    created_at: datetime


class GuardianOut(BaseModel):
    triggered: bool
    contact_count: int
    reason: str


class TicketDetailOut(BaseModel):
    ticket: TicketOut
    timeline: list[TimelineEventOut]
    links: list[LinkOut]
    routing: RoutingDecisionOut | None
    guardian: GuardianOut


class PilotTicketDetailOut(BaseModel):
    ticket: PilotTicketOut
    timeline: list[TimelineEventOut]
    links: list[LinkOut]


class TicketCreateIn(StrictModel):
    title: str = Field(min_length=4, max_length=200)
    description: str = Field(default="", max_length=5000)
    tboh: str | None = Field(default=None, max_length=24, pattern=r"^TBOH-\d{3,10}$")
    priority: Priority = "P3"
    intent_code: str | None = Field(default=None, max_length=64)
    check_in: datetime | None = None
    lcd: datetime | None = None
    agency_id: str | None = Field(default=None, max_length=32)


class TicketCreatedOut(BaseModel):
    ticket: TicketOut | PilotTicketOut
    links: list[LinkOut]
    guardian: GuardianOut
    intent_suggestion: dict[str, Any] | None


class TicketPatchIn(StrictModel):
    status: Status | None = None
    priority: Priority | None = None
    intent_code: str | None = Field(default=None, max_length=64)
    title: str | None = Field(default=None, min_length=4, max_length=200)
    note: str | None = Field(default=None, max_length=2000)


class AssignIn(StrictModel):
    user_id: str | None = Field(default=None, max_length=32)


class ReassignIn(StrictModel):
    to_user_id: str = Field(max_length=32)
    handoff_confirmed: bool = False
    note: str | None = Field(default=None, max_length=2000)


class EscalateIn(StrictModel):
    reason: str = Field(min_length=5, max_length=1000)


class RouteIn(StrictModel):
    preset: Preset | None = None


class ManualLinkIn(StrictModel):
    target: str = Field(min_length=3, max_length=32, description="Ticket number (OD-24817) or id")
    reason: str = Field(default="Linked by controller", max_length=300)


class HandoffRecipient(BaseModel):
    frequency_id: str
    frequency_subject: str
    party_type: str
    name: str
    email: str
    locked: bool


class HandoffDiffOut(BaseModel):
    from_owner: UserBrief | None
    to_owner: UserBrief
    stayed: list[HandoffRecipient]
    added: list[HandoffRecipient]
    dropped: list[HandoffRecipient]
    requires_confirmation: bool
