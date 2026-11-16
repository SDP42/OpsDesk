# Vectoring: explainable routing

**Module:** `apps/api/app/engines/vectoring.py` · pure (no database, no HTTP) · typed Pydantic in, typed Pydantic out

## What it does

Picks the best controller for a flight and explains the choice, point by point, with the runners-up and why they lost.

## How it works

Each candidate gets a weighted score:

```
score = region match (exact 40, adjacent 15)
      + priority fit (P1 30 · P2 20 · P3 10 · P4 5, senior ranks first)
      + on shift (15)
      + availability (online 10, busy 4, away excluded)
      + skill for the intent (up to 10)
      + load headroom (12 x (1 - open / capacity))
      + agency tier bonus (tier 1: 5, tier 2: 2)
```

Four presets reweight the terms: `balanced` (all 1.0), `urgency_first` (priority and time x2), `regional_affinity` (region x2) and `fairness` (load x2).

## Inputs and outputs

| In | Out |
| --- | --- |
| `RoutingTicket` (region, priority, intent, agency tier) and a list of `Controller` (region, shift, availability, load, skills, rank) | Winner `Candidate` with `parts[]`, runners-up with the gap, the preset used and a plain-English reason |

## Why it matters

The brief asks for routing beyond first-come-first-served *and* for the reason to be visible. Every point in the score is returned as a `ScorePart`, so the UI draws a waterfall and the Why button answers "why Omar and not Layla?".

[← All engines](README.md)
