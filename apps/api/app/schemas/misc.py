"""Intents, insights, meta, stats and admin schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import StrictModel


class IntentNode(BaseModel):
    code: str
    label: str
    children: list[IntentNode] = []


class SuggestIn(StrictModel):
    text: str = Field(min_length=1, max_length=5000)


class IntentCandidateOut(BaseModel):
    code: str
    label: str
    confidence: float


class SuggestOut(BaseModel):
    top: list[IntentCandidateOut]
    needs_human: bool
    rule: str | None
    reason: str


class ThemeSample(BaseModel):
    id: str
    number: str
    title: str


class ThemeWeekOut(BaseModel):
    theme: str
    label: str
    count: int
    previous: int
    wow_change_pct: float | None
    agencies: int
    zscore: float | None
    emerging: bool
    product_link: str | None
    samples: list[ThemeSample]
    reason: str


class InsightsOut(BaseModel):
    week: str
    total_tickets: int
    themes: list[ThemeWeekOut]


class BookingOut(BaseModel):
    tboh: str
    hotel_name: str
    destination: str
    guest_name: str
    check_in: datetime
    lcd: datetime | None
    supplier_name: str
    supplier_status: str
    earlier_cases: list[dict[str, str]]


class ControllerOut(BaseModel):
    id: str
    name: str
    callsign: str | None
    role: str
    region: str | None
    availability: str
    rank: int
    capacity: int
    open_tickets: int
    on_shift: bool
    shift: str | None


class OverviewOut(BaseModel):
    open: int
    unassigned: int
    escalated: int
    by_sla: dict[str, int]
    by_region: dict[str, int]
    by_status: dict[str, int]
    preset: str


class PresetIn(StrictModel):
    preset: str = Field(pattern=r"^(balanced|urgency_first|regional_affinity|fairness)$")


class ArchiveRunIn(StrictModel):
    older_than_days: int | None = Field(default=None, ge=0, le=3650)


class ArchiveRunOut(BaseModel):
    archived: int
    cutoff: datetime
    policy: str


class TrendPoint(BaseModel):
    day: str
    created: int
    resolved: int
    breached: int


class IntentShare(BaseModel):
    parent: str
    count: int


class TrendOut(BaseModel):
    days: list[TrendPoint]
    intents: list[IntentShare]
    agencies_at_risk: list[dict[str, object]]
