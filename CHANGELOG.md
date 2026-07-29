# Changelog

## [July 29, 2026] — Infrastructure & Developer Experience

### Docker Support (7 new files)
- Added `docker-compose.yml` — PostgreSQL 16 + Java 21 SMPP Gateway + Asterisk PBX + optional Node.js app. Health checks, persistent volumes, auto-loaded schema migrations.
- Added `docker-compose.override.yml` — Dev mode with hot-reload (Node `--watch` + Vite HMR on `:5173`), Node.js inspector on `:9229`, JDWP on `:5005`, Adminer DB UI on `:8080`. Auto-merged by Docker Compose.
- Added `Dockerfile` — Multi-stage Node.js production build (Vite SPA → Alpine runtime, non-root user).
- Added `Dockerfile.dev` — Slim Node.js 22 dev image for `docker-compose.override.yml`.
- Added `smpp-gateway/Dockerfile` — Multi-stage Java 21 build (Maven → JRE Alpine, ZGC, virtual threads).
- Added `.dockerignore` — Excludes `node_modules`, `.git`, tests, build artifacts from build context.

### CI/CD (2 new, 1 modified)
- Added `.github/workflows/ci-gateway.yml` — Dedicated Java SMPP Gateway build (Maven package + jar upload). Triggered on PRs, push to main, and manual dispatch.
- Modified `.github/workflows/ci.yml` — Extracted gateway job to its own workflow. Now focuses on Node.js only (vitest + tsc + smoke).
- Added `.github/CODEOWNERS` — Auto-assigns `@eliasewu` as reviewer for frontend (`/src/`), backend (`*.cjs`), Java (`/smpp-gateway/`), infra (`.github/`, Dockerfiles), docs, and config.

### README & Badges
- Added CI status badge for Node.js pipeline (vitest + tsc + smoke).
- Added SMPP Gateway Build badge for Java pipeline (Maven package).
- Added Docker quick-start section with compose commands.
- Added Asterisk PBX row to Components table.
- Added one-line deploy command: `git clone ... && npm install && npm run build && node server.cjs`.

### Configuration
- Added `.env.example` — All 12 environment variables documented with defaults (PORT, JWT_SECRET, DB_*, JAVA_GATEWAY_*, ASTERISK_ENABLED, PROXY_REGISTER_SECRET, INTERNAL_TOKEN). Includes section listing DB-managed settings (SMTP, WhatsApp, etc.).
- Fixed `.gitignore` — Added `!.env.example` exception so the template file is tracked.

### Development Workflow
- Added `Makefile` — 20+ self-documenting commands:
  - Docker: `up`, `up-all`, `up-full`, `down`, `logs`
  - Dev: `dev` (infra + Express + Vite HMR, one command), `install`, `start`
  - Test: `test`, `test-watch`, `typecheck`, `smoke`, `verify`
  - Build: `build`, `build-spa`, `build-gateway`, `build-docker-node`, `build-docker-gateway`
  - DB: `db-init` (loads schema + all 6 migrations)
  - Clean: `clean`, `clean-all`

### Asterisk Integration
- Added `asterisk-config/manager.conf` — AMI config with `admin` user (full read/write, matches `asterisk-bridge.cjs` credentials) and `monitor` user (read-only). Permits Docker bridge network and local LAN.
- Added `asterisk-config/http.conf` — Minimal HTTP server config.
- Added `asterisk-config/README.md` — Quick-start guide with curl registration example and security notes.

### Summary
| Metric | Count |
|---|---|
| New files | 14 |
| Modified files | 3 |
| Total commits | 15 |
| Docker Compose services | PostgreSQL, SMPP Gateway, Asterisk, Node.js, Adminer |
| CI workflows | 2 (Node.js + Java) |
| README badges | 2 (CI + SMPP Gateway) |
| Make targets | 20+ |
| Env vars documented | 12 |
