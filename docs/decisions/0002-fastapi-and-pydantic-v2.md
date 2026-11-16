# 0002. FastAPI and Pydantic v2

**Status:** accepted

## Context

We needed typed request validation, OpenAPI generation for the frontend client, and async database access.

## Decision

FastAPI with Pydantic v2 `StrictModel` (`extra="forbid"`) and SQLAlchemy 2 async.

## Consequences

The OpenAPI schema generates the TypeScript client (`make gen-api`). Unknown fields are rejected, which catches client mistakes early.
