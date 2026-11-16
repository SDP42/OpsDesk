# Wheels-Up SLA: travel-aware deadlines

**Module:** `apps/api/app/engines/wheels_up.py` · pure (no database, no HTTP) · typed Pydantic in, typed Pydantic out

## What it does

Turns a ticket's priority and the guest's check-in or last cancellation date (LCD) into a deadline, a fuel gauge and a state.

## How it works

```
base target   = P1 60 min · P2 4 h · P3 8 h · P4 24 h
urgency       = nearest of check-in / LCD: <=12 h 0.25 · <=24 h 0.40 · <=72 h 0.60 · <=7 d 0.80 · else 1.00
due at        = created at + base x urgency (+ paused holiday hours)
state         = ok < 60% · at risk 60-85% · critical >= 85% · breached > 100%
```

Hours to check-in are measured from *now*, so the deadline tightens as the stay approaches. Critical flights propose an escalation.

## Inputs and outputs

| In | Out |
| --- | --- |
| `SlaInput`: created at, now, priority, check-in, LCD, holiday hours, resolved at | `SlaResult`: due at, state, elapsed %, fuel (1.0 to 0.0), remaining seconds, urgency driver, escalation flag, reason |

## Why it matters

Generic SLAs count office hours. Travel problems have a hard wall: the guest arriving at the hotel. Wheels-Up makes that wall the clock.

[← All engines](README.md)
