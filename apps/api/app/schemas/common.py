"""Envelope types: every success is { data } and every list adds a cursor."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class StrictModel(BaseModel):
    """Request bodies reject unknown fields and strip whitespace."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Envelope[T](BaseModel):
    data: T


class PageMeta(BaseModel):
    next_cursor: str | None = None
    count: int


class Page[T](BaseModel):
    data: list[T]
    meta: PageMeta


class Ok(BaseModel):
    ok: bool = True
