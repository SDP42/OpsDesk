from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import StrictModel


class LoginIn(StrictModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class AgencyBrief(BaseModel):
    id: str
    code: str
    name: str
    city: str
    country: str
    region: str
    tier: int
    turbulence_score: float


class MeOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    callsign: str | None
    region: str | None
    availability: str
    agency: AgencyBrief | None
    data_mode: str = "demo"
    onboarded: bool = False


class PreferencesIn(StrictModel):
    data_mode: Literal["demo", "live"] | None = None
    onboarded: bool | None = None


class DemoAccount(BaseModel):
    role: str
    persona: str
    name: str
    email: str
    region: str | None
    home: str
    demo_password: str | None = None
