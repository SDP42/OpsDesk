"""Pretrained sentence embeddings (all-MiniLM-L6-v2, Apache-2.0) via fastembed (ONNX, CPU).

Loaded lazily and cached in apps/api/data/models. If the model cannot be loaded
(offline, disabled, or EMBEDDINGS_ENABLED=false) every caller falls back to the
TF-IDF path, so the product never depends on the download.
"""

from __future__ import annotations

import threading
from typing import Any

import numpy as np

from app.core.config import DATA_DIR, get_settings
from app.core.logging import get_logger

log = get_logger("opsdesk.embeddings")
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
_model: Any = None
_failed = False
_lock = threading.Lock()


def available() -> bool:
    return _load() is not None


def _load() -> Any:
    global _model, _failed
    if _model is not None or _failed or not get_settings().embeddings_enabled:
        return _model
    with _lock:
        if _model is None and not _failed:
            try:
                from fastembed import TextEmbedding

                _model = TextEmbedding(MODEL_NAME, cache_dir=str(DATA_DIR / "models"))
                log.info("embeddings_ready", model=MODEL_NAME)
            except Exception as exc:
                _failed = True
                log.warning("embeddings_unavailable", error=str(exc))
    return _model


def embed(texts: list[str]) -> np.ndarray | None:
    """L2-normalised (n, 384) matrix, or None when the model is unavailable."""
    model = _load()
    if model is None or not texts:
        return None
    vecs = np.array(list(model.embed(texts)), dtype=np.float32)
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    return vecs / np.maximum(norms, 1e-9)
