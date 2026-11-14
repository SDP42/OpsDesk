"""Breach Forecast: 'what if I escalate now?' Monte Carlo (Round two #2).

Stub for the BASE run. Backend piece: NumPy Monte Carlo over per-intent historical resolution times; POST /tickets/{id}/forecast.
TODO(phase-4): implement; keep it pure and return a human-readable reason.
"""

from __future__ import annotations

from pydantic import BaseModel


class ForecastInput(BaseModel):
    minutes_remaining: float
    intent_code: str | None = None
    action: str = "none"
    samples: int = 2000


class ForecastResult(BaseModel):
    breach_probability: float
    histogram: list[int]
    reason: str


def forecast_breach(data: ForecastInput) -> ForecastResult:
    """Estimate breach probability under an action. TODO(phase-4): Monte Carlo."""
    return ForecastResult(breach_probability=0.0, histogram=[], reason="stub: not implemented")
