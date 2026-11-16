# Crew Roster: HR-aware availability

**Module:** `apps/api/app/engines/roster.py` · pure (no database, no HTTP) · typed Pydantic in, typed Pydantic out

## What it does

Merges HRMS leave, weekly-off and shift data (Darwinbox-style) with live presence to decide who can take work.

## How it works

For each controller it computes the effective status for today (on leave, weekly off, on shift, off shift) with a reason, and flags *orphan risk*: open flights whose owner will be away before the flight's deadline. The Darwinbox adapter runs live with credentials or on simulated data.

## Inputs and outputs

| In | Out |
| --- | --- |
| `CrewMember`s, `HrRecord`s and today's date | `CrewStatus` per controller and `OrphanRisk`s |

## Why it matters

Helpdesks and HR systems usually never talk, so tickets land with people on leave. This closes that gap.

[← All engines](README.md)
