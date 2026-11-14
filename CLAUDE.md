# OpsDesk Control Tower

Spec: `docs/OpsDesk_Build_Spec.pdf` is the source of truth (the design moved from dark "Night Ops" to the light
"Daylight Tower" system at the product owner's request).

## Rules
- Backend: Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2 async. Engines in `apps/api/app/engines` stay **pure**
  (no DB, no HTTP): typed Pydantic inputs and outputs, covered by unit tests.
- Every score, route, link, forecast, brief and prediction returns a **human-readable reason** (the Why button).
- RBAC lives only in `app/core/rbac.py`. Requesters see their own agency only; cross-agency reads return 404.
  Supplier partners see only their own channels.
- No secrets in code. Validate all input (`StrictModel`, `extra="forbid"`). Every mutation writes a
  `timeline_events` row and an `audit_log` row.
- Frontend: design tokens in `globals.css` only; no purple gradients; every screen has empty, loading and error
  states; respect `prefers-reduced-motion`; technical terms get a plain-language `<Term>` hint.
- API types are generated: run `make gen-api` after changing schemas.
- Commits: small, frequent, conventional (`feat(api): …`), no co-author trailers.

## Commands
make setup | make dev | make seed | make seed-big | make chaos | make media | make test | make e2e | make lint | make gen-api

## Definition of done
Tests pass, journeys A to G pass, screenshots reviewed, README updated.
