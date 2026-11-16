# Weather Radar: themes and emerging spikes

**Module:** `apps/api/app/engines/weather.py` · pure (no database, no HTTP) · typed Pydantic in, typed Pydantic out

## What it does

Tags tickets with themes and aggregates them by week, flagging *emerging* themes for the product team.

## How it works

Themes come from a travel-ops keyword lexicon (up to two per ticket). Weekly counts are compared with the previous six weeks. A theme is **emerging** only when both hold:

- z-score >= 2.5 against the history, and
- this week >= 2.5x the average of the last four weeks.

Each theme keeps sample ticket IDs and the number of agencies affected.

## Inputs and outputs

| In | Out |
| --- | --- |
| `ThemeObservation`s (theme, ticket, agency, time) and a target ISO week | `ThemeWeek` per theme: count, previous, week-over-week %, agencies, z-score, emerging flag, samples, reason |

## Why it matters

The brief asks for top themes with samples and a link to the product backlog. The double rule flags real spikes, not slow trends.

[← All engines](README.md)
