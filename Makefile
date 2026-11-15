# OpsDesk Control Tower: one Makefile for both runtimes.
SHELL := /bin/bash
API := apps/api
WEB := apps/web

.PHONY: help setup dev api web seed seed-big chaos media test test-api test-web e2e lighthouse lint typecheck gen-api clean

help: ## Show targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

setup: ## Install Python and Node dependencies, create .env
	@test -f .env || cp .env.example .env
	cd $(API) && uv sync
	cd $(WEB) && pnpm install
	cd e2e && pnpm install

dev: ## Run API on :8000 and web on :3000 together
	./scripts/dev.sh

api: ## Run only the API
	cd $(API) && uv run uvicorn app.main:app --reload --port 8000

web: ## Run only the web app
	cd $(WEB) && pnpm dev

seed: ## Reset the DB and seed 3,000 tickets plus journey fixtures
	cd $(API) && uv run python -m app.db.seed.seed

seed-big: ## Reset the DB and seed 60,000 tickets (export demo)
	cd $(API) && uv run python -m app.db.seed.seed --big

chaos: ## Inject 40 overbooking tickets into the running API (Chaos Mode)
	cd $(API) && uv run python -m app.db.seed.chaos

media: ## Fetch licensed clips (or use raw/), cut frames, write manifest, palette and credits
	cd $(API) && uv run python ../../scripts/media/build_media.py

test: test-api ## Run all unit and integration tests

test-api:
	cd $(API) && uv run pytest

e2e: ## Run Playwright demo journeys (needs `make seed` and `make dev` running)
	cd e2e && pnpm test

lighthouse: ## Lighthouse on a production build of the landing page (API must be running)
	./scripts/lighthouse.sh

lint: ## Lint and type-check everything
	cd $(API) && uv run ruff check app tests && uv run ruff format --check app tests && uv run mypy app
	cd $(WEB) && pnpm lint && pnpm typecheck

gen-api: ## Regenerate the typed web client from the FastAPI OpenAPI schema
	cd $(API) && uv run python -c "import json; from app.main import app; print(json.dumps(app.openapi()))" > ../web/src/lib/api/openapi.json
	cd $(WEB) && pnpm gen:api

clean: ## Remove local databases and build output
	rm -rf $(API)/data $(WEB)/.next
