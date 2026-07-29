# NET2APP Hub

> Enterprise SMS platform — client accounts, supplier gateways, dynamic
> routing, license-tier billing, delivery-receipt tracking. React SPA on
> Vite + Node Express on PostgreSQL.

[![CI](https://github.com/eliasewu/147net2app/actions/workflows/ci.yml/badge.svg)](https://github.com/eliasewu/147net2app/actions/workflows/ci.yml)
[![SMPP Gateway](https://github.com/eliasewu/147net2app/actions/workflows/ci-gateway.yml/badge.svg)](https://github.com/eliasewu/147net2app/actions/workflows/ci-gateway.yml)

---

## 🚀 One-Line Deploy (Fresh Server)

```bash
git clone https://github.com/eliasewu/147net2app.git && cd 147net2app && bash scripts/deploy.sh
```

**This single command** clones the repo, installs Node.js 22 if missing, installs all npm dependencies, creates the PostgreSQL user + database, loads the schema + all 6 migrations, builds the Vite SPA, and starts the server on port 3000.

**Prerequisites:** A Linux server with `sudo` access and `curl` installed. Everything else (Node.js, npm deps, PostgreSQL setup) is handled automatically.

### Deploy via curl (inspect before piping):
```bash
# Download and inspect the script first
curl -sSLO https://raw.githubusercontent.com/eliasewu/147net2app/main/scripts/deploy.sh
less deploy.sh
bash deploy.sh

# Or pipe directly (review the script at the URL above)
curl -sSL https://raw.githubusercontent.com/eliasewu/147net2app/main/scripts/deploy.sh | bash
```

### Manual setup (if you prefer step-by-step):
```bash
# 1. Clone & install
git clone https://github.com/eliasewu/147net2app.git && cd 147net2app && npm install

# 2. Set up PostgreSQL (if not already running)
sudo -u postgres createuser sms_user -P   # set password: sms_user
sudo -u postgres createdb sms_platform -O sms_user

# 3. Run schema migrations
psql -U sms_user -d sms_platform -f src/database/schema.sql
psql -U sms_user -d sms_platform -f src/database/api_connector_migrations.sql
psql -U sms_user -d sms_platform -f src/database/multi_channel_migrations.sql
psql -U sms_user -d sms_platform -f src/database/blocking_migrations.sql
psql -U sms_user -d sms_platform -f src/database/voice_otp_migrations.sql
psql -U sms_user -d sms_platform -f src/database/client_rate_ip_migrations.sql

# 4. Build & start
npm run build && node server.cjs
```

### Docker quick start:
```bash
# DB + SMPP Gateway (run Node.js on host for dev)
docker compose up -d postgres smpp-gw

# DB + SMPP + Asterisk (uncomment asterisk service block first!)
docker compose up -d postgres smpp-gw asterisk

# Then start the app
npm run dev
```

### Components included:
| Component | Description |
| --- | --- |
| **SMPP Gateway** (`smpp-gateway/`) | Java SMPP v3.4/v5.0 client/server for supplier interconnects (ESME ↔ SMSC) |
| **Asterisk Bridge** (`asterisk-bridge.cjs`) | Node.js bridge for Asterisk PBX integration (SIP ↔ SMS gateway) |
| **Asterisk PBX** (Docker) | Asterisk container with AMI on :5038, SIP on :5060/udp |
| **Gateway Bridge** (`gateway-bridge.cjs`) | Multi-protocol gateway bridge for SMS routing |
| **Social Pairing** (`social-pairing.cjs`) | WhatsApp/OTP device pairing via Baileys |
| **Email Service** (`emailService.cjs`) | Nodemailer-based email/SMTP delivery |
| **External API** (`external-api.cjs`) | Bearer-token + API-key + SMPP auth middleware |
| **Number Validation** (`number-validation-providers.cjs`) | Multi-provider number validation & lookup |
| **Users API** (`users-api.cjs`) | User CRUD + JWT auth endpoints |
| **API Extensions** (`apiExtensions.cjs`) | Extended API endpoints for platform operations |

---

## Start here

| If you want to … | Read |
| --- | --- |
| Set the repo up locally (clone → install → dev → test) | **[CONTRIBUTING.md](CONTRIBUTING.md)** |
| Apply the cleanup recipe for the sandbox-only ambient types | **[CONTRIBUTING.md § Ambient Type Workaround](CONTRIBUTING.md#ambient-type-workaround-srctypesreact-dom-clientdts--read-this-first)** |
| See how the SMS pipeline + DB schema work end-to-end | **[SMS_FLOW_AND_DATABASE_SCHEMA.md](SMS_FLOW_AND_DATABASE_SCHEMA.md)** |
| Look up an HTTP endpoint (auth, send, DLR, balance, suppliers) | **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** |
| Deploy to production with HTTPS / Let's Encrypt | **[DEPLOY_HTTPS.md](DEPLOY_HTTPS.md)** |
| Run the end-to-end CRUD smoke test against the live DB | `bash scripts/smoke.sh` (covered in CONTRIBUTING.md § Backend Smoke Test) |

---

## What is this?

NET2APP Hub is an SMS broker/middleware. **Clients** (resellers, integrators)
send SMS through the platform; the platform finds a **supplier** (gateway,
vendor) that can deliver cheaply and successfully for the destination
network, submits the message, and tracks the delivery receipt (DLR) back to
the client in real time.

The platform also bundles **license-tier billing** (Trial / 100K Volume /
500K Volume / 1M Volume / … up to 50M Volume) with monthly SMS quotas,
configurable TPS per client/supplier, multi-tenant operations counters,
email/SMS notifications, and a REST API that mirrors the same operations
the SPA exposes.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend SPA | Vite 8 + React 19 + Tailwind v4 + Recharts |
| State | React Context (DataContext + AuthContext), no Redux |
| Routing | React Router 7 (SPA) |
| Type-checking | TypeScript 5.9, two configs: `tsconfig.json` for `src/`, `tsconfig.node.json` for `vite.config.ts` / `vitest.config.ts` |
| Tests | Vitest 4 (`src/**/*.test.ts`), environment: `node` |
| Backend | Node Express on `:3000` (`server.cjs`) — JWT auth, Bearer tokens, rate-limiting via token-bucket, bcrypt password hashing |
| Database | PostgreSQL on `:5432` (database `sms_platform`, user `sms_user`) |
| External | SMPP `^0.6` for supplier interconnects |

## Repository layout (top level)

```
.
├── README.md                          # this file
├── CONTRIBUTING.md                    # local-dev setup + ambient workaround cleanup
├── package.json / package-lock.json   # deps + npm scripts (dev / build / test / preview)
├── tsconfig.json + tsconfig.node.json # 2-config split (src + vite/vitest)
├── vite.config.ts + vitest.config.ts  # vite + vitest configs (test env: node)
├── index.html                         # Vite entry HTML
├── server.cjs                         # Node Express on :3000
├── external-api.cjs                   # Bearer-token + api-key + SMPP auth middleware
├── users-api.cjs                      # /api/users CRUD endpoints
├── scripts/
│   └── smoke.sh                       # end-to-end CRUD smoke (kills old → boots → CRUD → parity)
├── src/                               # React + TypeScript SPA
│   ├── components/UI/                 # Card / Button / Badge / Modal / Table / Input / StatCard
│   ├── pages/                         # route-driven pages (Dashboard, Clients, Suppliers, etc.)
│   ├── services/                      # api.ts (fetch wrapper), exportService.ts, smppService.ts
│   ├── store/                         # DataContext.tsx, AuthContext.tsx (CRUD through the API)
│   ├── database/                      # schema.sql, postgresql.ts, apiEndpoints.ts
│   ├── types/                         # index.ts (shared types), react-dom-client.d.ts (ambient — see CONTRIBUTING)
│   └── utils/                         # smsHelpers.ts + smsHelpers.test.ts (vitest)
└── *.md                               # project-specific reference docs (see Documentation Index below)
```

## Documentation index

| File | Lines | When you need it |
| --- | --- | --- |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 173 | Setting up a fresh checkout; understanding the `src/types/react-dom-client.d.ts` ambient; running vitest; running the backend CRUD smoke. |
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | 491 | Looking up an `/api/*` endpoint (auth, send SMS, DLR, balance, supplier interconnect signatures, single-row GETs). |
| [SMS_FLOW_AND_DATABASE_SCHEMA.md](SMS_FLOW_AND_DATABASE_SCHEMA.md) | 336 | Tracing an SMS from `POST /api/v1/sms/send` through routing, supplier submission, DLR callback, billing writeback; or checking the 26-table PostgreSQL schema. |
| [DEPLOY_HTTPS.md](DEPLOY_HTTPS.md) | 185 | Production deploy: building the SPA, configuring nginx, requesting a Let's Encrypt cert. |
| [UPDATE_FRONTEND.md](UPDATE_FRONTEND.md) | 23 | Historical migration log: how the frontend was moved off `localStorage` onto the API. Useful as a reference for past-decisions, not as a current guide. |

## Common entry points

```sh
# Frontend dev server (Vite, proxies /api → :3000)
npm run dev

# Backend (Node Express on :3000)
node server.cjs

# Type-check both configs
node_modules/.bin/tsc --noEmit
node_modules/.bin/tsc --noEmit -p tsconfig.node.json

# Run tests (vitest, env: node)
npm test

# End-to-end CRUD smoke
bash scripts/smoke.sh
```

For exit codes, peer-dep flags, port handling, ambient-workaround cleanup,
and gotchas, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

**Need a feature added?** Start in [`src/store/DataContext.tsx`](src/store/DataContext.tsx) for data flow, then [`src/services/api.ts`](src/services/api.ts) for the backend wrapper. For backend changes, start in `server.cjs` (table-driven CRUD) or one of the `*-api.cjs` modules for endpoint-specific logic.
