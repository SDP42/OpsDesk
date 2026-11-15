#!/usr/bin/env bash
# Lighthouse on a production build of the landing page (desktop preset). Needs the API running.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=3100
cd "$ROOT/apps/web" && pnpm -s build
pnpm -s next start --port "$PORT" > /dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
sleep 6
CHROME="${CHROME_PATH:-$(ls -d "$HOME"/Library/Caches/ms-playwright/chromium-*/chrome-*/Google\ Chrome\ for\ Testing.app/Contents/MacOS/Google\ Chrome\ for\ Testing 2>/dev/null | head -1)}"
mkdir -p "$ROOT/e2e/reports"
CHROME_PATH="$CHROME" npx -y lighthouse@12 "http://localhost:$PORT/" --quiet --preset=desktop \
  --chrome-flags="--headless=new --no-sandbox" \
  --only-categories=performance,accessibility,best-practices,seo \
  --output=json --output=html --output-path="$ROOT/e2e/reports/lighthouse-landing"
python3 - "$ROOT/e2e/reports/lighthouse-landing.report.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
print({k: round(v["score"] * 100) for k, v in d["categories"].items()})
a = d["audits"]
print({k: a[k]["displayValue"] for k in ["first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift"]})
PY
