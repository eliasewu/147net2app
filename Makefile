# =============================================================================
# NET2APP Hub — Makefile
# =============================================================================
# Quick reference:
#   make          Show this help
#   make up       Start Docker services (postgres + SMPP gateway)
#   make dev      Start infra + run Vite dev server with hot-reload
#   make test     Run vitest unit tests
#   make verify   Full CI: vitest + tsc + smoke
#   make build    Build Vite SPA + Java SMPP Gateway
#   make clean    Tear down everything (containers, volumes, build output)
# =============================================================================

.DEFAULT_GOAL := help
.PHONY: help up up-all up-full down dev test test-watch typecheck smoke verify \
        build build-spa build-gateway build-docker-node build-docker-gateway \
        clean clean-all logs install start db-init

# ─── Docker Compose ───────────────────────────────────────────────────────

up: ## Start PostgreSQL + SMPP Gateway (Docker)
	docker compose up -d postgres smpp-gw

up-all: ## Start all services (postgres + SMPP + Asterisk — uncomment asterisk first!)
	@echo "==> Uncomment the asterisk service block in docker-compose.yml first!"
	docker compose up -d postgres smpp-gw asterisk

up-full: ## Start all services including node-app (full Docker stack)
	@echo "==> Uncomment node-app and asterisk service blocks in docker-compose.yml first!"
	docker compose up -d

down: ## Stop all Docker services
	docker compose down

logs: ## Tail Docker logs
	docker compose logs -f

# ─── Development ──────────────────────────────────────────────────────────

dev: up ## Start Docker infra + Express backend + Vite HMR (one command)
	@echo "==> Docker services running. Starting Express + Vite..."
	@echo "    Frontend  : http://localhost:5173"
	@echo "    API       : http://localhost:3000"
	@echo "    Debugger  : chrome://inspect (attach to :9229)"
	node --watch server.cjs & npx vite --host 0.0.0.0

install: ## Install Node.js dependencies
	npm install --legacy-peer-deps

start: ## Start Node.js Express server (non-Docker, needs postgres running)
	node server.cjs

# ─── Testing & Quality ────────────────────────────────────────────────────

test: ## Run vitest unit tests
	npm test

test-watch: ## Run vitest in watch mode
	npm run test:watch

typecheck: ## TypeScript type-check (no emit)
	npx tsc --noEmit

smoke: ## Backend end-to-end smoke test (needs postgres + schema loaded)
	bash scripts/smoke.sh

verify: ## Full CI pipeline: vitest + typecheck + smoke
	npm run verify

# ─── Build ────────────────────────────────────────────────────────────────

build: build-spa build-gateway ## Build Vite SPA + Java SMPP Gateway

build-spa: ## Build the Vite React SPA (output → dist/)
	npm run build

build-gateway: ## Build the Java SMPP Gateway (output → smpp-gateway/target/)
	cd smpp-gateway && mvn package --batch-mode -DskipTests -q

build-docker-node: ## Build the Node.js production Docker image
	docker compose build node-app

build-docker-gateway: ## Build the Java SMPP Gateway Docker image
	docker compose build smpp-gw

# ─── Database ─────────────────────────────────────────────────────────────

db-init: ## Load schema + migrations into PostgreSQL
	@echo "==> Loading schema.sql..."
	psql -h localhost -U sms_user -d sms_platform -v ON_ERROR_STOP=1 -f src/database/schema.sql
	@echo "==> Loading api_connector_migrations..."
	psql -h localhost -U sms_user -d sms_platform -v ON_ERROR_STOP=1 -f src/database/api_connector_migrations.sql
	@echo "==> Loading multi_channel_migrations..."
	psql -h localhost -U sms_user -d sms_platform -v ON_ERROR_STOP=1 -f src/database/multi_channel_migrations.sql
	@echo "==> Loading blocking_migrations..."
	psql -h localhost -U sms_user -d sms_platform -v ON_ERROR_STOP=1 -f src/database/blocking_migrations.sql
	@echo "==> Loading voice_otp_migrations..."
	psql -h localhost -U sms_user -d sms_platform -v ON_ERROR_STOP=1 -f src/database/voice_otp_migrations.sql
	@echo "==> Loading client_rate_ip_migrations..."
	psql -h localhost -U sms_user -d sms_platform -v ON_ERROR_STOP=1 -f src/database/client_rate_ip_migrations.sql
	@echo "==> Schema loaded successfully."

# ─── Cleanup ──────────────────────────────────────────────────────────────

clean: ## Tear down Docker services + volumes + build output
	docker compose down -v
	rm -rf dist/ node_modules/.vite
	cd smpp-gateway && mvn clean -q 2>/dev/null || true

clean-all: clean ## Also remove node_modules
	rm -rf node_modules/

# ─── Help ─────────────────────────────────────────────────────────────────

help: ## Show this help message
	@echo "NET2APP Hub — Development Commands"
	@echo "==================================="
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Quick start:"
	@echo "  1. cp .env.example .env"
	@echo "  2. make up          # Start PostgreSQL + SMPP Gateway"
	@echo "  3. make install     # Install Node.js deps"
	@echo "  4. make dev         # Start Vite dev server"
	@echo ""
	@echo "First time Docker setup:"
	@echo "  docker compose up -d       # Creates & initializes DB"
	@echo "  make test                  # Verify everything works"
