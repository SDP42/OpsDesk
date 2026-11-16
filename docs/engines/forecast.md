# Breach Forecast: what if I act now?

**Module:** `apps/api/app/engines/forecast.py` · pure (no database, no HTTP) · typed Pydantic in, typed Pydantic out

## What it does

Estimates the chance a flight breaches its SLA under each possible action.

## How it works

Fits a log-normal to historical resolution times for the flight's intent and runs a NumPy Monte Carlo (4,000 samples, fixed seed). Actions apply a speed factor and a handover cost:

| Action | Speed | Handover |
| --- | --- | --- |
| Keep working | 1.0 | 0 min |
| Escalate | 0.6 | 10 min |
| Reassign to specialist | 0.85 | 30 min |
| Call the supplier | 0.7 | 5 min |

## Inputs and outputs

| In | Out |
| --- | --- |
| `ForecastInput`: minutes remaining, historical minutes, elapsed | Breach probability per action, a histogram and a recommendation |

## Why it matters

Gives agents evidence before they act, not after the breach.

[← All engines](README.md)
