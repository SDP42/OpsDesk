# Frustration Radar: agency mood

**Module:** `apps/api/app/engines/frustration.py` · pure (no database, no HTTP) · typed Pydantic in, typed Pydantic out

## What it does

Scores how frustrated an agency sounds from its message text.

## How it works

A travel-ops lexicon ("third time" +0.35, "no update" +0.30, "switch supplier" +0.50, "cancel our account" +0.60) and calming words ("thank you" -0.12) combine with the pretrained VADER sentiment model (MIT) plus capitals and exclamation rules. Every signal that fired is returned.

## Inputs and outputs

| In | Out |
| --- | --- |
| Message text | Score 0-1, level, and the list of signals that fired |

## Why it matters

An angry tier-1 agency is a churn risk. Frustration lifts priority with a visible reason instead of a gut feeling.

[← All engines](README.md)
