# Intent: auto-classifying the problem

**Module:** `apps/api/app/engines/intent.py` · pure (no database, no HTTP) · typed Pydantic in, typed Pydantic out

## What it does

Suggests the top three intents for a ticket with confidence, and says *needs a human* below 0.55.

## How it works

An ensemble of two models trained at seed time on a generated corpus (1,600 labelled texts from `intent_taxonomy.py`):

1. TF-IDF (word 1-2-grams + char 3-5-grams) into multinomial logistic regression.
2. Logistic regression (C=2000) on pretrained all-MiniLM-L6-v2 embeddings, weighted 0.7 in the blend.

Transparent override rules (for example a TBOH mention plus "refund" plus a delay word) sit on top. With `EMBEDDINGS_ENABLED=false` only the TF-IDF model runs.

## Inputs and outputs

| In | Out |
| --- | --- |
| Free text (title and description) | Top-3 intents with confidence, the source (model or rule) and a reason |

## Why it matters

Correct intent drives linking (agency + intent), routing (skills) and insights (themes). On hand-written phrasings the ensemble scores 88% against 76% for TF-IDF alone (see `docs/MODELS.md`).

[← All engines](README.md)
