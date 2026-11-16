# Intent taxonomy and training corpus

**Module:** `apps/api/app/engines/intent_taxonomy.py` · pure (no database, no HTTP) · typed Pydantic in, typed Pydantic out

## What it does

Defines the 10 parent intents and 25 sub-intents and generates the labelled training corpus.

## How it works

Parents: Refund · Cancellation · Amendment · Voucher and confirmation · Payment and credit · Rates and inventory sync · Supplier confirmation · Special request · Visa and documents · Platform or access issue.

The corpus is built from phrase templates with slot filling (hotels, cities, TBOH IDs, amounts), so training needs no external data and no paid API. `HARD_EVAL` holds 25 hand-written phrasings that do *not* follow the templates, used to measure real-world accuracy.

## Inputs and outputs

| In | Out |
| --- | --- |
| None (deterministic generator) | `(text, intent_code)` pairs and the taxonomy tree |

## Why it matters

A fixed, documented taxonomy keeps intents consistent across the classifier, routing skills and Weather Radar themes.

[← All engines](README.md)
