"""Ghost Flights: predict which bookings will turn into tickets before the agency writes in.

A scikit-learn GradientBoostingClassifier is trained on a synthetic, labelled history
of bookings (supplier confirmation lag, rate change, check-in proximity, agency repeat
contacts, supplier response speed, earlier cases on the booking). Each prediction
returns its top drivers in plain language and a recommended pre-emptive message.
"""

from __future__ import annotations

import random
from functools import lru_cache

import numpy as np
from pydantic import BaseModel
from sklearn.ensemble import GradientBoostingClassifier

FEATURES = [
    "supplier_unconfirmed",
    "hours_to_check_in",
    "rate_changed",
    "agency_repeat_contacts",
    "supplier_slow",
    "earlier_cases",
]


class GhostInput(BaseModel):
    tboh: str
    supplier_status: str = "confirmed"  # confirmed | pending | unconfirmed
    hours_to_check_in: float = 999.0
    rate_changed: bool = False
    agency_repeat_contacts: int = 0
    supplier_median_reply_minutes: float = 60.0
    earlier_cases: int = 0


class GhostDriver(BaseModel):
    feature: str
    label: str
    impact: float


class GhostPrediction(BaseModel):
    tboh: str
    risk: float
    band: str
    drivers: list[GhostDriver]
    recommended_message: str
    reason: str


def _vector(d: GhostInput) -> list[float]:
    return [
        1.0 if d.supplier_status in {"pending", "unconfirmed"} else 0.0,
        min(max(d.hours_to_check_in, 0.0), 240.0),
        1.0 if d.rate_changed else 0.0,
        float(min(d.agency_repeat_contacts, 10)),
        1.0 if d.supplier_median_reply_minutes > 180 else 0.0,
        float(min(d.earlier_cases, 5)),
    ]


def _synthetic(n: int = 4000, seed: int = 11) -> tuple[np.ndarray, np.ndarray]:
    """Labelled history: a known risk process plus noise, so the model has signal to learn."""
    rng = random.Random(seed)
    xs, ys = [], []
    for _ in range(n):
        unconf = 1.0 if rng.random() < 0.18 else 0.0
        hours = rng.uniform(0, 240)
        rate = 1.0 if rng.random() < 0.12 else 0.0
        repeats = float(rng.choice([0, 0, 0, 1, 1, 2, 3, 4]))
        slow = 1.0 if rng.random() < 0.2 else 0.0
        earlier = float(rng.choice([0, 0, 0, 1, 2]))
        logit = (
            -3.2
            + 2.6 * unconf
            + 1.6 * (hours < 48)
            + 0.9 * (hours < 12)
            + 1.4 * rate
            + 0.45 * repeats
            + 1.1 * slow
            + 0.6 * earlier
            + 1.2 * unconf * (hours < 48)
        )
        p = 1 / (1 + np.exp(-logit))
        xs.append([unconf, hours, rate, repeats, slow, earlier])
        ys.append(1 if rng.random() < p else 0)
    return np.array(xs), np.array(ys)


@lru_cache(maxsize=1)
def model() -> GradientBoostingClassifier:
    x, y = _synthetic()
    clf = GradientBoostingClassifier(
        n_estimators=120, max_depth=3, learning_rate=0.08, random_state=7
    )
    clf.fit(x, y)
    return clf


_LABELS = {
    "supplier_unconfirmed": "supplier has not confirmed",
    "hours_to_check_in": "check-in is close",
    "rate_changed": "rate changed after booking",
    "agency_repeat_contacts": "agency has contacted us repeatedly",
    "supplier_slow": "supplier replies slowly",
    "earlier_cases": "earlier cases on this booking",
}

_MESSAGES = {
    "supplier_unconfirmed": "Hi, quick heads-up on {tboh}: we are chasing the supplier for confirmation and will send the hotel confirmation number shortly. No action needed from you.",
    "hours_to_check_in": "Hi, your guest checks in soon on {tboh}. We have re-verified the reservation with the hotel so arrival is smooth.",
    "rate_changed": "Hi, the rate on {tboh} moved after booking. Your price is protected; nothing changes for you or the guest.",
    "agency_repeat_contacts": "Hi, we have put {tboh} under a named controller so you get one owner and proactive updates.",
    "supplier_slow": "Hi, we are escalating {tboh} with the supplier's priority desk and will update you within 2 hours.",
    "earlier_cases": "Hi, we have linked your earlier cases on {tboh} so nobody asks you to explain again.",
}


def score_booking(data: GhostInput) -> GhostPrediction:
    """Risk that this booking becomes a ticket, with drivers measured by feature ablation."""
    clf = model()
    base = _vector(data)
    risk = float(clf.predict_proba(np.array([base]))[0][1])
    neutral = [0.0, 240.0, 0.0, 0.0, 0.0, 0.0]
    drivers: list[GhostDriver] = []
    for i, name in enumerate(FEATURES):
        probe = list(base)
        probe[i] = neutral[i]
        delta = risk - float(clf.predict_proba(np.array([probe]))[0][1])
        if delta > 0.02:
            drivers.append(GhostDriver(feature=name, label=_LABELS[name], impact=round(delta, 3)))
    drivers.sort(key=lambda d: -d.impact)
    band = "high" if risk >= 0.6 else "medium" if risk >= 0.35 else "low"
    top = drivers[0].feature if drivers else "hours_to_check_in"
    reason = f"{risk:.0%} chance this booking becomes a ticket; biggest drivers: " + (
        ", ".join(f"{d.label} (+{d.impact:.0%})" for d in drivers[:3]) or "none"
    )
    return GhostPrediction(
        tboh=data.tboh,
        risk=round(risk, 3),
        band=band,
        drivers=drivers[:4],
        recommended_message=_MESSAGES[top].format(tboh=data.tboh),
        reason=reason,
    )
