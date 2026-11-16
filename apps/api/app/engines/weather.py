"""Weather Radar: themes and turbulence from conversations (spec section 8.5).

Keyword-lexicon tagging plus weekly aggregation with week-over-week change. A theme is
flagged "emerging" only when its z-score against the previous six weeks is >= 2.5 and it
is at least 2.5x the average of the last four weeks (see ``is_emerging``).
"""

from __future__ import annotations

import statistics
from collections import Counter, defaultdict
from datetime import datetime

from pydantic import BaseModel

THEME_LEXICON: dict[str, tuple[str, list[str]]] = {
    "refund_delay": ("Refund delay", ["refund", "refunded", "not received", "still no"]),
    "inventory_sync": (
        "Inventory sync",
        ["inventory", "sold out", "allotment", "stop sell", "showing available"],
    ),
    "overbooking": ("Overbooking", ["overbooked", "overbooking", "walked", "no room"]),
    "rate_mismatch": ("Rate mismatch", ["rate", "price", "mismatch", "discrepancy"]),
    "voucher_issue": ("Voucher issue", ["voucher", "confirmation number", "hcn"]),
    "special_request": (
        "Special request",
        ["early check-in", "late checkout", "wheelchair", "meal", "accessible"],
    ),
    "payment_failure": (
        "Payment failure",
        ["payment failed", "declined", "charged twice", "duplicate", "credit limit"],
    ),
    "platform_outage": ("Platform outage", ["api", "timeout", "login", "500", "search not"]),
    "supplier_silence": (
        "Supplier silence",
        ["not confirmed", "awaiting", "supplier has not", "on request"],
    ),
    "visa_docs": ("Visa and documents", ["visa", "passport", "documents"]),
}


class ThemeTag(BaseModel):
    code: str
    label: str
    score: float
    matched: list[str]


def tag_themes(text: str, max_themes: int = 2) -> list[ThemeTag]:
    """Tag text with up to ``max_themes`` themes; the score is the share of matched keywords."""
    lower = text.lower()
    tags: list[ThemeTag] = []
    for code, (label, words) in THEME_LEXICON.items():
        hits = [w for w in words if w in lower]
        if hits:
            tags.append(
                ThemeTag(
                    code=code,
                    label=label,
                    score=round(min(1.0, 0.5 + 0.25 * len(hits)), 2),
                    matched=hits,
                )
            )
    tags.sort(key=lambda t: (-t.score, t.code))
    return tags[:max_themes]


class ThemeObservation(BaseModel):
    theme: str
    ticket_id: str
    agency_id: str
    created_at: datetime


class ThemeWeek(BaseModel):
    theme: str
    label: str
    count: int
    previous: int
    wow_change_pct: float | None
    agencies: int
    zscore: float | None
    emerging: bool
    sample_ticket_ids: list[str]
    reason: str


def iso_week(dt: datetime) -> str:
    year, week, _ = dt.isocalendar()
    return f"{year}-W{week:02d}"


def is_emerging(current: int, history: list[int]) -> bool:
    """A spike, not a trend: z >= 2.5 AND at least 2.5x the last four weeks' average."""
    z = emerging_zscore(current, history)
    if z is None or not history:
        return False
    recent = history[-4:]
    return z >= 2.5 and current >= 2.5 * max(statistics.fmean(recent), 1.0)


def emerging_zscore(current: int, history: list[int]) -> float | None:
    """z-score of this week's count against previous weeks (needs >= 3 weeks)."""
    if len(history) < 3:
        return None
    mean = statistics.fmean(history)
    stdev = statistics.pstdev(history) or 1.0
    return round((current - mean) / stdev, 2)


def aggregate_week(
    observations: list[ThemeObservation], week: str, weeks_back: int = 6
) -> list[ThemeWeek]:
    """Aggregate theme counts for ``week`` with week-over-week change and emerging flag."""
    by_week: dict[str, Counter[str]] = defaultdict(Counter)
    samples: dict[str, list[str]] = defaultdict(list)
    agencies: dict[str, set[str]] = defaultdict(set)
    for obs in observations:
        wk = iso_week(obs.created_at)
        by_week[wk][obs.theme] += 1
        if wk == week:
            agencies[obs.theme].add(obs.agency_id)
            if len(samples[obs.theme]) < 5:
                samples[obs.theme].append(obs.ticket_id)
    ordered = sorted(w for w in by_week if w < week)[-weeks_back:]
    prev_week = ordered[-1] if ordered else None
    out: list[ThemeWeek] = []
    for theme, count in by_week.get(week, Counter()).most_common():
        previous = by_week[prev_week][theme] if prev_week else 0
        wow = round((count - previous) / previous * 100, 1) if previous else None
        z = emerging_zscore(count, [by_week[w][theme] for w in ordered])
        emerging = is_emerging(count, [by_week[w][theme] for w in ordered])
        label = THEME_LEXICON.get(theme, (theme, []))[0]
        reason = f"{count} this week vs {previous} last week" + (
            f"; z={z:g}" if z is not None else ""
        )
        out.append(
            ThemeWeek(
                theme=theme,
                label=label,
                count=count,
                previous=previous,
                wow_change_pct=wow,
                agencies=len(agencies[theme]),
                zscore=z,
                emerging=emerging,
                sample_ticket_ids=samples[theme],
                reason=reason,
            )
        )
    return out
