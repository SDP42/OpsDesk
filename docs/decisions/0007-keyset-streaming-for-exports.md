# 0007. Keyset streaming for exports

**Status:** accepted

## Context

The incumbent tool caps exports at 3,000 rows; offset pagination slows down on large tables.

## Decision

Exports stream CSV or NDJSON with keyset pagination and a live row counter.

## Consequences

No cap and constant memory. Exports run as a stream, so very large ones should move to signed URLs (documented scale path).
