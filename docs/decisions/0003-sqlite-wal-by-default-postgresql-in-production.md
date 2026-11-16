# 0003. SQLite WAL by default, PostgreSQL in production

**Status:** accepted

## Context

Judges and new contributors should run the app with no database server, but production needs concurrency and replication.

## Decision

SQLite in WAL mode is the default; `DATABASE_URL` switches to PostgreSQL. Alembic migrations target both.

## Consequences

Zero-setup demos. Some PostgreSQL-only features (CDC) are documented as the scale path rather than used today.
