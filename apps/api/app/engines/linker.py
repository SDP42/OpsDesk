"""Linker: connect flights by TBOH, agency + intent and text similarity.

Spec section 8.3:

=============== ================================================ ===========
Link type       Rule                                             Strength
=============== ================================================ ===========
tboh            Same TBOH                                        1.00
agency_intent   Same agency and intent within 30 days            0.80
semantic        TF-IDF cosine >= 0.35 on title+description,      0.50-0.70
                same agency
manual          Added by a controller                            1.00
=============== ================================================ ===========

Third-Contact Guardian: if the same agency + intent (or the same TBOH) appears
3+ times in 14 days, link them, raise priority one level, notify the Tower
Chief and show a contact-fatigue banner.
"""

from __future__ import annotations

import math
import re
from datetime import datetime, timedelta

from pydantic import BaseModel
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.core.config import (
    GUARDIAN_CONTACT_THRESHOLD,
    GUARDIAN_WINDOW_DAYS,
    LINK_AGENCY_INTENT_DAYS,
    LINK_SEMANTIC_THRESHOLD,
)

STRENGTH = {"tboh": 1.0, "agency_intent": 0.8, "manual": 1.0}


class LinkTicket(BaseModel):
    id: str
    number: str = ""
    agency_id: str
    tboh: str | None = None
    intent_code: str | None = None
    title: str = ""
    description: str = ""
    created_at: datetime


class LinkProposal(BaseModel):
    ticket_id: str
    number: str
    link_type: str
    strength: float
    reason: str


class GuardianResult(BaseModel):
    triggered: bool
    contact_count: int
    matched_ticket_ids: list[str]
    reason: str


class LinkerResult(BaseModel):
    links: list[LinkProposal]
    guardian: GuardianResult


def normalise(text: str) -> str:
    text = text.lower()
    text = re.sub(r"tboh-?\d+", " tbohref ", text)
    text = re.sub(r"od-?\d+", " ticketref ", text)
    text = re.sub(r"\d+", " num ", text)
    return re.sub(r"[^a-z\s]", " ", text)


def _semantic_scores(new: LinkTicket, pool: list[LinkTicket]) -> dict[str, float]:
    if not pool:
        return {}
    docs = [normalise(f"{t.title} {t.description}") for t in [new, *pool]]
    if not any(d.strip() for d in docs):
        return {}
    try:
        matrix = TfidfVectorizer(
            stop_words="english", ngram_range=(1, 2), sublinear_tf=True
        ).fit_transform(docs)
    except ValueError:  # empty vocabulary
        return {}
    sims = cosine_similarity(matrix[0:1], matrix[1:]).ravel()
    return {t.id: float(s) for t, s in zip(pool, sims, strict=True)}


def find_links(new: LinkTicket, history: list[LinkTicket], now: datetime) -> LinkerResult:
    """Propose links from ``new`` to earlier tickets and evaluate the Guardian rule."""
    candidates = [t for t in history if t.id != new.id]
    best: dict[str, LinkProposal] = {}

    def offer(p: LinkProposal) -> None:
        if p.ticket_id not in best or best[p.ticket_id].strength < p.strength:
            best[p.ticket_id] = p

    for t in candidates:
        if new.tboh and t.tboh == new.tboh:
            offer(
                LinkProposal(
                    ticket_id=t.id,
                    number=t.number,
                    link_type="tboh",
                    strength=1.0,
                    reason=f"Same booking {new.tboh}",
                )
            )
        elif (
            new.intent_code
            and t.agency_id == new.agency_id
            and t.intent_code == new.intent_code
            and now - t.created_at <= timedelta(days=LINK_AGENCY_INTENT_DAYS)
        ):
            days = (now - t.created_at).days
            offer(
                LinkProposal(
                    ticket_id=t.id,
                    number=t.number,
                    link_type="agency_intent",
                    strength=0.8,
                    reason=f"Same agency and intent {new.intent_code} ({days}d ago)",
                )
            )

    same_agency = [t for t in candidates if t.agency_id == new.agency_id]
    for tid, sim in _semantic_scores(new, same_agency).items():
        if sim >= LINK_SEMANTIC_THRESHOLD:
            strength = round(
                0.5 + 0.2 * (sim - LINK_SEMANTIC_THRESHOLD) / (1 - LINK_SEMANTIC_THRESHOLD), 2
            )
            num = next(t.number for t in same_agency if t.id == tid)
            offer(
                LinkProposal(
                    ticket_id=tid,
                    number=num,
                    link_type="semantic",
                    strength=min(strength, 0.7),
                    reason=f"Similar wording (cosine {sim:.2f})",
                )
            )

    links = sorted(best.values(), key=lambda p: (-p.strength, p.number))
    return LinkerResult(links=links, guardian=third_contact_guardian(new, candidates, now))


def third_contact_guardian(
    new: LinkTicket, history: list[LinkTicket], now: datetime
) -> GuardianResult:
    window = now - timedelta(days=GUARDIAN_WINDOW_DAYS)
    matched = [
        t
        for t in history
        if t.created_at >= window
        and t.agency_id == new.agency_id
        and (
            (new.tboh is not None and t.tboh == new.tboh)
            or (new.intent_code is not None and t.intent_code == new.intent_code)
        )
    ]
    count = len(matched) + 1
    triggered = count >= GUARDIAN_CONTACT_THRESHOLD
    on = f"booking {new.tboh}" if new.tboh else f"intent {new.intent_code}"
    ordinal = {1: "1st", 2: "2nd", 3: "3rd"}.get(count, f"{count}th")
    reason = f"{ordinal} contact in {GUARDIAN_WINDOW_DAYS} days on {on}" + (
        "; priority raised and Tower Chief notified" if triggered else ""
    )
    return GuardianResult(
        triggered=triggered,
        contact_count=count,
        matched_ticket_ids=[t.id for t in matched],
        reason=reason,
    )


class TurbulenceInput(BaseModel):
    repeat_contacts_14d: int = 0
    open_tickets: int = 0
    avg_unresolved_age_hours: float = 0.0
    escalations_30d: int = 0
    days_since_last_contact: float = 0.0


class TurbulenceResult(BaseModel):
    score: float  # 0 calm .. 100 severe
    band: str
    reason: str


def agency_turbulence(data: TurbulenceInput) -> TurbulenceResult:
    """Churn-risk meter: rises with repeat contacts, unresolved age and escalations; decays."""
    repeats = 12.0 * data.repeat_contacts_14d
    age = 0.25 * min(data.avg_unresolved_age_hours, 160.0)
    esc = 15.0 * data.escalations_30d
    backlog = 2.0 * min(data.open_tickets, 10)
    decay = math.exp(-max(data.days_since_last_contact, 0.0) / 14.0)
    score = round(min(100.0, (repeats + age + esc + backlog) * decay), 1)
    band = (
        "severe"
        if score >= 70
        else "moderate"
        if score >= 40
        else "light"
        if score >= 15
        else "calm"
    )
    reason = (
        f"{data.repeat_contacts_14d} repeat contacts (+{repeats:g}), "
        f"unresolved age (+{age:.0f}), {data.escalations_30d} escalations (+{esc:g}), "
        f"backlog (+{backlog:g}), decay x{decay:.2f}"
    )
    return TurbulenceResult(score=score, band=band, reason=reason)
