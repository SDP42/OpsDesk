# Troubleshooting

Common problems when running OpsDesk locally, and how to fix them.

## `Cannot find module './869.js'` in the web app

A production build was written into `.next` while `next dev` was running. Stop the dev server, delete `apps/web/.next` and start it again. Audit builds use `NEXT_DIST_DIR=.next-prod` (see `make lighthouse`) so this cannot recur.

## Login fails with HTTP 429

Login is rate-limited per IP and email (10 attempts a minute). Wait a minute, or restart the API in development.

## The first `make seed` is slow

It downloads the MiniLM model once into `apps/api/data/models/`. Later seeds reuse the cached file.

## Seeded flights look already breached

Seed data is relative to the time it was generated. Run `make seed` again shortly before a demo.

## The Constellation is blank

Search a TBOH that has linked flights, such as `TBOH-88213`, or switch to List mode. WebGL must be enabled in the browser.

## Tower Radio does not hear me

Voice uses the browser's Web Speech API. Allow microphone access, or type the question instead.

## Playwright journeys fail on a fresh machine

Run `make seed` and `make dev` first, then `make e2e`. The global setup reseeds before the tests.

## `make seed` while the API is running

Supported: the seed empties tables in place instead of deleting the database file, so the running API keeps working.
