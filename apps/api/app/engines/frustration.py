"""Frustration Radar: agency frustration from message text.

Travel-ops lexicon (repeats, "still no update", threats to switch supplier) plus the
pretrained VADER sentiment model, capitals and exclamation rules.
"""

from __future__ import annotations

import re

from pydantic import BaseModel
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_VADER = SentimentIntensityAnalyzer()  # pretrained, rule-based sentiment lexicon (MIT)

LEXICON = {
    "again": 0.18,
    "still": 0.15,
    "third time": 0.35,
    "second time": 0.2,
    "no update": 0.3,
    "no response": 0.3,
    "nobody": 0.2,
    "unacceptable": 0.4,
    "ridiculous": 0.4,
    "worst": 0.35,
    "disappointed": 0.3,
    "angry": 0.35,
    "furious": 0.45,
    "escalate": 0.2,
    "complaint": 0.3,
    "switch supplier": 0.5,
    "another supplier": 0.45,
    "cancel our account": 0.6,
    "stranded": 0.35,
    "urgent": 0.12,
    "asap": 0.15,
    "waiting": 0.12,
}
CALM = {"thanks": -0.1, "thank you": -0.12, "appreciate": -0.12, "please": -0.03}


class FrustrationResult(BaseModel):
    score: float
    band: str
    signals: list[str]
    calm_reply: str
    priority_bump: bool
    reason: str


def score_frustration(text: str) -> FrustrationResult:
    lower = text.lower()
    signals: list[str] = []
    score = 0.0
    for phrase, w in {**LEXICON, **CALM}.items():
        if phrase in lower:
            score += w
            if w > 0:
                signals.append(phrase)
    caps = re.findall(r"\b[A-Z]{3,}\b", text)
    if len(caps) >= 2:
        score += 0.2
        signals.append("shouting (capitals)")
    if text.count("!") >= 2:
        score += 0.12
        signals.append("multiple exclamation marks")
    compound = _VADER.polarity_scores(text)["compound"] if text.strip() else 0.0
    if compound <= -0.3:
        score += 0.35 * (-compound)
        signals.append(f"negative sentiment (VADER {compound:.2f})")
    score = round(max(0.0, min(1.0, score)), 2)
    band = (
        "boiling"
        if score >= 0.7
        else "heated"
        if score >= 0.4
        else "warm"
        if score >= 0.15
        else "calm"
    )
    calm = (
        "I am sorry you have had to chase this. I own it personally now, here is exactly where it stands "
        "and when you will hear from me next."
        if score >= 0.4
        else "Thanks for flagging this. Here is the current status and the next update time."
    )
    reason = f"Score {score:.2f} ({band})" + (f" from: {', '.join(signals[:4])}" if signals else "")
    return FrustrationResult(
        score=score,
        band=band,
        signals=signals,
        calm_reply=calm,
        priority_bump=score >= 0.6,
        reason=reason,
    )
