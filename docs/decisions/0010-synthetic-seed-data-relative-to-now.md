# 0010. Synthetic seed data relative to now

**Status:** accepted

## Context

Real customer data cannot be used, and fixed-date data goes stale.

## Decision

The seed generates agencies, suppliers, controllers and 3,000+ flights relative to the current time (check-in in 9 hours, ghost in 36 hours).

## Consequences

Demos always look live. Run `make seed` shortly before presenting.
