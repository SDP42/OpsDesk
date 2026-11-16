# Routing simulator: replay the day

**Module:** `apps/api/app/engines/simulator.py` · pure (no database, no HTTP) · typed Pydantic in, typed Pydantic out

## What it does

Replays a real day of flights under each routing preset to compare breaches, speed and fairness.

## How it works

A discrete-event replay: flights arrive in order, each controller has four parallel lanes, Vectoring picks with the preset's weights while load updates, and each controller works first-in-first-out. Base handle times are P1 18 · P2 24 · P3 30 · P4 35 minutes, longer when the controller lacks the intent skill or works out of region. A flight breaches if it finishes after its Wheels-Up deadline.

## Inputs and outputs

| In | Out |
| --- | --- |
| Flights, controllers and preset names | Per preset: breaches, median and p90 time, load spread, and a recommendation |

## Why it matters

Leads choose a routing policy with evidence instead of guesswork.

[← All engines](README.md)
