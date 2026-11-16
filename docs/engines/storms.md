# Storm Cells: automatic incidents

**Module:** `apps/api/app/engines/storms.py` · pure (no database, no HTTP) · typed Pydantic in, typed Pydantic out

## What it does

Detects when many tickets share one cause and groups them into a single incident.

## How it works

Each ticket carries keys such as `hotel:Palm Crescent Resort`, `supplier:Atlas Bedbank` or `theme:overbooking`. A sliding 60-minute window per key finds the densest burst; five or more tickets form a cell. Cells that share most of their tickets are merged with a networkx graph, so one storm seen through several keys appears once.

## Inputs and outputs

| In | Out |
| --- | --- |
| `StormTicket`s (ID, time, keys), window minutes, threshold | `StormCell`s: key, label ("Atlas Bedbank outage"), ticket IDs, agencies, reason |

## Why it matters

One approved broadcast answers every affected agency instead of N controllers writing N replies.

[← All engines](README.md)
