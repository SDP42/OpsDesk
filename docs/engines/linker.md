# Linker: connecting related flights

**Module:** `apps/api/app/engines/linker.py` · pure (no database, no HTTP) · typed Pydantic in, typed Pydantic out

## What it does

Finds earlier cases that belong with a new ticket and runs the Third-Contact Guardian.

## How it works

| Link type | Rule | Strength |
| --- | --- | --- |
| `tboh` | Same TBOH booking ID | 1.00 |
| `agency_intent` | Same agency and intent within 30 days | 0.80 |
| `semantic` | Same agency and similar text: TF-IDF cosine >= 0.35, or MiniLM cosine >= 0.55 when embeddings are on | 0.50-0.70 |
| `manual` | Added by a controller | 1.00 |

The Guardian fires when this is the agency's third contact about the same booking or problem.

## Inputs and outputs

| In | Out |
| --- | --- |
| `LinkTicket` for the new case, the history pool, `now`, and optional cached vectors | `LinkerResult`: link proposals with type, strength and reason, and a `GuardianResult` |

## Why it matters

The brief's first problem is lost context: the same booking explained three times. Linking happens when the ticket is filed, so the controller opens it with the history already attached.

[← All engines](README.md)
