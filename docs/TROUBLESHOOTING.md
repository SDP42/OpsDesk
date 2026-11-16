# Troubleshooting

Common problems when running OpsDesk locally, and how to fix them.

## `Cannot find module './869.js'` in the web app

A production build was written into `.next` while `next dev` was running. Stop the dev server, delete `apps/web/.next` and start it again. Audit builds use `NEXT_DIST_DIR=.next-prod` (see `make lighthouse`) so this cannot recur.
