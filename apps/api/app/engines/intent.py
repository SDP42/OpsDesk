"""Intent classifier: TF-IDF + multinomial logistic regression, plus override rules.

Spec section 8.4. Trained at seed time on a generated corpus (>= 1,500 labelled
texts). Returns the top 3 intents with confidence; below 0.55 the UI shows
"needs a human". Strong signals (e.g. a TBOH mention plus "refund" plus a delay
word) are applied as transparent override rules on top of the model.
"""

from __future__ import annotations

import re
from pathlib import Path

import joblib
import numpy as np
from pydantic import BaseModel
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import FeatureUnion, Pipeline

from app.core.config import INTENT_NEEDS_HUMAN_BELOW
from app.engines.intent_taxonomy import generate_corpus, label_of

IntentModel = Pipeline


class IntentCandidate(BaseModel):
    code: str
    label: str
    confidence: float


class IntentSuggestion(BaseModel):
    top: list[IntentCandidate]
    needs_human: bool
    rule: str | None
    reason: str


_DELAY = re.compile(r"\b(still|delay(ed)?|pending|waiting|again|third time|since \d+ days|not (yet )?received)\b")
_REFUND = re.compile(r"\brefund(s|ed)?\b")
_TBOH = re.compile(r"\btboh-?\d+", re.IGNORECASE)
_OVERBOOK = re.compile(r"\boverbook(ed|ing)?\b|\bwalked\b")

RULES: list[tuple[str, str, str]] = [
    # (rule name, target intent, description)
    ("tboh_refund_delay", "refund.delay", "TBOH mention + 'refund' + delay word"),
    ("overbooking", "supplier.overbooking", "'overbooked' or 'walked' mentioned"),
]


def build_model() -> IntentModel:
    features = FeatureUnion([
        ("word", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, min_df=1,
                                 token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z]+\b")),
        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True,
                                 min_df=2, max_features=20000)),
    ])
    return Pipeline([("features", features),
                     ("clf", LogisticRegression(max_iter=2000, C=8.0))])


def train(corpus: list[tuple[str, str]] | None = None) -> IntentModel:
    rows = corpus or generate_corpus()
    model = build_model()
    model.fit([r[0] for r in rows], [r[1] for r in rows])
    return model


def save(model: IntentModel, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, path)


def load_or_train(path: Path) -> IntentModel:
    if path.exists():
        try:
            return joblib.load(path)  # type: ignore[no-any-return]
        except Exception:  # corrupt or version mismatch -> retrain
            pass
    model = train()
    save(model, path)
    return model


def _apply_rules(text: str) -> tuple[str, str] | None:
    lower = text.lower()
    if _TBOH.search(text) and _REFUND.search(lower) and _DELAY.search(lower):
        return RULES[0][0], RULES[0][1]
    if _OVERBOOK.search(lower):
        return RULES[1][0], RULES[1][1]
    return None


def suggest(model: IntentModel, text: str, k: int = 3) -> IntentSuggestion:
    """Top-k intents for ``text`` with confidences, override rule and a reason."""
    text = (text or "").strip()
    if len(text) < 4:
        return IntentSuggestion(top=[], needs_human=True, rule=None,
                                reason="Not enough text yet to suggest an intent")
    probs = model.predict_proba([text])[0]
    classes = list(model.classes_)
    order = np.argsort(probs)[::-1]
    scores = {classes[i]: float(probs[i]) for i in order}

    rule = _apply_rules(text)
    if rule:
        _, target = rule
        # The rule pins the target on top with at least 0.9 confidence.
        boosted = max(scores.get(target, 0.0), 0.9)
        rest = 1.0 - boosted
        others_total = sum(v for c, v in scores.items() if c != target) or 1.0
        scores = {c: (boosted if c == target else v / others_total * rest) for c, v in scores.items()}

    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:k]
    top = [IntentCandidate(code=c, label=label_of(c), confidence=round(v, 3)) for c, v in ranked]
    needs_human = top[0].confidence < INTENT_NEEDS_HUMAN_BELOW
    rule_name = rule[0] if rule else None
    reason = (f"Rule '{rule_name}' matched; " if rule_name else "") + (
        f"model says {top[0].label} at {top[0].confidence:.0%}"
        + (" (below 55%: needs a human)" if needs_human else "")
    )
    return IntentSuggestion(top=top, needs_human=needs_human, rule=rule_name, reason=reason)
