# Promise Tracker: commitments in replies

**Module:** `apps/api/app/engines/promises.py` · pure (no database, no HTTP) · typed Pydantic in, typed Pydantic out

## What it does

Extracts promises made in replies, such as "will confirm by 5 pm IST" or "refund in 3 working days".

## How it works

Regex patterns plus date parsing turn each commitment into a due time relative to the message, so the timeline can show promises kept or overdue.

## Inputs and outputs

| In | Out |
| --- | --- |
| Message text and the time it was sent | `Promise`s: phrase, due time, kind |

## Why it matters

Broken promises are the fastest way to lose an agency's trust. Tracking them keeps the team honest.

[← All engines](README.md)
