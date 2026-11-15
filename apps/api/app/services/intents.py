"""Holds the trained intent models for the process lifetime.

TF-IDF + logistic regression always; plus a logistic-regression head on pretrained
MiniLM embeddings when the embedding model is available (ensemble at suggest time).
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import joblib

from app.core.config import get_settings
from app.engines import intent as intent_engine
from app.engines.intent import IntentModel, IntentSuggestion
from app.services import embeddings

_model: IntentModel | None = None
_head: Any = None
_head_loaded = False


def head_path() -> Path:
    return get_settings().intent_model_path.with_name("intent_head.joblib")


def get_model() -> IntentModel:
    global _model
    if _model is None:
        _model = intent_engine.load_or_train(get_settings().intent_model_path)
    return _model


def get_head() -> Any:
    global _head, _head_loaded
    if not _head_loaded:
        _head_loaded = True
        if head_path().exists() and embeddings.available():
            try:
                _head = joblib.load(head_path())
            except Exception:
                _head = None
    return _head


async def warm_up() -> None:
    await asyncio.to_thread(get_model)
    await asyncio.to_thread(get_head)


def suggest(text: str) -> IntentSuggestion:
    head = get_head()
    vector = None
    if head is not None:
        mat = embeddings.embed([text])
        vector = mat[0] if mat is not None else None
    return intent_engine.suggest(get_model(), text, head=head, vector=vector)
