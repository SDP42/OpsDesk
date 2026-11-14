"""Comments (internal notes vs external replies) and Frequencies (side conversations)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import StrictModel
from app.schemas.tickets import UserBrief


class CommentIn(StrictModel):
    body: str = Field(min_length=1, max_length=5000)


class CommentOut(BaseModel):
    id: str
    visibility: str
    body: str
    author: UserBrief | None
    created_at: datetime


class RecipientIn(StrictModel):
    party_type: Literal["supplier", "agency", "internal"]
    party_id: str | None = Field(default=None, max_length=32)
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    locked: bool = True


class RecipientOut(BaseModel):
    id: str
    party_type: str
    party_id: str | None
    name: str
    email: str
    locked: bool
    added_at: datetime
    removed_at: datetime | None


class FrequencyCreateIn(StrictModel):
    subject: str = Field(min_length=3, max_length=200)
    recipients: list[RecipientIn] = Field(default_factory=list, max_length=20)
    first_message: str | None = Field(default=None, max_length=5000)


class FrequencyMessageIn(StrictModel):
    body: str = Field(min_length=1, max_length=5000)


class FrequencyMessageOut(BaseModel):
    id: str
    sender_type: str
    sender_name: str
    body: str
    at: datetime


class FrequencyOut(BaseModel):
    id: str
    ticket_id: str
    subject: str
    status: str
    created_at: datetime
    recipients: list[RecipientOut]
    messages: list[FrequencyMessageOut] = []
