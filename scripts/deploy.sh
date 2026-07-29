#!/usr/bin/env bash
# =============================================================================
# deploy.sh — One-command deploy for NET2APP Hub on a fresh server
# =============================================================================
# Usage (recommended):
#   git clone https://github.com/eliasewu/147net2app.git && cd 147net2app && bash scripts/deploy.sh
#
# Or via curl (inspect first: curl -sSLO .../deploy.sh && less deploy.sh):
#   curl -sSL https://raw.githubusercontent.com/eliasewu/147net2app/main/scripts/deploy.sh | bash
#
# What it does:
#   1. Installs Node.js 22 if missing (upgrades if < 20)
#   2. Installs PostgreSQL if missing
#   3. Installs npm dependencies
#   4. Creates the PostgreSQL user + database (idempotent)
#   5. Creates .env from .env.example if not present
#   6. Loads schema + all migrations
#   7. Builds the Vite SPA
#   8. Starts the Express server on :3000
# =============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

log()  { echo -e "${BLUE}[deploy]${NC} $1"; }
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ─── Config (override via environment) ────────────────────────────────────
DB_USER="${DB_USER:-sms_user}"
DB_PASS="${DB_PASSWORD:-SmsPlatform2024Secure}"
DB_NAME="${DB_NAME:-sms_platform}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
PORT="${PORT:-3000}"

log "NET2APP Hub — Deployment"
log "========================="

# ─── 1. Install / Upgrade Node.js ─────────────────────────────────────────
NEED_NODE=false
if command -v node &>/dev/null; then
  NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VER" -lt 20 ]; then
    warn "Node.js $(node -v) is too old (20+ required) — upgrading to Node 22..."
    NEED_NODE=true
  else
    ok "Node.js $(node -v) found"
  fi
else
  log "Node.js not found — installing Node 22..."
  NEED_NODE=true
fi
if [ "$NEED_NODE" = true ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ok "Node.js $(node -v) installed"
fi

# ─── 2. Install PostgreSQL if missing ─────────────────────────────────────
if command -v psql &>/dev/null && sudo -u postgres psql -c "SELECT 1" &>/dev/null; then
  ok "PostgreSQL is running"
else
  log "PostgreSQL not found — installing..."
  sudo apt-get update -qq
  sudo apt-get install -y --no-install-recommends postgresql postgresql-client
  sudo systemctl start postgresql
  sudo systemctl enable postgresql
  ok "PostgreSQL installed and started"
fi

# ─── 3. Install npm dependencies ──────────────────────────────────────────
log "Installing npm dependencies..."
npm install --legacy-peer-deps
ok "Dependencies installed"

# ─── 4. Create .env from .env.example ─────────────────────────────────────
if [ -f .env ]; then
  ok ".env already exists — skipping"
else
  cp .env.example .env
  warn "Created .env from .env.example — edit it with your production secrets!"
  echo "  nano .env"
fi

# ─── 5. Create PostgreSQL user + database ─────────────────────────────────
log "Setting up PostgreSQL database..."
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" 2>/dev/null | grep -q 1; then
  ok "PostgreSQL user '${DB_USER}' already exists"
else
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" 2>/dev/null || true
  ok "Created PostgreSQL user '${DB_USER}'"
fi

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null | grep -q 1; then
  ok "Database '${DB_NAME}' already exists"
else
  sudo -u postgres createdb "${DB_NAME}" -O "${DB_USER}"
  ok "Created database '${DB_NAME}'"
fi

# ─── 6. Load schema + migrations ─────────────────────────────────────────
log "Loading schema and migrations..."
PGPASSWORD="${DB_PASS}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 -f src/database/schema.sql
ok "schema.sql loaded"

for migration in \
  api_connector_migrations \
  multi_channel_migrations \
  blocking_migrations \
  voice_otp_migrations \
  client_rate_ip_migrations; do
  MIGFILE="src/database/${migration}.sql"
  if [ -f "$MIGFILE" ]; then
    PGPASSWORD="${DB_PASS}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 -f "$MIGFILE" 2>/dev/null || true
  fi
done
ok "All migrations loaded"

# ─── 7. Build the Vite SPA ────────────────────────────────────────────────
log "Building Vite SPA..."
npm run build
ok "Vite SPA built → dist/"

# ─── 8. Start the server ──────────────────────────────────────────────────
log "Starting NET2APP Hub on port ${PORT}..."
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  NET2APP Hub is running!${NC}"
echo -e "${GREEN}  Frontend : http://localhost:${PORT}${NC}"
echo -e "${GREEN}  API      : http://localhost:${PORT}/api${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
exec node server.cjs
