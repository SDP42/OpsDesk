"""Frustration Radar: detect agency frustration (Round two #7).

Stub for the BASE run. Backend piece: Lexicon plus VADER-style scoring; feeds turbulence and priority bump.
TODO(phase-4): implement; keep it pure and return a human-readable reason.
"""

from __future__ import annotations

from pydantic import BaseModel


class FrustrationResult(BaseModel):
    score: float
    signals: list[str]
    calm_reply: str
    reason: str


def score_frustration(text: str) -> FrustrationResult:
    """Score frustration 0..1. TODO(phase-4): lexicon + caps + repetition."""
    return FrustrationResult(score=0.0, signals=[], calm_reply="", reason="stub: not implemented")
