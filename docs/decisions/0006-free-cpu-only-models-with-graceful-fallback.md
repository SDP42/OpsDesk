# 0006. Free, CPU-only models with graceful fallback

**Status:** accepted

## Context

Paid AI APIs add cost, latency and data-sharing concerns, and judges may run offline.

## Decision

Pretrained all-MiniLM-L6-v2 (Apache-2.0) via fastembed, VADER (MIT) and scikit-learn models trained at seed time. `EMBEDDINGS_ENABLED=false` falls back to TF-IDF.

## Consequences

No API keys or GPUs. Accuracy is measured and published in `docs/MODELS.md`.
