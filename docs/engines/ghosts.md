# Ghost Flights: predicting tickets before they exist

**Module:** `apps/api/app/engines/ghosts.py` · pure (no database, no HTTP) · typed Pydantic in, typed Pydantic out

## What it does

Scores open bookings for the risk that they turn into a ticket, so the team can fix them before the agency writes in.

## How it works

A scikit-learn GradientBoostingClassifier (120 trees, depth 3) trained on 4,000 synthetic labelled bookings. Features: supplier unconfirmed, hours to check-in, rate changed, agency repeat contacts, slow supplier, earlier cases on the booking. Top drivers come from feature ablation, for example "supplier has not confirmed (+38%)", and each prediction carries a suggested pre-emptive message.

## Inputs and outputs

| In | Out |
| --- | --- |
| `GhostInput`: TBOH, supplier status, check-in, rate change, contacts, supplier speed, earlier cases | `GhostPrediction`: probability, top drivers, recommended message |

## Why it matters

Every ticket prevented is one fewer agency call. Prediction turns ops from reactive to proactive.

[← All engines](README.md)
