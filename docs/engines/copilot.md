# Co-pilot Brief: one-click case summary

**Module:** `apps/api/app/engines/copilot.py` · pure (no database, no HTTP) · typed Pydantic in, typed Pydantic out

## What it does

Summarises a case from its linked history: what happened, what was promised, how the agency feels and the next best action.

## How it works

Rule-based composition over linked tickets, promises and frustration signals. Every line is traceable to an input, so the Why button can show its source.

## Inputs and outputs

| In | Out |
| --- | --- |
| `BriefInput`: ticket, linked history, promises, signals | `Brief`: sections with source references |

## Why it matters

Replaces a paid AI-copilot add-on with a transparent, free summary that never invents facts.

[← All engines](README.md)
