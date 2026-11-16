# Lifecycle: the ticket state machine

**Module:** `apps/api/app/engines/lifecycle.py` · pure (no database, no HTTP) · typed Pydantic in, typed Pydantic out

## What it does

Enforces the status flow New → Open → Pending → Escalated → Resolved → Closed.

## How it works

A transition table lists the allowed next states for each status, for example `new` can move to open, pending, escalated or resolved, and `resolved` can reopen to open or close. Any other move is rejected with a clear message.

## Inputs and outputs

| In | Out |
| --- | --- |
| Current status and requested status | Allowed or a validation error |

## Why it matters

The brief asks for a sensible status flow. A single table makes illegal jumps (Closed straight back to Pending) impossible from any screen or API call.

[← All engines](README.md)
