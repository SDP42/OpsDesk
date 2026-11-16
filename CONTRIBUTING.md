# Contributing to OpsDesk

## Set up

```bash
make setup   # Python and Node dependencies, .env
make seed    # demo data (relative to now)
make dev     # API on :8000, web on :3000
```

## House rules

- **Engines stay pure.** Logic in `apps/api/app/engines` takes typed Pydantic input and returns typed output with a human-readable reason. No database, no HTTP. Add unit tests.
- **RBAC lives only in `app/core/rbac.py`.** Requesters see their own agency; cross-agency reads return 404. Suppliers see only their own channels.
- **Validate everything.** Request models extend `StrictModel` (`extra="forbid"`).
- **Every mutation** writes a `timeline_events` row and an `audit_log` row.
- **No secrets in code.** Configuration comes from `.env` (see `.env.example`).
- **Frontend tokens** live in `globals.css` only. Every screen has empty, loading and error states and respects `prefers-reduced-motion`.
- **New screens** open with a `PageHeader` that explains the feature in plain words, and get a nav item and a ⌘K entry.
- **API types are generated.** Run `make gen-api` after changing schemas.

## Before you open a pull request

```bash
make lint    # ruff, mypy, eslint, tsc
make test    # unit and API tests
make e2e     # Playwright journeys A to J (needs make dev running)
```

## Commits

Small, frequent and conventional: `feat(api): ...`, `fix(web): ...`, `docs(readme): ...`.
