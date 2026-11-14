"""Holds the trained intent model for the process lifetime."""

from __future__ import annotations

import asyncio

from app.core.config import get_settings
from app.engines import intent as intent_engine
from app.engines.intent import IntentModel, IntentSuggestion

_model: IntentModel | None = None


def get_model() -> IntentModel:
    global _model
    if _model is None:
        _model = intent_engine.load_or_train(get_settings().intent_model_path)
    return _model


async def warm_up() -> None:
    await asyncio.to_thread(get_model)


def suggest(text: str) -> IntentSuggestion:
    return intent_engine.suggest(get_model(), text)
