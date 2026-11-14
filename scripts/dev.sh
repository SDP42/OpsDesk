#!/usr/bin/env bash
# Run the API (:8000) and the web app (:3000) together; Ctrl-C stops both.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
pids=()
cleanup() { for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT INT TERM

(cd "$ROOT/apps/api" && uv run uvicorn app.main:app --reload --port 8000 2>&1 | sed -e 's/^/[api] /') &
pids+=($!)
(cd "$ROOT/apps/web" && pnpm dev 2>&1 | sed -e 's/^/[web] /') &
pids+=($!)

echo "OpsDesk Control Tower: API http://localhost:8000/docs  |  Web http://localhost:3000"
wait
