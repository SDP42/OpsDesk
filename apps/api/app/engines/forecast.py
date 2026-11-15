"""Breach Forecast: 'what if I escalate now?' as a NumPy Monte Carlo.

Fits a log-normal to historical resolution times for the flight's intent, simulates
completion under each action, and returns breach probability with a histogram.
"""

from __future__ import annotations

import numpy as np
from pydantic import BaseModel

ACTIONS = {
    "none": (1.0, 0.0, "Keep working as is"),
    "escalate": (0.6, 10.0, "Escalate to the Tower Chief: faster, small handover cost"),
    "reassign": (0.85, 30.0, "Reassign to a specialist: 30 min handoff, then faster"),
    "call_supplier": (0.7, 5.0, "Call the supplier now: removes most waiting time"),
}


class ForecastInput(BaseModel):
    minutes_remaining: float
    history_minutes: list[float] = []
    elapsed_minutes: float = 0.0
    samples: int = 4000
    seed: int = 7


class ActionForecast(BaseModel):
    action: str
    label: str
    breach_probability: float
    p50_minutes: float
    histogram: list[int]


class ForecastResult(BaseModel):
    actions: list[ActionForecast]
    best_action: str
    bin_edges: list[float]
    reason: str


def forecast_breach(data: ForecastInput) -> ForecastResult:
    hist = np.array([h for h in data.history_minutes if h > 0] or [240.0, 360.0, 480.0, 600.0])
    mu, sigma = float(np.log(hist).mean()), float(max(np.log(hist).std(), 0.25))
    rng = np.random.default_rng(data.seed)
    base = rng.lognormal(mu, sigma, data.samples)
    # Remaining work: condition on time already spent.
    remaining = np.maximum(base - data.elapsed_minutes, base * 0.15)
    edges = np.linspace(0, max(np.percentile(remaining, 95), data.minutes_remaining * 1.5, 30), 21)
    out = []
    for name, (factor, overhead, label) in ACTIONS.items():
        sim = remaining * factor + overhead
        p = float((sim > data.minutes_remaining).mean())
        counts, _ = np.histogram(np.clip(sim, 0, edges[-1]), bins=edges)
        out.append(
            ActionForecast(
                action=name,
                label=label,
                breach_probability=round(p, 3),
                p50_minutes=round(float(np.median(sim)), 1),
                histogram=counts.tolist(),
            )
        )
    best = min(out, key=lambda a: a.breach_probability)
    now = next(a for a in out if a.action == "none")
    head = (
        f"From {len(hist)} past resolutions (median {np.median(hist):.0f} min) and "
        f"{data.minutes_remaining:.0f} min left: breach risk {now.breach_probability:.0%} now"
    )
    if best.action == "none" or now.breach_probability - best.breach_probability < 0.02:
        reason = head + "; no action changes the odds much, so act on the root cause now"
    else:
        reason = (
            head + f"; '{best.action.replace('_', ' ')}' lowers it to {best.breach_probability:.0%}"
        )
    return ForecastResult(
        actions=out,
        best_action=best.action,
        bin_edges=[round(float(e), 1) for e in edges],
        reason=reason,
    )
