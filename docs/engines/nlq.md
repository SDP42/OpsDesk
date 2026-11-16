# Ask the Tower: plain-English filters

**Module:** `apps/api/app/engines/nlq.py` · pure (no database, no HTTP) · typed Pydantic in, typed Pydantic out

## What it does

Turns a question like "critical refunds in UAE" into filter chips.

## How it works

A deterministic parser with small lexicons for region, SLA state, status, priority, intent family, TBOH, agency and check-in windows ("next 24 hours"). Every chip records the words that produced it.

## Inputs and outputs

| In | Out |
| --- | --- |
| Query text | `ParsedQuery`: filters, chips with source words, unparsed remainder |

## Why it matters

Non-technical users search without learning filter syntax, and the chips show exactly how the question was read.

[← All engines](README.md)
