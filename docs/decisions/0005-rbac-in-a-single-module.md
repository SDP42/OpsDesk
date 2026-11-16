# 0005. RBAC in a single module

**Status:** accepted

## Context

The brief requires that agencies never see each other's data. Scattered checks are easy to miss.

## Decision

All access rules live in `app/core/rbac.py`. Cross-agency reads return 404, not 403, so IDs do not leak.

## Consequences

One file to audit, with tests for each role. New endpoints must call the helpers.
