# Follow-the-Sun: regional handoffs

**Module:** `apps/api/app/engines/follow_the_sun.py` · pure (no database, no HTTP) · typed Pydantic in, typed Pydantic out

## What it does

At shift change, hands urgent flights to the region whose working day is starting.

## How it works

Open flights near check-in or LCD, owned by controllers going off shift, move to controllers on shift now. Public holidays come from the open-source `holidays` calendars (India, UAE, UK, Singapore) and weekends are regional (Friday-Saturday in the UAE). Each move gets an auto-written Handoff Brief.

## Inputs and outputs

| In | Out |
| --- | --- |
| Open flights, controllers, the current time | Planned handoffs with receiving controller, reason and brief |

## Why it matters

Travel never sleeps. Urgent cases keep moving overnight instead of waiting for the morning shift.

[← All engines](README.md)
