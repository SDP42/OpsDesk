# 0001. Pure engines with reasons

**Status:** accepted

## Context

Scoring, routing, linking and forecasting logic was at risk of mixing with database code, which makes it hard to test and to explain.

## Decision

All business logic lives in `apps/api/app/engines` as pure functions: typed Pydantic in, typed Pydantic out, no database and no HTTP. Every output includes a human-readable reason.

## Consequences

Engines are unit-tested in isolation and power the Why button. The service layer does slightly more work loading inputs.
