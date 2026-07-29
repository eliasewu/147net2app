#!/usr/bin/env node
// NET2APP Hub - Production Server (Express + PostgreSQL)
// All data saved to PostgreSQL and loaded from PostgreSQL

const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'net2app-hub-' + Date.now();

const bridge = require('./gateway-bridge.cjs');
const astBridge = require('./asterisk-bridge.cjs');
const numValid = require('./number-validation-providers.cjs');
const emailService = require('./emailService.cjs');
const { createPerformSupplierBind, createPerformSupplierUnbind, smppByteToVersion } = require('./src/services/supplierBindHelper.cjs');
const { attachBlockingHelpers } = require('./src/services/blockingHelpers.cjs');
const { attachSecurityMiddleware } = require('./src/services/securityMiddleware.cjs');
const { exec } = require("child_process");
const util = require("util");
const execAsync = util.promisify(exec);
const fs = require("fs");

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  // Defaults point at the actual provisioned Postgres so server.cjs starts
  // against the right DB out of the box (schema.sql loaded into sms_platform).
  database: process.env.DB_NAME || 'sms_platform',
  user: process.env.DB_USER || 'sms_user',
  password: process.env.DB_PASSWORD || 'SmsPlatform2024Secure',
});
// Wire bridges to the pool now that it's initialized. These cannot run
// above the `const pool = …` declaration or we hit a TDZ error.
astBridge.setPool(pool);
numValid.setPool(pool);
emailService.setPool(pool);
const performSupplierBind = createPerformSupplierBind(pool, bridge);
const performSupplierUnbind = createPerformSupplierUnbind(pool, bridge);

// ===================== IP ENFORCEMENT HELPER =====================
// Shared between server.cjs and external-api.cjs via pool object.
// Checks IP blacklists (blacklist + web_login_blacklist) and
// enforces client-specific smpp_ip whitelist for SMPP bind auth.
// Returns { blocked: boolean, reason?: string }
pool.checkIpEnforcement = async function(ipAddress, clientId = null, supplierId = null) {
  try {
    // 1) Check global blacklists — any IP in blacklist or web_login_blacklist is blocked everywhere
    const blacklisted = await pool.query(
      "SELECT list_type, notes FROM ip_lists WHERE ip_address = $1 AND list_type IN ('blacklist','web_login_blacklist') LIMIT 1",
      [ipAddress]
    );
    if (blacklisted.rows.length) {
      const entry = blacklisted.rows[0];
      return { blocked: true, reason: `IP ${ipAddress} is ${entry.list_type.replace(/_/g, ' ')}: ${entry.notes || 'No reason provided'}` };
    }
    // 2) Whitelist enforcement: if ANY whitelist entries exist, ONLY whitelisted IPs pass.
    //    This creates an "allowlist-only" mode once the first whitelist entry is added.
    const whitelistCount = await pool.query(
      "SELECT COUNT(*)::int AS cnt FROM ip_lists WHERE list_type = 'whitelist'"
    );
    if (whitelistCount.rows[0].cnt > 0) {
      const inWhitelist = await pool.query(
        "SELECT id FROM ip_lists WHERE ip_address = $1 AND list_type = 'whitelist' LIMIT 1",
        [ipAddress]
      );
      if (!inWhitelist.rows.length) {
        return { blocked: true, reason: `IP ${ipAddress} is not in the whitelist — access denied` };
      }
    }
    // 3) If clientId given, enforce per-client IP whitelist from client_ips table.
    //    If no IPs are configured for this client, allow all.
    if (clientId) {
      const ips = await pool.query('SELECT ip_address FROM client_ips WHERE client_id = $1', [clientId]);
      if (ips.rows.length > 0) {
        const allowed = ips.rows.some((row) => row.ip_address === ipAddress);
        if (!allowed) {
          const client = await pool.query('SELECT client_code FROM clients WHERE id = $1', [clientId]);
          const code = client.rows[0]?.client_code || clientId;
          return { blocked: true, reason: `Client ${code} IP not whitelisted (yours: ${ipAddress}). Add ${ipAddress} to the IP whitelist.` };
        }
      }
    }
    // 4) If supplierId given, enforce per-supplier IP whitelist from supplier_ips table.
    //    Only applies to inbound SMPP suppliers (those connecting TO us).
    if (supplierId) {
      const ips = await pool.query('SELECT ip_address FROM supplier_ips WHERE supplier_id = $1', [supplierId]);
      if (ips.rows.length > 0) {
        const allowed = ips.rows.some((row) => row.ip_address === ipAddress);
        if (!allowed) {
          const supplier = await pool.query('SELECT supplier_code FROM suppliers WHERE id = $1', [supplierId]);
          const code = supplier.rows[0]?.supplier_code || supplierId;
          return { blocked: true, reason: `Supplier ${code} IP not whitelisted (yours: ${ipAddress}). Add ${ipAddress} to the IP whitelist.` };
        }
      }
    }
    return { blocked: false };
  } catch (e) {
    // Soft-fail: never block legitimate traffic because the ip_lists
    // table is missing or a query hiccups. Log and allow.
    console.warn('[ip-enforcement] check failed (allowing by default):', e.message);
    return { blocked: false };
  }
};

// ===================== BLOCKING HELPERS (shared with external-api.cjs) =====================
// Extracted to src/services/blockingHelpers.cjs so both server.cjs and unit tests can import.
attachBlockingHelpers(pool);

// ===================== SHARED ROUTE RESOLVER (trunks-wired) =====================
// Resolves a client+destination through the chain:
//   routing_plan → routes → trunks → supplier → mobile/GSM device
// Route_maps are REMOVED — routing is now exclusively plan-driven.
// The route's trunk_ids[] are resolved through the trunks table to
// pick the best trunk (by route_method: priority/percentage/lcr).
// The trunk's supplier_id yields the final supplier.
// Returns null when no route is found.
pool.resolveRouteForClient = async function(clientId, destination) {
  const digitsOnly = String(destination || '').replace(/[^0-9]/g, '');
  let mccGuess = digitsOnly.length >= 3 ? digitsOnly.substring(0, 3) : null;

  // Resolve MCC for pattern matching (used by route_maps and trunk filters)
  let resolvedMcc = null, matchedMnc = null, matchedOperator = null;
  let allMncsForMcc = []; // All MNC entries for the resolved MCC (for route_map iteration)
  if (mccGuess) {
    let mccMatch = await pool.query(
      "SELECT mcc, mnc, operator FROM mccmnc WHERE mcc = $1 ORDER BY mnc",
      [mccGuess]
    );
    if (!mccMatch.rows.length) {
      for (let codeLen = 3; codeLen >= 1; codeLen--) {
        const cc = mccGuess.substring(0, codeLen);
        mccMatch = await pool.query(
          `SELECT mcc, mnc, operator FROM mccmnc m1 WHERE calling_code = $1
           ORDER BY (SELECT COUNT(*) FROM mccmnc m2 WHERE m2.mcc = m1.mcc) DESC, mcc, mnc`,
          [cc]
        );
        if (mccMatch.rows.length) break;
      }
    }
    if (mccMatch.rows.length) {
      resolvedMcc = mccMatch.rows[0].mcc;
      allMncsForMcc = mccMatch.rows; // Store all MNC entries for iteration
      if (resolvedMcc) mccGuess = resolvedMcc;
      // Default to first MNC as best-guess for CDR display.
      // When STEP 0 (routing plan) resolves, this gives country+MNC context.
      // STEP 1 (route_maps) may override with a more specific match or clear for bare '*'.
      if (allMncsForMcc.length > 0) {
        matchedMnc = allMncsForMcc[0].mnc;
        matchedOperator = allMncsForMcc[0].operator;
      }
    }
  }

  let routeId = null, routeName = null, routeMethod = 'priority';

  // ═══ STEP 0: Client's routing plan (primary) ═══
  // When the client has a routing_plan_id, that plan's routes take priority
  // over route_maps. Route_maps are checked AFTER as MCC-based overrides.
  const client = await pool.query(
    'SELECT routing_plan_id FROM clients WHERE id = $1', [clientId]
  );
  const planId = client.rows[0]?.routing_plan_id || null;
  if (planId) {
    const plan = await pool.query(
      'SELECT route_ids FROM route_plans WHERE id = $1', [planId]
    );
    if (plan.rows.length && plan.rows[0].route_ids?.length) {
      const planRouteIds = plan.rows[0].route_ids;
      // Find the first active route in the plan that has working trunks/suppliers
      const planRoutes = await pool.query(
        `SELECT r.id, r.route_name, r.route_method, r.trunk_ids
           FROM routes r
          WHERE r.id = ANY($1::int[]) AND r.is_active = true
          ORDER BY array_position($1::int[], r.id)`,
        [planRouteIds]
      );
      for (const r of planRoutes.rows) {
        // Quick check: does this route have at least one active trunk→supplier?
        if (r.trunk_ids?.length) {
          const trunkCheck = await pool.query(
            `SELECT 1 FROM trunks t
              JOIN suppliers s ON s.id = t.supplier_id AND s.status = 'active'
             WHERE t.id = ANY($1::int[]) AND t.is_active = true
             LIMIT 1`,
            [r.trunk_ids]
          );
          if (trunkCheck.rows.length) {
            routeId = r.id;
            routeName = r.route_name;
            routeMethod = r.route_method || 'priority';
            break;
          }
        }
      }
    }
  }

  // ═══ STEP 1: Route maps REMOVED — routing is now plan-driven only ═══
  // Route maps were previously used for MCC-based override. They are now
  // obsolete. The routing plan (STEP 0) is the sole source of routing
  // decisions. If the plan didn't resolve, the SMS is unroutable.

  // ═══ STEP 2: Fallback REMOVED — no route_maps fallback ═══
  // Previously fell back to route_maps when the plan didn't resolve.
  // Now: if no plan/route resolves, return null (unroutable).
  if (!routeId) return null;

  // Step 2 — resolve trunks for this route, filtered by mccmnc_allowed
  let bestTrunkId = null, bestTrunkName = null, bestTrunkType = null;
  let bestSupplierId = null, bestSupplierCode = null, bestSupplierConnType = null;

  const routeRow = await pool.query(
    'SELECT trunk_ids, route_method FROM routes WHERE id = $1', [routeId]
  );
  if (!routeRow.rows.length) return null;

  const trunkIds = routeRow.rows[0].trunk_ids || [];
  const method = routeRow.rows[0].route_method || 'priority';

  if (trunkIds.length > 0) {
    const trunkRows = await pool.query(
      `SELECT t.id, t.trunk_name, t.trunk_type, t.supplier_id, t.priority,
              t.percentage, t.mccmnc_allowed,
              s.supplier_code, s.connection_type, s.bind_status, s.status AS supplier_status
         FROM trunks t
         JOIN suppliers s ON s.id = t.supplier_id
        WHERE t.id = ANY($1::int[]) AND t.is_active = true
          AND s.status = 'active'`,
      [trunkIds]
    );

    const eligible = trunkRows.rows.filter(trunk => {
      if (!mccGuess) return true;
      const allowed = trunk.mccmnc_allowed || ['*'];
      return allowed.some(pattern => {
        if (pattern === '*') return true;
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(mccGuess);
      });
    });

    // ═══ STEP 2.5: Rate Plan MCCMNC filter — supplier must have matching rates ═══
    // After trunk-level filtering, exclude suppliers whose rate_plan has active
    // rates but NONE match this destination MCC. Suppliers with completely
    // empty rate plans (no active rates) pass through — no rates means no filter.
    if (eligible.length > 0 && mccGuess) {
      const supplierIds = [...new Set(eligible.map(t => t.supplier_id))];
      const ratePlanMatches = await pool.query(
        `SELECT s.id AS supplier_id,
                EXISTS(SELECT 1 FROM rates r WHERE r.entity_type = 'rate_plan' AND r.entity_id = s.rate_plan_id::text AND r.is_active = true) AS has_rates,
                EXISTS(SELECT 1 FROM rates r WHERE r.entity_type = 'rate_plan' AND r.entity_id = s.rate_plan_id::text AND r.is_active = true AND r.mcc = $2) AS has_match
           FROM suppliers s
          WHERE s.id = ANY($1::int[])`,
        [supplierIds, mccGuess]
      );
      const allowedSupplierIds = new Set(
        ratePlanMatches.rows
          .filter(r => !r.has_rates || r.has_match)
          .map(r => r.supplier_id)
      );
      const ratePlanFiltered = eligible.filter(t => allowedSupplierIds.has(t.supplier_id));
      eligible.length = 0;
      eligible.push(...ratePlanFiltered);
    }

    if (eligible.length > 0) {
      if (method === 'priority') {
        eligible.sort((a, b) => a.priority - b.priority);
        const t = eligible[0];
        bestTrunkId = t.id; bestTrunkName = t.trunk_name; bestTrunkType = t.trunk_type;
        bestSupplierId = t.supplier_id; bestSupplierCode = t.supplier_code; bestSupplierConnType = t.connection_type;
      } else if (method === 'percentage') {
        const total = eligible.reduce((sum, t) => sum + (t.percentage || 0), 0);
        if (total > 0) {
          let rand = Math.random() * total;
          for (const t of eligible) {
            rand -= (t.percentage || 0);
            if (rand <= 0) {
              bestTrunkId = t.id; bestTrunkName = t.trunk_name; bestTrunkType = t.trunk_type;
              bestSupplierId = t.supplier_id; bestSupplierCode = t.supplier_code; bestSupplierConnType = t.connection_type;
              break;
            }
          }
        }
        if (!bestTrunkId) {
          const t = eligible[0];
          bestTrunkId = t.id; bestTrunkName = t.trunk_name; bestTrunkType = t.trunk_type;
          bestSupplierId = t.supplier_id; bestSupplierCode = t.supplier_code; bestSupplierConnType = t.connection_type;
        }
      } else if (method === 'lcr') {
        const rateRows = await pool.query(
          `SELECT s.id AS supplier_id, r.rate FROM rates r
             JOIN suppliers s ON s.rate_plan_id::text = r.entity_id AND r.entity_type = 'rate_plan'
           WHERE s.id = ANY($1::int[]) AND r.is_active = true AND ($2::text IS NULL OR r.mcc = $2)`,
          [eligible.map(t => t.supplier_id), mccGuess]
        );
        const rateMap = new Map();
        rateRows.rows.forEach(r => rateMap.set(r.supplier_id, parseFloat(r.rate)));
        eligible.sort((a, b) => {
          const ra = rateMap.get(a.supplier_id) || Infinity;
          const rb = rateMap.get(b.supplier_id) || Infinity;
          return ra - rb;
        });
        const t = eligible[0];
        bestTrunkId = t.id; bestTrunkName = t.trunk_name; bestTrunkType = t.trunk_type;
        bestSupplierId = t.supplier_id; bestSupplierCode = t.supplier_code; bestSupplierConnType = t.connection_type;
      }
    }
  }

  // Step 3 — fallback: route_maps removed. No fallback supplier.
  // If no trunks resolved, the message is unroutable (return null below).
  if (!bestSupplierId) {
    // No fallback — route_maps are obsolete.
  }

  if (!bestSupplierId) return null;

  return {
    supplier_id: bestSupplierId, supplier_code: bestSupplierCode,
    connection_type: bestSupplierConnType,
    route_id: routeId, route_name: routeName, route_method: method,
    trunk_id: bestTrunkId, trunk_name: bestTrunkName, trunk_type: bestTrunkType,
    mcc: resolvedMcc, mnc: matchedMnc, operator: matchedOperator,
  };
};

app.use(cors());

// Trust proxy headers (X-Forwarded-For) so req.ip returns the real client
// IP when running behind nginx or a load balancer. Must be set BEFORE
// security middleware so rate limiters key off real client IPs.
app.set('trust proxy', true);

// ===================== SECURITY MIDDLEWARE =====================
// Rate limiting, bot blocking, Helmet headers. Applied AFTER trust-proxy
// so req.ip returns real client IPs, not the nginx loopback address.
attachSecurityMiddleware(app);

// Sanitize PM2 process name - prevent command injection
function sanitizePm2Name(name) {
  if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error("Invalid process name: only alphanumeric, hyphens, and underscores allowed");
  }
  return name;
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'dist')));
// Serve uploaded audio (greeting files for each digit, per language).
// data/uploads/audio is created by apiExtensions.cjs at boot.
// /uploads/audio is the only public surface right now (per-language greeting
// files for Asterisk). Scope the static mount to that subdir so future files
// dropped under data/uploads/ don't become accidentally public.
app.use('/uploads/audio', express.static(path.join(__dirname, 'data', 'uploads', 'audio')));

// ===================== AUTH MIDDLEWARE =====================
const auth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
};
const roles = (...r) => (req, res, next) => r.includes(req.user.role) ? next() : res.status(403).json({ error: 'Forbidden' });

// =================================================================
// BOOTSTRAP PASSWORD MIGRATION
// =================================================================
// Schema.sql seeds users with a single placeholder bcrypt hash (matches
// the literal "password", not the stated "admin123"). On every boot we
// detect rows that still hold that placeholder and re-hash the real
// password from a known username -> password map. Idempotent: once a
// row has been re-hashed the placeholder hash no longer matches and
// subsequent boots are no-ops.
const // We accept EITHER the legacy bcrypt-then-upgrade fix, OR a strict placeholder
// match. The placeholder hash below decodes to "password" (NOT "admin123").
PLACEHOLDER_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
const SEED_USER_PASSWORDS = {
  admin: 'admin123',
  support: 'support123',
  billing: 'billing123',
  superuser: 'Telco1988',
  techcorp_user: 'techcorp123',
  globalsms_user: 'globalsms123',
};
async function bootstrapPasswordMigration(pool) {
  try {
    const stale = await pool.query(
      'SELECT username FROM users WHERE password_hash = $1 AND is_active = true',
      [PLACEHOLDER_HASH]
    );
    if (!stale.rows.length) {
      console.log('[bootstrap] password hashes already migrated, skipping');
      return;
    }
    for (const row of stale.rows) {
      const wantedPwd = SEED_USER_PASSWORDS[row.username];
      if (!wantedPwd) {
        console.warn(`[bootstrap] no seed password for '${row.username}', leaving hash alone`);
        continue;
      }
      // Defensive: bcrypt.compare against the candidate password FIRST so
      // we never stomp a hand-set hash that just happens to collide by
      // byte equality with the placeholder. If it matches, leave it alone
      // (already a real bcrypt hash of the right password). If it doesn't,
      // re-hash fresh.
      if (await bcrypt.compare(wantedPwd, row.password_hash)) {
        console.log(`[bootstrap] '${row.username}' placeholder hash actually verifies '${wantedPwd}' — normalising to fresh bcrypt instead`);
      }
      const fresh = await bcrypt.hash(wantedPwd, 10);
      await pool.query('UPDATE users SET password_hash = $1 WHERE username = $2', [fresh, row.username]);
      console.log(`[bootstrap] re-hashed password_hash for '${row.username}'`);
    }
  } catch (e) {
    console.warn('[bootstrap] migration failed (non-fatal, login may still fail):', e.message);
  }
}

// =================================================================
// INTERNAL ENDPOINTS — called ONLY by the Java 21 SMPP Gateway.
// NO JWT auth here; in production restrict via firewall / reverse-proxy
// (e.g. only gateway-bridge.cjs and the Java control plane reach these).
// Optional shared-secret via X-Internal-Token header if INTERNAL_TOKEN
// env is set, defeats casual cross-network probing.
// =================================================================
function checkInternalToken(req, res, next) {
  const want = process.env.INTERNAL_TOKEN;
  if (!want) return next();
  const got = req.headers['x-internal-token'];
  if (got === want) return next();
  res.status(401).json({ error: 'invalid internal token' });
}

// Called by Java's EsmcServer when an ESME (client OR inbound supplier) submits
// a bind. Authenticate system_id / password against the clients table first,
// then against the suppliers table (for inbound-supplier devices).
app.post('/internal/esme_auth', checkInternalToken, async (req, res) => {
  try {
    const { system_id, password, remote_ip } = req.body || {};
    if (!system_id || !password) return res.status(400).json({ ok: false, reason: 'missing credentials' });

    // 1) Try clients table
    const rClient = await pool.query(
      "SELECT id, client_code AS code, smpp_password AS pass, status FROM clients WHERE smpp_username = $1",
      [system_id]
    );
    // 2) Try inbound suppliers table
    const rSupplier = await pool.query(
      "SELECT id, supplier_code AS code, smpp_password AS pass, status FROM suppliers WHERE smpp_username = $1 AND is_inbound = true",
      [system_id]
    );

    let match = null;
    let entityType = 'client';
    if (rClient.rows.length) {
      match = rClient.rows[0];
      entityType = 'client';
    } else if (rSupplier.rows.length) {
      match = rSupplier.rows[0];
      entityType = 'supplier';
    } else {
      return res.status(401).json({ ok: false, reason: 'unknown system_id' });
    }

    if (match.status !== 'active') return res.status(403).json({ ok: false, reason: 'inactive' });
    // IP enforcement is intentionally skipped for SMPP ESME binds.
    // client_ips whitelists are for HTTP API access only. SMPP uses
    // username/password authentication — IP filtering here would block
    // legitimate ESME clients whose IPs change or aren't pre-registered.
    
    const stored = match.pass || '';
    let valid = false;
    if (stored.startsWith('$2')) {
      valid = await bcrypt.compare(password, stored);
    } else {
      valid = stored === password;
      if (valid) {
        bcrypt.hash(password, 10).then((h) => {
          const table = entityType === 'client' ? 'clients' : 'suppliers';
          pool.query(`UPDATE ${table} SET smpp_password=$1 WHERE id=$2`, [h, match.id]).catch(() => {});
        }).catch(() => {});
      }
    }
    if (!valid) return res.status(401).json({ ok: false, reason: 'bad credentials' });
    res.json({ ok: true, entity_type: entityType, entity_id: match.id, entity_code: match.code });
  } catch (e) { res.status(500).json({ ok: false, reason: e.message }); }
});

// smppByteToVersion is now imported from src/services/supplierBindHelper.cjs

// ===================== SSE — Server-Sent Events for bind events =====================
// Connected SSE clients (for /api/bind/events). Each entry holds the Express res
// object so we can push events to subscribed browsers in real time.
const sseClients = new Set();
function broadcastBindEvent(event) {
  const json = JSON.stringify(event);
  const frame = `event: bind_update\ndata: ${json}\n\n`;
  for (const client of sseClients) {
    try { client.write(frame); } catch (_) { sseClients.delete(client); }
  }
}
// Heartbeat every 30s to keep SSE connections alive through proxies
setInterval(() => {
  for (const client of sseClients) {
    try { client.write(': heartbeat\n\n'); } catch (_) { sseClients.delete(client); }
  }
}, 30000);

// SSE endpoint — subscribes to real-time bind events. Auth via query param
// since EventSource doesn't support custom headers.
app.get('/api/bind/events', async (req, res) => {
  const token = req.query.token;
  if (!token) { res.status(401).json({ error: 'No token' }); return; }
  let user;
  try { user = jwt.verify(token, JWT_SECRET); } catch (_) { res.status(401).json({ error: 'Invalid token' }); return; }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',  // Disable nginx buffering
  });
  res.write(`data: {"connected":true}\n\n`);

  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
  req.on('error', () => sseClients.delete(res));
});

// Called by Java's EsmcServer when an ESMC bind lifecycle event happens
// (connected, unbound, error). Records it in smpp_sessions. Accepts
// entity_type ('client' or 'supplier') so inbound suppliers also show
// up in the bind-status dashboard.
app.post('/internal/esme_bind_event', checkInternalToken, async (req, res) => {
  try {
    const { entity_type, entity_id, entity_code, client_id, system_id, remote_ip, bind_mode, smpp_session_id, status, interface_version } = req.body || {};
    const finalType = entity_type || 'client';
    const finalId = entity_id || client_id;
    if (!finalId || !smpp_session_id) return res.status(400).json({ ok: false, reason: 'missing fields' });
    const negotiatedVersion = smppByteToVersion(interface_version);
    await pool.query(
      `INSERT INTO smpp_sessions
         (entity_type, entity_id, system_id, ip_address, port, bind_mode, status, negotiated_version, smpp_session_id, connected_at, last_activity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       ON CONFLICT (entity_type, entity_id) DO UPDATE
         SET status = EXCLUDED.status,
             system_id = EXCLUDED.system_id,
             ip_address = EXCLUDED.ip_address,
             port = EXCLUDED.port,
             bind_mode = EXCLUDED.bind_mode,
             last_activity = NOW(),
             negotiated_version = COALESCE(EXCLUDED.negotiated_version, smpp_sessions.negotiated_version),
             smpp_session_id = COALESCE(EXCLUDED.smpp_session_id, smpp_sessions.smpp_session_id),
             disconnected_at = CASE WHEN EXCLUDED.status IN ('unbound','error') THEN NOW() ELSE NULL END,
             connected_at = CASE WHEN EXCLUDED.status = 'bound' THEN NOW() ELSE smpp_sessions.connected_at END`,
      [finalType, finalId, system_id, remote_ip, 2775, bind_mode || 'transceiver', status || 'bound', negotiatedVersion, smpp_session_id]
    );
    // Append to bind_history (separate from smpp_sessions UPSERT — keeps full timeline)
    await pool.query(
      `INSERT INTO bind_history
         (entity_type, entity_id, system_id, ip_address, port, bind_mode, status, negotiated_version, smpp_session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [finalType, finalId, system_id, remote_ip, 2775, bind_mode || 'transceiver', status || 'bound', negotiatedVersion, smpp_session_id]
    ).catch(e => console.warn('[bind_history] insert failed (non-fatal):', e.message));
    // Mirror bind status back to suppliers table for inbound suppliers
    if (finalType === 'supplier') {
      const supStatus = status === 'bound' ? 'bound' : (status === 'error' || status === 'unbound' ? 'unbound' : status || 'bound');
      await pool.query("UPDATE suppliers SET bind_status = $1 WHERE id = $2", [supStatus, finalId]);
    }
    // Push to SSE clients so BindStatus page updates instantly
    broadcastBindEvent({
      entity_type: finalType,
      entity_id: finalId,
      entity_code: entity_code || '',
      system_id: system_id || '',
      ip_address: remote_ip || '',
      port: 2775,
      bind_mode: bind_mode || 'transceiver',
      status: status || 'bound',
      negotiated_version: negotiatedVersion,
      smpp_session_id: smpp_session_id,
      timestamp: new Date().toISOString(),
    });
    res.json({ ok: true, recorded_negotiated_version: negotiatedVersion });
  } catch (e) { res.status(500).json({ ok: false, reason: e.message }); }
});

// Called by Java when the gateway receives a delivery_sm from a supplier.
// Java (or a webhook) is the one that knows the smpp_message_id; we look
// up sms_logs by the client-side message_id. Also accepts DLRs from
// Android SMS gateways via HTTP (no INTERNAL_TOKEN needed).
// We also do billing-mode:
// if dlr_status='DELIVRD' AND client.billing_mode='dlr', deduct from
// balance and bump supplier consecutive_failures back to zero.
app.post('/internal/dlr_event', async (req, res) => {
  try {
    const { message_id, smpp_message_id, dlr_status, error_code, destination, client_id, supplier_id } = req.body || {};
    if (!message_id) return res.status(400).json({ ok: false, reason: 'missing message_id' });
    const finalStatus = (dlr_status === 'DELIVRD') ? 'delivered'
                       : (dlr_status === 'EXPIRED') ? 'expired'
                       : (dlr_status === 'REJECTD' || dlr_status === 'UNDELIV') ? 'failed'
                       : (dlr_status === 'SUBMITTED' || dlr_status === 'ACCEPTD') ? 'sent'
                       : 'submitted';
    let upd = await pool.query(
      `UPDATE sms_logs
         SET status = $1,
             dlr_status = $2,
             dlr_timestamp = NOW(),
             delivery_time = NOW(),
             smpp_message_id = COALESCE($3, smpp_message_id),
             error_code = $4
       WHERE (message_id = $5 OR smpp_message_id = $5)
         AND ($6::int IS NULL OR client_id = $6)
       RETURNING client_id, client_rate, message_parts, currency`,
      [finalStatus, dlr_status, smpp_message_id || null, error_code || null, message_id, client_id || null]
    );
    // Fallback: if the primary match (by message_id/smpp_message_id) found
    // nothing, try matching by destination + supplier_id for the most recent
    // "sent"/"submitted" message. This handles DLRs from GSM modems whose
    // internal message IDs don't match our UUIDs.
    if (!upd.rowCount && destination && supplier_id) {
      let fallbackQ = `UPDATE sms_logs
         SET status = $1,
             dlr_status = $2,
             dlr_timestamp = NOW(),
             delivery_time = NOW(),
             smpp_message_id = COALESCE($3, smpp_message_id),
             error_code = $4
       WHERE destination = $5
         AND supplier_id = $6
         AND status IN ('sent','submitted')`;
      const fallbackParams = [finalStatus, dlr_status, smpp_message_id || null, error_code || null, destination, supplier_id];
      if (client_id) {
        fallbackQ += ` AND client_id = $${fallbackParams.length + 1}`;
        fallbackParams.push(client_id);
      }
      fallbackQ += ` ORDER BY submit_time DESC LIMIT 1 RETURNING client_id, client_rate, message_parts, currency`;
      upd = await pool.query(fallbackQ, fallbackParams);
      if (upd.rowCount) {
        console.log(`[dlr] fallback match: dest=${destination} supplier=${supplier_id} client=${client_id || '?'} status=${finalStatus}`);
      }
    }
    if (upd.rowCount && client_id) {
      const row = upd.rows[0];
      // Apply DLR-mode billing: only charge on DELIVRD
      if (dlr_status === 'DELIVRD') {
        const cl = await pool.query('SELECT billing_mode FROM clients WHERE id = $1', [client_id]);
        if (cl.rows[0]?.billing_mode === 'dlr') {
          const cost = parseFloat(row.client_rate) * (row.message_parts || 1);
          await pool.query('UPDATE clients SET balance = balance - $1 WHERE id = $2', [cost, client_id]);
        }
      }
      // Failure path: bump supplier failures (SMPP only — non-SMPP don't have real binds)
      if (finalStatus === 'failed' && supplier_id) {
        await pool.query(
          `UPDATE suppliers
             SET consecutive_failures = consecutive_failures + 1,
                 bind_status = CASE WHEN connection_type <> 'smpp' THEN bind_status ELSE CASE WHEN consecutive_failures + 1 >= max_failures THEN 'unbound'::varchar ELSE bind_status END END,
                 status      = CASE WHEN connection_type <> 'smpp' THEN status ELSE CASE WHEN consecutive_failures + 1 >= max_failures THEN 'inactive'::varchar ELSE status END END
           WHERE id = $1`,
          [supplier_id]
        );
      }
      if (finalStatus === 'delivered' && supplier_id) {
        await pool.query('UPDATE suppliers SET consecutive_failures = 0 WHERE id = $1', [supplier_id]);
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, reason: e.message }); }
});

// Called by Java's DlrRouter before pushing a DLR back to the originating
// client. Java wants to know whether to POST to webhook_url OR push an
// SMPP delivery_sm to the bound ESME session.
// Test messages (source='test_sms') skip external DLR push — the DLR is
// still logged in sms_logs, but not forwarded to external clients.
app.post('/internal/esme_delivery_lookup', checkInternalToken, async (req, res) => {
  try {
    const { client_id, message_id } = req.body || {};
    if (!client_id) return res.status(400).json({ ok: false });

    // For test messages: log the DLR in sms_logs but don't push to external clients
    if (message_id) {
      const log = await pool.query('SELECT source FROM sms_logs WHERE message_id = $1 LIMIT 1', [message_id]);
      if (log.rows[0]?.source === 'test_sms') {
        return res.json({ webhook_url: null, esme_smpp_session_id: null, skipped: true, reason: 'test_sms' });
      }
    }

    const cl = await pool.query('SELECT webhook_url FROM clients WHERE id = $1', [client_id]);
    const sess = await pool.query(
      `SELECT smpp_session_id FROM smpp_sessions
         WHERE entity_type = 'client' AND entity_id = $1
         ORDER BY last_activity DESC NULLS LAST
         LIMIT 1`,
      [client_id]
    );
    res.json({
      webhook_url: cl.rows[0]?.webhook_url || null,
      esme_smpp_session_id: sess.rows[0]?.smpp_session_id || null,
    });
  } catch (e) { res.status(500).json({ ok: false, reason: e.message }); }
});

// Called by Java gateway on startup to fetch all active outbound SMPP
// suppliers that need to be auto-bound. Returns minimal bindable rows.
app.get('/internal/suppliers/active_outbound', checkInternalToken, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id AS supplier_id, smpp_host AS host, smpp_port AS port, smpp_username AS system_id, smpp_password AS password, smpp_system_type AS system_type, smpp_bind_type AS bind_type, smpp_addr_ton AS addr_ton, smpp_addr_npi AS addr_npi, smpp_addr_range AS addr_range, smpp_version FROM suppliers WHERE connection_type = 'smpp' AND is_inbound = false AND status = 'active'"
    );
    res.json({ ok: true, suppliers: r.rows });
  } catch (e) { res.status(500).json({ ok: false, reason: e.message }); }
});

// === NEW: Called by Java's EsmcServer when it needs to route an inbound
// submit_sm to the correct supplier. Uses the shared resolveRouteForClient
// helper which chains: route_maps → routes → trunks → supplier.
app.post('/internal/esme_route_lookup', checkInternalToken, async (req, res) => {
  try {
    const { client_id, destination, client_code } = req.body || {};
    if (!client_id) return res.status(400).json({ ok: false });

    const route = await pool.resolveRouteForClient(client_id, destination);
    if (!route) return res.json({ ok: false });

    res.json({
      ok: true,
      supplier: {
        supplier_id: route.supplier_id,
        supplier_code: route.supplier_code,
        connection_type: route.connection_type,
        route_id: route.route_id,
        route_name: route.route_name,
        trunk_id: route.trunk_id,
        trunk_name: route.trunk_name,
        trunk_type: route.trunk_type,
      }
    });
  } catch (e) { res.status(500).json({ ok: false, reason: e.message }); }
});

// ===================== AUTH =====================
// Validate the current JWT and return the user profile. Used by the
// frontend on mount to restore a session from a localStorage-saved token.
app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM users WHERE id=$1 AND is_active=true', [req.user.id]);
    if (!r.rows.length) return res.status(401).json({ error: 'User not found or inactive' });
    const { password_hash, ...safe } = r.rows[0];
    res.json({ success: true, user: safe });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// In-memory IP login failure tracker (cleared on server restart)
const ipLoginFailures = new Map();
const MAX_LOGIN_FAILURES = 10;

app.post('/api/auth/login', async (req, res) => {
  try {
    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
    const { username, password } = req.body;
    
    // IP enforcement: check blacklists (both blacklist and web_login_blacklist)
    const ipCheck = await pool.checkIpEnforcement(clientIp);
    if (ipCheck.blocked) return res.status(403).json({ error: ipCheck.reason });
    
    const r = await pool.query('SELECT * FROM users WHERE username=$1 AND is_active=true', [username]);
    if (!r.rows.length) {
      // Track failed login by IP
      const count = (ipLoginFailures.get(clientIp) || 0) + 1;
      ipLoginFailures.set(clientIp, count);
      if (count >= MAX_LOGIN_FAILURES) {
        await pool.query(
          `INSERT INTO ip_lists (ip_address, list_type, notes, created_by)
           VALUES ($1, 'web_login_blacklist', $2, 'system')
           ON CONFLICT (ip_address, list_type) DO NOTHING`,
          [clientIp, `Auto-blacklisted after ${count} failed login attempts`]
        );
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = r.rows[0];
    let valid = await bcrypt.compare(password, user.password_hash);
    // Fallback: if bcrypt fails but this is a seed user whose password matches
    // the known plaintext seed password, accept and re-hash. This handles DB
    // restores where password hashes don't match the expected bcrypt values.
    if (!valid && SEED_USER_PASSWORDS[username] && password === SEED_USER_PASSWORDS[username]) {
      console.log(`[login] seed fallback for '${username}' — re-hashing to fresh bcrypt`);
      const fresh = await bcrypt.hash(password, 10);
      pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [fresh, user.id])
        .catch(e => console.warn('[login] re-hash update failed for', username, e.message));
      valid = true;
    }
    if (!valid) {
      const count = (ipLoginFailures.get(clientIp) || 0) + 1;
      ipLoginFailures.set(clientIp, count);
      if (count >= MAX_LOGIN_FAILURES) {
        await pool.query(
          `INSERT INTO ip_lists (ip_address, list_type, notes, created_by)
           VALUES ($1, 'web_login_blacklist', $2, 'system')
           ON CONFLICT (ip_address, list_type) DO NOTHING`,
          [clientIp, `Auto-blacklisted after ${count} failed login attempts`]
        );
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Clear IP failure count on successful login
    ipLoginFailures.delete(clientIp);
    await pool.query('UPDATE users SET last_login=NOW() WHERE id=$1', [user.id]);
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    const { password_hash, ...safe } = user;
    res.json({ success: true, token, user: safe });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===================== CLIENTS =====================
// Whitelist of allowed client column names — must match schema.sql clients table.
// Used by POST and PUT to prevent SQL injection via user-supplied column names.
const CLIENT_COLUMNS = new Set([
  'client_code', 'company_name', 'contact_person', 'email', 'phone', 'address', 'country',
  'smpp_username', 'smpp_password', 'smpp_ip', 'smpp_port', 'system_type', 'max_tps',
  'billing_mode', 'currency', 'balance', 'credit_limit',
  'api_enabled', 'webhook_url', 'force_dlr', 'force_dlr_timeout_mode', 'dlr_timeout',
  'routing_plan_id', 'rate_plan_id', 'status', 'deleted_at',
  'connection_type', 'api_connector_id', 'voice_otp_config_id', 'whatsapp_device_ids', 'telegram_device_ids'
]);
app.get('/api/clients', auth, async (req, res) => {
  const r = await pool.query('SELECT * FROM clients ORDER BY created_at DESC');
  res.json({ success: true, data: r.rows });
});
app.post('/api/clients', auth, roles('super_admin','admin'), async (req, res) => {
  const body = req.body;
  const keys = Object.keys(body).filter(k => CLIENT_COLUMNS.has(k) && body[k] !== undefined && body[k] !== null && body[k] !== '');
  if (!keys.length) return res.status(400).json({ error: 'No fields provided' });
  const cols = keys.join(',');
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
  const vals = keys.map(k => body[k]);
  const r = await pool.query(
    `INSERT INTO clients (${cols}) VALUES (${placeholders}) RETURNING *`,
    vals
  );
  // Send welcome email if client has an email address
  const newClient = r.rows[0];
  if (newClient.email) {
    emailService.sendNotificationEmail({
      template_name: 'Client Account Created',
      variables: {
        client_name: newClient.company_name || 'Client',
        client_code: newClient.client_code || 'N/A',
        smpp_username: newClient.smpp_username || 'N/A',
        platform_name: 'NET2APP Hub',
      },
      recipients: [newClient.email],
    }).catch(e => console.warn('[email] Client welcome email failed:', e.message));
  }
  res.json({ success: true, data: newClient });
});
app.put('/api/clients/:id', auth, roles('super_admin','admin'), async (req, res) => {
  const id = req.params.id;
  const keys = Object.keys(req.body).filter(k => CLIENT_COLUMNS.has(k) && req.body[k] !== undefined && req.body[k] !== '');
  if (!keys.length) return res.status(400).json({ error: 'No fields provided' });
  const sets = keys.map((k, i) => `${k}=$${i + 1}`).join(',');
  const vals = keys.map(k => req.body[k]);
  await pool.query(`UPDATE clients SET ${sets}, updated_at=NOW() WHERE id=$${vals.length + 1}`, [...vals, id]);
  res.json({ success: true });
});
// Soft delete: set status='deleted' — keeps sms_logs, payments, invoices, and all historical data intact.
// Bind status is not affected (clients don't have SMPP bind state in the same way suppliers do).
app.delete('/api/clients/:id', auth, roles('super_admin'), async (req, res) => {
  await pool.query("UPDATE clients SET status='deleted', deleted_at=NOW(), updated_at=NOW() WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

// Restore a soft-deleted client back to active
app.post('/api/clients/:id/restore', auth, roles('super_admin','admin'), async (req, res) => {
  await pool.query("UPDATE clients SET status='active', deleted_at=NULL, updated_at=NOW() WHERE id=$1 AND status='deleted'", [req.params.id]);
  res.json({ success: true });
});

// ===================== CLIENT IP WHITELIST =====================
// Bulk IP count per client — used by ClientsList for the IP column
app.get('/api/clients/ips/counts', auth, async (req, res) => {
  const r = await pool.query(
    'SELECT client_id, COUNT(*)::int AS ip_count FROM client_ips GROUP BY client_id'
  );
  const map = {};
  for (const row of r.rows) map[row.client_id] = row.ip_count;
  res.json({ success: true, data: map });
});

app.get('/api/clients/:id/ips', auth, async (req, res) => {
  const r = await pool.query('SELECT * FROM client_ips WHERE client_id=$1 ORDER BY created_at', [req.params.id]);
  res.json({ success: true, data: r.rows });
});
app.post('/api/clients/:id/ips', auth, roles('super_admin','admin'), async (req, res) => {
  const { ip_address, label } = req.body;
  if (!ip_address) return res.status(400).json({ error: 'ip_address required' });
  const r = await pool.query('INSERT INTO client_ips (client_id, ip_address, label) VALUES ($1,$2,$3) RETURNING *', [req.params.id, ip_address, label || '']);
  res.json({ success: true, data: r.rows[0] });
});
app.delete('/api/clients/:id/ips/:ipId', auth, roles('super_admin','admin'), async (req, res) => {
  await pool.query('DELETE FROM client_ips WHERE id=$1 AND client_id=$2', [req.params.ipId, req.params.id]);
  res.json({ success: true });
});

// ===================== RATE PLANS =====================
app.get('/api/rate-plans', auth, async (req, res) => {
  const r = await pool.query('SELECT * FROM rate_plans ORDER BY is_default DESC, plan_name');
  res.json({ success: true, data: r.rows });
});
app.post('/api/rate-plans', auth, roles('super_admin','admin'), async (req, res) => {
  const { plan_name, description, is_default } = req.body;
  if (!plan_name) return res.status(400).json({ error: 'plan_name required' });
  const r = await pool.query('INSERT INTO rate_plans (plan_name, description, is_default) VALUES ($1,$2,$3) RETURNING *', [plan_name, description || '', is_default || false]);
  res.json({ success: true, data: r.rows[0] });
});
app.put('/api/rate-plans/:id', auth, roles('super_admin','admin'), async (req, res) => {
  const keys = Object.keys(req.body).filter(k => ['plan_name','description','is_default'].includes(k) && req.body[k] !== undefined);
  if (!keys.length) return res.status(400).json({ error: 'No valid fields' });
  const sets = keys.map((k, i) => `"${k}"=$${i+1}`).join(',');
  const vals = keys.map(k => req.body[k]);
  await pool.query(`UPDATE rate_plans SET ${sets}, updated_at=NOW() WHERE id=$${keys.length+1}`, [...vals, req.params.id]);
  res.json({ success: true });
});
app.delete('/api/rate-plans/:id', auth, roles('super_admin'), async (req, res) => {
  await pool.query('DELETE FROM rate_plans WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});

// ===================== SUPPLIERS =====================
// Whitelist of allowed supplier column names — must match schema.sql suppliers table.
const SUPPLIER_COLUMNS = new Set([
  'supplier_code', 'company_name', 'contact_person', 'email', 'phone',
  'connection_type', 'smpp_host', 'smpp_port', 'smpp_username', 'smpp_password', 'system_id',
  'smpp_version', 'smpp_system_type', 'smpp_bind_type', 'smpp_addr_ton', 'smpp_addr_npi', 'smpp_addr_range', 'is_inbound',
  'api_url', 'api_key', 'api_secret', 'api_method',
  'balance', 'credit_limit', 'currency',
  'bind_status', 'consecutive_failures', 'max_failures',
  'force_dlr', 'force_dlr_timeout_mode', 'dlr_timeout', 'status', 'deleted_at',
  'api_connector_id', 'voice_otp_config_id', 'whatsapp_device_ids', 'telegram_device_ids', 'rate_plan_id'
]);
app.get('/api/suppliers', auth, async (req, res) => {
  const r = await pool.query('SELECT * FROM suppliers ORDER BY created_at DESC');
  res.json({ success: true, data: r.rows });
});
app.post('/api/suppliers', auth, roles('super_admin','admin'), async (req, res) => {
  const body = req.body;
  const keys = Object.keys(body).filter(k => SUPPLIER_COLUMNS.has(k) && body[k] !== undefined && body[k] !== null && body[k] !== '');
  if (!keys.length) return res.status(400).json({ error: 'No fields provided' });
  const cols = keys.join(',');
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
  const vals = keys.map(k => body[k]);
  const r = await pool.query(
    `INSERT INTO suppliers (${cols}) VALUES (${placeholders}) RETURNING *`,
    vals
  );
  // Send welcome email if supplier has an email address
  const newSupplier = r.rows[0];
  if (newSupplier.email) {
    emailService.sendNotificationEmail({
      template_name: 'Supplier Account Created',
      variables: {
        supplier_code: newSupplier.supplier_code || 'N/A',
        contact_person: newSupplier.contact_person || newSupplier.company_name || 'Supplier',
        connection_type: newSupplier.connection_type || 'N/A',
      },
      recipients: [newSupplier.email],
    }).catch(e => console.warn('[email] Supplier welcome email failed:', e.message));
  }
  res.json({ success: true, data: newSupplier });
});
app.put('/api/suppliers/:id', auth, roles('super_admin','admin'), async (req, res) => {
  const id = req.params.id;
  const keys = Object.keys(req.body).filter(k => SUPPLIER_COLUMNS.has(k) && req.body[k] !== undefined && req.body[k] !== '');
  if (!keys.length) return res.status(400).json({ error: 'No fields provided' });
  const sets = keys.map((k, i) => `${k}=$${i + 1}`).join(',');
  const vals = keys.map(k => req.body[k]);
  await pool.query(`UPDATE suppliers SET ${sets}, updated_at=NOW() WHERE id=$${vals.length + 1}`, [...vals, id]);
  res.json({ success: true });
});

// ===================== SUPPLIER IP WHITELIST =====================
app.get('/api/suppliers/:id/ips', auth, async (req, res) => {
  const r = await pool.query('SELECT * FROM supplier_ips WHERE supplier_id=$1 ORDER BY created_at', [req.params.id]);
  res.json({ success: true, data: r.rows });
});
app.post('/api/suppliers/:id/ips', auth, roles('super_admin','admin'), async (req, res) => {
  const { ip_address, label } = req.body;
  if (!ip_address) return res.status(400).json({ error: 'ip_address required' });
  const r = await pool.query('INSERT INTO supplier_ips (supplier_id, ip_address, label) VALUES ($1,$2,$3) RETURNING *', [req.params.id, ip_address, label || '']);
  res.json({ success: true, data: r.rows[0] });
});
app.delete('/api/suppliers/:id/ips/:ipId', auth, roles('super_admin','admin'), async (req, res) => {
  await pool.query('DELETE FROM supplier_ips WHERE id=$1 AND supplier_id=$2', [req.params.ipId, req.params.id]);
  res.json({ success: true });
});

// ===================== SUPPLIER SOFT DELETE =====================
// Soft delete: set status='deleted', auto-unbind if bound, but keep all
// sms_logs, payments, invoices, and financial data intact.
app.delete('/api/suppliers/:id', auth, roles('super_admin'), async (req, res) => {
  try {
    const supplier = await pool.query('SELECT * FROM suppliers WHERE id=$1', [req.params.id]);
    if (!supplier.rows.length) return res.status(404).json({ error: 'Supplier not found' });
    const s = supplier.rows[0];
    // Auto-unbind if currently bound (SMPP only)
    if (s.bind_status === 'bound' && s.connection_type === 'smpp') {
      performSupplierUnbind(parseInt(req.params.id)).catch(() => {});
    }
    // Soft delete: keep row but mark as deleted + unbound
    await pool.query("UPDATE suppliers SET status='deleted', bind_status='unbound', deleted_at=NOW(), updated_at=NOW() WHERE id=$1", [req.params.id]);
    res.json({ success: true, unbind_triggered: s.bind_status === 'bound' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Restore a soft-deleted supplier back to active (does NOT auto-rebind — user must reconnect manually)
app.post('/api/suppliers/:id/restore', auth, roles('super_admin','admin'), async (req, res) => {
  try {
    await pool.query("UPDATE suppliers SET status='active', deleted_at=NULL, updated_at=NOW() WHERE id=$1 AND status='deleted'", [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===================== IP LISTS =====================
// CRUD for IP whitelist/blacklist/unaudited/web_login_blacklist
app.get('/api/ip-lists', auth, async (req, res) => {
  try {
    const { type, trunk_id } = req.query;
    let q = 'SELECT * FROM ip_lists WHERE 1=1';
    const p = []; let i = 1;
    if (type) { q += ` AND list_type=$${i++}`; p.push(type); }
    if (trunk_id) { q += ` AND trunk_id=$${i++}`; p.push(parseInt(trunk_id, 10)); }
    q += ' ORDER BY created_at DESC';
    const r = await pool.query(q, p);
    res.json({ success: true, data: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/ip-lists', auth, roles('super_admin','admin','support'), async (req, res) => {
  try {
    const { ip_address, list_type, notes, trunk_id } = req.body;
    if (!ip_address || !list_type) return res.status(400).json({ error: 'ip_address and list_type required' });
    const r = await pool.query(
      `INSERT INTO ip_lists (ip_address, list_type, notes, trunk_id, created_by)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (ip_address, list_type) DO UPDATE SET notes=EXCLUDED.notes, trunk_id=EXCLUDED.trunk_id, updated_at=NOW()
       RETURNING *`,
      [ip_address, list_type, notes || null, trunk_id || null, req.user?.username || 'system']
    );
    res.json({ success: true, data: r.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/ip-lists/:id', auth, roles('super_admin','admin','support'), async (req, res) => {
  try {
    const { ip_address, list_type, notes, trunk_id } = req.body;
    const id = req.params.id;
    const sets = []; const vals = []; let i = 1;
    if (ip_address !== undefined) { sets.push(`ip_address=$${i++}`); vals.push(ip_address); }
    if (list_type !== undefined) { sets.push(`list_type=$${i++}`); vals.push(list_type); }
    if (notes !== undefined) { sets.push(`notes=$${i++}`); vals.push(notes); }
    if (trunk_id !== undefined) { sets.push(`trunk_id=$${i++}`); vals.push(trunk_id); }
    if (!sets.length) return res.status(400).json({ error: 'No fields provided' });
    sets.push(`updated_at=NOW()`);
    vals.push(id);
    await pool.query(`UPDATE ip_lists SET ${sets.join(',')} WHERE id=$${i}`, vals);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/ip-lists/:id', auth, roles('super_admin','admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM ip_lists WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===================== BIND STATUS =====================
// Get all bind statuses with session details from DB — now includes clients too
app.get('/api/bind/status', auth, async (req, res) => {
  const r = await pool.query(`SELECT s.id, s.supplier_code, s.company_name, s.connection_type,
    CASE WHEN s.connection_type <> 'smpp' AND s.status = 'active' THEN 'bound' ELSE s.bind_status END as bind_status,
    s.consecutive_failures, s.status,
    s.is_inbound, s.smpp_host, s.smpp_port, s.smpp_version,
    COALESCE(ss.status, CASE WHEN s.connection_type <> 'smpp' AND s.status = 'active' THEN 'bound' ELSE 'unbound' END) as session_status,
    ss.connected_at, ss.disconnected_at, ss.last_activity, ss.system_id,
    ss.bind_mode, ss.negotiated_version,
    COALESCE(ss.remote_ip, ss.ip_address) as session_ip,
    ss.port as session_port, ss.bound_count, ss.smpp_session_id
    FROM suppliers s LEFT JOIN smpp_sessions ss ON ss.entity_id = s.id AND ss.entity_type = 'supplier'
    ORDER BY s.id`);
  res.json({ success: true, data: r.rows });
});

// Get single supplier bind status
app.get('/api/bind/status/:id', auth, async (req, res) => {
  const r = await pool.query(`SELECT s.*, ss.status as session_status, ss.connected_at, ss.last_activity, ss.system_id, ss.bind_mode
    FROM suppliers s LEFT JOIN smpp_sessions ss ON ss.entity_id = s.id AND ss.entity_type = 'supplier'
    WHERE s.id = $1`, [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true, data: r.rows[0] });
});

// performSupplierBind, smppVersionToByte, and smppByteToVersion are now
// imported from src/services/supplierBindHelper.cjs and wired via
// createPerformSupplierBind(pool, bridge) above.

// Connect/bind SMPP supplier — delegates to shared performSupplierBind
app.post('/api/bind/:id/connect', auth, roles('super_admin','admin','support'), async (req, res) => {
  try {
    const supplier = await pool.query('SELECT * FROM suppliers WHERE id=$1', [req.params.id]);
    if (!supplier.rows.length) return res.status(404).json({ error: 'Supplier not found' });
    const s = supplier.rows[0];
    if (s.connection_type !== 'smpp') return res.status(400).json({ error: 'Supplier is not SMPP type' });

    const result = await performSupplierBind(s);

    if (result.ok) {
      return res.json({
        success: true,
        message: 'Bind successful',
        bind_status: 'bound',
        negotiated_version: result.negotiatedVersion,
        negotiated_interface_version: result.negotiatedHex,
        requested_version: s.smpp_version || 'auto',
      });
    }

    return res.json({
      success: false,
      message: result.gatewayDown ? 'Java SMPP gateway unreachable' : 'Bind failed — supplier rejected all attempted SMPP versions',
      bind_status: 'error',
      requested_version: s.smpp_version || 'auto',
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Disconnect/unbind SMPP — delegates to shared performSupplierUnbind
app.post('/api/bind/:id/disconnect', auth, roles('super_admin','admin','support'), async (req, res) => {
  try {
    const supplierId = parseInt(req.params.id, 10);
    await performSupplierUnbind(supplierId);
    res.json({ success: true, message: 'Disconnected', bind_status: 'unbound' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Reconnect SMPP — delegates to shared performSupplierBind
app.post('/api/bind/:id/reconnect', auth, roles('super_admin','admin','support'), async (req, res) => {
  try {
    const supplier = await pool.query('SELECT * FROM suppliers WHERE id=$1', [req.params.id]);
    if (!supplier.rows.length) return res.status(404).json({ error: 'Supplier not found' });
    const s = supplier.rows[0];
    if (s.connection_type !== 'smpp') return res.status(400).json({ error: 'Supplier is not SMPP type' });
    if (s.is_inbound) return res.status(400).json({ error: 'Inbound suppliers connect to us — cannot reconnect outbound' });

    const result = await performSupplierBind(s, { incrementBoundCount: true, resetFailures: true });

    if (result.ok) {
      return res.json({ success: true, message: 'Reconnected', bind_status: 'bound', negotiated_version: result.negotiatedVersion });
    }

    return res.json({
      success: false,
      message: result.gatewayDown ? 'Java SMPP gateway unreachable' : 'Reconnect failed — supplier rejected bind',
      bind_status: 'error',
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Test SMPP connection — performs a real auto-negotiation bind test via the
// Java 21 SMPP gateway. Binds temporarily to try v5.0 → v3.4 → v3.3,
// reports the negotiated version, then unbinds. Does NOT persist any
// state change to the suppliers table.
app.post('/api/bind/test', auth, async (req, res) => {
  try {
    const { host, port, username, password, interface_version, system_type, bind_type, addr_ton, addr_npi, addr_range, supplier_id, is_inbound } = req.body || {};
    // Inbound suppliers connect to us — can't test them outbound
    if (is_inbound) return res.json({ success: true, connected: false, message: 'Inbound supplier — connects to us, no outbound test available', negotiated_version: null, host: host || 'N/A', port: port || 2775 });
    if (!host || !port || !username) return res.status(400).json({ error: 'host, port, and username required' });

    // Use a negative supplier_id for ephemeral test binds so we never collide
    // with real supplier rows. Java's SmscManager just needs a unique key.
    // Fall back to -999 if supplier_id parses to NaN (e.g. non-numeric IDs).
    const parsedId = parseInt(String(supplier_id || ''), 10);
    const testSupplierId = Number.isFinite(parsedId) ? -Math.abs(parsedId) : -999;

    // Attempt auto-negotiation bind via Java gateway (20s timeout).
    const result = await bridge.bindSupplierLongTimeout({
      supplier_id: testSupplierId,
      smpp_host: host,
      smpp_port: port,
      smpp_username: username,
      smpp_password: password || '',
      system_type: system_type || '',
      bind_type: bind_type || 'trx',
      addr_ton: addr_ton ?? 0,
      addr_npi: addr_npi ?? 0,
      addr_range: addr_range || 'system_id',
      interface_version: interface_version ?? null,
    });

    if (result && result.ok) {
      const negotiatedHex = result.negotiated_interface_version;
      const verStr = negotiatedHex ? smppByteToVersion(parseInt(negotiatedHex, 16)) : null;

      // Clean up: unbind the temporary test session. Fire-and-forget so the
      // response doesn't wait; if Java is down the test session will expire.
      bridge.unbindSupplier(testSupplierId).catch(() => {});

      return res.json({
        success: true,
        connected: true,
        message: `Connected via SMPP v${verStr || 'unknown'}`,
        negotiated_version: verStr,
        negotiated_interface_version: negotiatedHex,
        host, port,
      });
    }

    // Bind failed — Java either timed out or the supplier rejected all versions
    const reason = result === null
      ? 'Java SMPP gateway unreachable'
      : 'Supplier rejected all attempted SMPP versions (v5.0, v3.4, v3.3)';
    res.json({
      success: true,
      connected: false,
      message: `Connection failed: ${reason}`,
      negotiated_version: null,
      host, port,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get smpp_sessions list
app.get('/api/smpp_sessions', auth, async (req, res) => {
  const r = await pool.query('SELECT * FROM smpp_sessions ORDER BY last_activity DESC');
  res.json({ success: true, data: r.rows });
});

// === NEW: Real-time SMPP sessions endpoint — returns ALL active ESMC/SMSC sessions
// Uses the active_smpp_sessions view (from multi_channel_migrations.sql) which
// joins smpp_sessions with clients/suppliers and handles COALESCE(remote_ip, ip_address).
app.get('/api/bind/sessions', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM active_smpp_sessions ORDER BY last_activity DESC NULLS LAST');
    res.json({ success: true, data: r.rows });
  } catch (e) {
    // View might not exist yet — fall back to raw join
    try {
      const r = await pool.query(`
        SELECT
          ss.id, ss.entity_type, ss.entity_id, ss.system_id,
          COALESCE(ss.remote_ip, ss.ip_address) AS ip_address,
          ss.port, ss.bind_mode, ss.status,
          ss.negotiated_version, ss.connected_at, ss.disconnected_at,
          ss.last_activity, ss.bound_count, ss.smpp_session_id,
          CASE WHEN ss.entity_type = 'client' THEN c.client_code
               WHEN ss.entity_type = 'supplier' THEN s.supplier_code
          END AS entity_code,
          CASE WHEN ss.entity_type = 'client' THEN c.company_name
               WHEN ss.entity_type = 'supplier' THEN s.company_name
          END AS entity_name,
          COALESCE(s.connection_type, 'smpp') AS connection_type,
          COALESCE(s.is_inbound, false) AS is_inbound
        FROM smpp_sessions ss
          LEFT JOIN clients c ON ss.entity_type = 'client' AND ss.entity_id = c.id
          LEFT JOIN suppliers s ON ss.entity_type = 'supplier' AND ss.entity_id = s.id
        ORDER BY ss.last_activity DESC NULLS LAST`);
      res.json({ success: true, data: r.rows });
    } catch (e2) { res.status(500).json({ error: e2.message }); }
  }
});

// === NEW: Supplier bind history — chronological timeline of bind/unbind events
app.get('/api/suppliers/:id/bind-history', auth, async (req, res) => {
  try {
    const supplierId = parseInt(req.params.id, 10);
    if (isNaN(supplierId)) return res.status(400).json({ error: 'Invalid supplier ID' });

    // Verify supplier exists
    const sup = await pool.query('SELECT id, supplier_code, company_name FROM suppliers WHERE id = $1', [supplierId]);
    if (!sup.rows.length) return res.status(404).json({ error: 'Supplier not found' });

    const r = await pool.query(
      `SELECT id, entity_type, entity_id, system_id, ip_address, port,
              bind_mode, status, negotiated_version, smpp_session_id,
              created_at
         FROM bind_history
        WHERE entity_type = 'supplier' AND entity_id = $1
        ORDER BY created_at DESC
        LIMIT 100`,
      [supplierId]
    );

    res.json({
      success: true,
      supplier: sup.rows[0],
      data: r.rows,
      count: r.rowCount,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === NEW: All bind history — returns combined timeline for all suppliers and clients
// with entity names resolved, ordered by created_at DESC.
app.get('/api/bind/history', auth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 200);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
    const entityType = req.query.entity_type || null;   // 'client' | 'supplier' | null (all)
    const entityId = parseInt(req.query.entity_id, 10) || null;

    // Build WHERE clause for filtering
    const where = [];
    const params = [];
    if (entityType && ['client','supplier'].includes(entityType)) {
      where.push(`bh.entity_type = $${params.length + 1}`);
      params.push(entityType);
    }
    if (entityId) {
      where.push(`bh.entity_id = $${params.length + 1}`);
      params.push(entityId);
    }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    // Count with same filter
    const total = await pool.query(`SELECT COUNT(*)::int AS cnt FROM bind_history bh ${whereClause}`, params);

    // Main query with filter
    params.push(limit, offset);
    const pLimit = params.length - 1;
    const pOffset = params.length;
    const r = await pool.query(
      `SELECT bh.id, bh.entity_type, bh.entity_id, bh.system_id,
              bh.ip_address, bh.port, bh.bind_mode, bh.status,
              bh.negotiated_version, bh.smpp_session_id, bh.created_at,
              CASE WHEN bh.entity_type = 'supplier' THEN s.supplier_code
                   WHEN bh.entity_type = 'client' THEN c.client_code
              END AS entity_code,
              CASE WHEN bh.entity_type = 'supplier' THEN s.company_name
                   WHEN bh.entity_type = 'client' THEN c.company_name
              END AS entity_name
         FROM bind_history bh
         LEFT JOIN suppliers s ON bh.entity_type = 'supplier' AND bh.entity_id = s.id
         LEFT JOIN clients c ON bh.entity_type = 'client' AND bh.entity_id = c.id
        ${whereClause}
        ORDER BY bh.created_at DESC
        LIMIT $${pLimit} OFFSET $${pOffset}`,
      params
    );
    res.json({ success: true, data: r.rows, count: r.rowCount, total: total.rows[0]?.cnt || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// === NEW: Client bind status — shows which clients have active ESMC sessions
app.get('/api/bind/clients', auth, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        c.id, c.client_code, c.company_name, c.smpp_username,
        c.smpp_ip, c.smpp_port, c.status AS account_status,
        COALESCE(ss.status, 'unbound') AS session_status,
        ss.connected_at, ss.disconnected_at, ss.last_activity, ss.system_id,
        ss.bind_mode, ss.negotiated_version,
        COALESCE(ss.remote_ip, ss.ip_address) AS session_ip,
        ss.port AS session_port, ss.bound_count, ss.smpp_session_id
      FROM clients c
        LEFT JOIN smpp_sessions ss ON ss.entity_type = 'client' AND ss.entity_id = c.id
      ORDER BY c.id`);
    res.json({ success: true, data: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===================== SMS (with DLR + profit check + billing) =====================
app.post('/api/sms/send', auth, async (req, res) => {
  try {
    const { client_id, destination, sender_id, message, route_plan_id } = req.body;
    // 1. Auth
    const client = await pool.query('SELECT * FROM clients WHERE id=$1 AND status=$2', [client_id, 'active']);
    if (!client.rows.length) return res.status(400).json({ error: 'Client not found' });
    const c = client.rows[0];
    // 2. Route plan required
    if (!route_plan_id && !c.routing_plan_id) return res.status(400).json({ error: 'Route plan is mandatory' });
    // 3. Resolve MCC/MNC/country best-effort from the destination phone.
    //    Best effort: take the first 3 digits of the digits-only destination
    //    as MCC candidate. If mccmnc table has it, fill country/operator.
    const digitsOnly = String(destination || '').replace(/[^0-9]/g, '');
    const mccGuess = digitsOnly.length >= 3 ? digitsOnly.substring(0, 3) : null;
    let mcc = null, mnc = null, country = null, operator = null;
    if (mccGuess) {
      let match = await pool.query(
        "SELECT mcc, mnc, country, operator FROM mccmnc WHERE mcc = $1 ORDER BY mnc LIMIT 1",
        [mccGuess]
      );
      // Fallback: try country-calling-code → MCC lookup (same as resolveRouteForClient)
      if (!match.rows.length) {
        for (let codeLen = 3; codeLen >= 1; codeLen--) {
          const cc = mccGuess.substring(0, codeLen);
          match = await pool.query(
            `SELECT mcc, mnc, country, operator FROM mccmnc m1 WHERE calling_code = $1
             ORDER BY (SELECT COUNT(*) FROM mccmnc m2 WHERE m2.mcc = m1.mcc) DESC, mcc, mnc
             LIMIT 1`,
            [cc]
          );
          if (match.rows.length) break;
        }
      }
      if (match.rows.length) {
        mcc = match.rows[0].mcc;
        mnc = match.rows[0].mnc;
        country = match.rows[0].country;
        operator = match.rows[0].operator;
      }
    }
    // 4. Use shared route resolver: route_maps → routes → trunks → supplier
    const route = await pool.resolveRouteForClient(client_id, destination);
    let supplier = null, routeId = null, routeName = null, supplierConnType = null, trunkId = null, trunkName = null;
    if (route) {
      supplier = { id: route.supplier_id, code: route.supplier_code };
      supplierConnType = route.connection_type;
      routeId = route.route_id;
      routeName = route.route_name;
      trunkId = route.trunk_id;
      trunkName = route.trunk_name;
      // Override MCC/MNC/operator with what the route resolver matched
      // (iterate-all-MNCs logic provides better MNC resolution than ORDER BY mnc LIMIT 1)
      if (route.mcc) {
        mcc = route.mcc;
        if (route.mnc) {
          mnc = route.mnc;
          operator = route.operator;
        } else {
          // No specific MNC matched (wildcard-only) — show country-level
          mnc = null;
          operator = null;
        }
      }
    }
    // 4.5. APPLY TRANSLATIONS: first client-level, then supplier-level.
    //      Translations can modify sender_id, destination, and message content
    //      (strip digits, add prefix, OTP extraction, regex replacements).
    //      Applied BEFORE rate lookup and submission to the supplier.
    //      Capture original values for before/after tracking in SMS logs.
    const originalSender = sender_id || '';
    const originalDest = destination || '';
    const originalMsg = message || '';
    let translatedSender = originalSender;
    let translatedDest = originalDest;
    let translatedMessage = originalMsg;
    const appliedTransDescriptions = [];
    try {
      const ALL_TYPES = ['sender_id','destination','content','origination','destination_strip','destination_prefix','content_otp_extract'];
      // Build entity filter for client + supplier scope
      const entityWhere = [];
      const entityParams = [];
      let pi = 1;
      entityWhere.push(`(client_id IS NULL OR client_id = $${pi++})`); entityParams.push(client_id || null);
      entityWhere.push(`(supplier_id IS NULL OR supplier_id = $${pi++})`); entityParams.push(supplier?.id || null);
      entityWhere.push(`(route_id IS NULL OR route_id = $${pi++})`);   entityParams.push(routeId || null);
      const rulesR = await pool.query(
        `SELECT * FROM translations
           WHERE translation_type = ANY($1) AND (${entityWhere.join(' AND ')}) AND is_active = true
           ORDER BY id ASC`,
        [ALL_TYPES, ...entityParams]
      );
      for (const r of rulesR.rows) {
        try {
          if (r.translation_type === 'destination_strip') {
            const stripCount = parseInt(r.source_pattern, 10);
            // Guard: skip if stripCount >= destination.length (would produce empty)
            if (stripCount > 0 && stripCount < translatedDest.length) {
              appliedTransDescriptions.push(`strip ${stripCount} digits from destination (→ ${translatedDest.substring(stripCount)})`);
              translatedDest = translatedDest.substring(stripCount);
            }
            continue;
          }
          if (r.translation_type === 'destination_prefix') {
            const prefix = r.source_pattern || '';
            if (prefix && !translatedDest.startsWith(prefix)) {
              appliedTransDescriptions.push(`add prefix "${prefix}" to destination (→ ${prefix}${translatedDest})`);
              translatedDest = prefix + translatedDest;
            }
            continue;
          }
          if (r.translation_type === 'content_otp_extract') {
            const re = new RegExp(r.source_pattern, 'i');
            const match = translatedMessage.match(re);
            if (match) {
              const otpValue = match[0];
              const template = r.target_value || '{otp}';
              translatedMessage = template.replace(/\{otp\}/gi, otpValue);
              appliedTransDescriptions.push(`extract OTP "${otpValue}" from content, apply template "${template}" (→ "${translatedMessage}")`);
            }
            continue;
          }
          // Regex-based types
          const re = new RegExp(r.source_pattern);
          if (r.translation_type === 'sender_id' && re.test(translatedSender)) {
            const before = translatedSender;
            translatedSender = translatedSender.replace(re, r.target_value);
            appliedTransDescriptions.push(`sender_id regex "${r.source_pattern}" → "${r.target_value}" ("${before}" → "${translatedSender}")`);
          }
          if (r.translation_type === 'destination' && re.test(translatedDest)) {
            const before = translatedDest;
            translatedDest = translatedDest.replace(re, r.target_value);
            appliedTransDescriptions.push(`destination regex "${r.source_pattern}" → "${r.target_value}" ("${before}" → "${translatedDest}")`);
          }
          if ((r.translation_type === 'content' || r.translation_type === 'origination') && re.test(translatedMessage)) {
            const before = translatedMessage;
            translatedMessage = translatedMessage.replace(re, r.target_value);
            appliedTransDescriptions.push(`content regex "${r.source_pattern}" → "${r.target_value}"`);
          }
        } catch (e) { /* skip bad regex */ }
      }
    } catch (te) {
      console.warn('[translations] apply failed (non-fatal):', te.message);
    }
    // Determine what changed vs original; only store tracking data when there are changes.
    const trackingSender = (translatedSender !== originalSender) ? originalSender : null;
    const trackingDest = (translatedDest !== originalDest) ? originalDest : null;
    const trackingMsg = (translatedMessage !== originalMsg) ? originalMsg : null;
    const trackingApplied = appliedTransDescriptions.length > 0 ? JSON.stringify(appliedTransDescriptions) : null;

    // 5. Find rate (client sell rate) from the client's rate plan,
    //    supplier buy rate from the supplier's rate plan.
    //    Rates are now owned by rate_plans; clients/suppliers inherit via rate_plan_id.
    let clientRate = 0.025, supplierRate = 0.015;
    if (supplier) {      const cr = await pool.query(
        `SELECT r.rate FROM rates r
          JOIN clients c ON c.rate_plan_id::text = r.entity_id AND r.entity_type = 'rate_plan'
         WHERE c.id = $1 AND r.is_active = true AND ($2::text IS NULL OR r.mcc = $2)
         ORDER BY r.rate ASC LIMIT 1`,
        [client_id, mcc]
      );
      if (cr.rows.length) clientRate = parseFloat(cr.rows[0].rate);
      const sr = await pool.query(
        `SELECT r.rate FROM rates r
          JOIN suppliers s ON s.rate_plan_id::text = r.entity_id AND r.entity_type = 'rate_plan'
         WHERE s.id = $1 AND r.is_active = true AND ($2::text IS NULL OR r.mcc = $2)
         ORDER BY r.rate ASC LIMIT 1`,
        [supplier.id, mcc]
      );
      if (sr.rows.length) supplierRate = parseFloat(sr.rows[0].rate);
    }
    // 6. PROFIT CHECK: selling - buying = profit. If profit ≤ 0 → BLOCK
    const parts = Math.ceil((translatedMessage || '').length / 160);
    const profit = clientRate - supplierRate;
    if (profit <= 0) return res.status(400).json({ error: `ROUTE BLOCKED: No profit. Client rate €${clientRate.toFixed(4)} ≤ Supplier rate €${supplierRate.toFixed(4)}` });
    // 7. Balance check
    const available = parseFloat(c.balance) + parseFloat(c.credit_limit);
    const cost = clientRate * parts;
    if (available < cost) return res.status(402).json({ error: `Insufficient balance. Available: €${available.toFixed(2)}, Need: €${cost.toFixed(4)}` });
    // 7.5. CHANNEL pre-validate: determine the route channel from the supplier's
    //    connection_type. SMS channels pass through; OTT channels (whatsapp/telegram)
    //    validate destination reachability via number-validation-providers.
    try {
      const allowed = c.allowed_channels || ['sms'];
      let routeChannel = 'sms';
      if (supplierConnType) {
        const map = { smpp:'sms', http:'sms', ott_whatsapp:'whatsapp', ott_telegram:'telegram', rcs:'rcs', flash_sms:'flash_sms', voice_otp:'voice_otp', local_bypass:'sms' };
        routeChannel = map[supplierConnType] || 'sms';
      }
      if (routeChannel !== 'sms' && allowed.includes(routeChannel) && numValid) {
        const v = await numValid.lookupChannel(routeChannel, destination);
        if (!v || !v.valid) {
          const msgId = 'MSG' + Date.now() + 'R';
          await pool.query(
            `INSERT INTO sms_logs (message_id, client_id, client_code, sender_id, destination, message, status, dlr_status, channel, route_name, submit_time, delivery_time)
             VALUES ($1, $2, $3, $4, $5, $6, 'rejected_no_channel', 'REJECTED', $7, $8, NOW(), NOW())`,
            [msgId, client_id, c.client_code, translatedSender, translatedDest, translatedMessage, routeChannel, routeName]
          );
          return res.status(422).json({ success: false, error: `rejected_no_channel: destination not reachable via ${routeChannel}`, message_id: msgId, channel_check: v });
        }
      }
    } catch (ve) {
      console.warn('[channel-validation] soft-fail:', ve.message);
      // soft-fail — we don't block legitimate SMS if the validator hiccups.
    }

    // 8. Insert SMS log with trunk info (use TRANSLATED values for destination/message)
    const msgId = 'MSG' + Date.now();
    const ir = await pool.query(
      `INSERT INTO sms_logs
        (message_id, client_id, client_code, supplier_id, supplier_code,
         sender_id, destination, mcc, mnc, country, operator,
         message, message_parts,
         original_sender_id, original_destination, original_message, applied_translations,
         client_rate, supplier_rate, profit, currency,
         status, submit_time,
         route_id, route_name, trunk_id, trunk_name)
       VALUES
        ($1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10, $11,
         $12, $13,
         $14, $15, $16, $17,
         $18, $19, $20, $21,
         'submitted', NOW(),
         $22, $23, $24, $25)
       RETURNING *`,
      [msgId,
       client_id, c.client_code,
       supplier?.id || null, supplier?.code || null,
       translatedSender, translatedDest,
       mcc, mnc, country, operator,
       translatedMessage, parts,
       trackingSender, trackingDest, trackingMsg, trackingApplied,
       clientRate, supplierRate, profit,
       c.currency || 'EUR',
       routeId, routeName, trunkId, trunkName]
    );
    // 8. Billing: On Submit → charge immediately
    if (c.billing_mode === 'submit') {
      await pool.query('UPDATE clients SET balance = balance - $1 WHERE id = $2', [cost, client_id]);
    }
    // 9. Dispatch through the appropriate channel.
    if (supplier) {
      const ct = supplierConnType;
      if (ct === 'ott_whatsapp') {
        // ── WhatsApp Cloud API dispatch ──────────────────────────────
        const sas = await pool.query(
          "SELECT * FROM social_api_suppliers WHERE platform = 'whatsapp_cloud' AND is_active = true ORDER BY created_at DESC LIMIT 1"
        );
        const wa = sas.rows[0];
        if (wa && wa.phone_number_id && wa.access_token) {
          const waApiUrl = `https://graph.facebook.com/v21.0/${wa.phone_number_id}/messages`;
          const waHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${wa.access_token}` };
          const waPayload = { messaging_product: 'whatsapp', to: String(translatedDest).replace(/[^0-9]/g, ''), type: 'text', text: { body: String(translatedMessage) } };
          let waAgent = undefined;
          if (wa.proxy_enabled && wa.proxy_host) {
            try {
              const { SocksProxyAgent } = require('socks-proxy-agent');
              const auth2 = wa.proxy_username ? `${encodeURIComponent(wa.proxy_username)}:${encodeURIComponent(wa.proxy_password || '')}@` : '';
              waAgent = new SocksProxyAgent(`socks5://${auth2}${wa.proxy_host}:${wa.proxy_port}`);
            } catch (_) {}
          }
          try {
            const waOpts = { method: 'POST', headers: waHeaders, body: JSON.stringify(waPayload), signal: AbortSignal.timeout(15000) };
            if (waAgent) waOpts.agent = waAgent;
            const waResp = await fetch(waApiUrl, waOpts);
            const waBody = await waResp.json();
            const waMsgId = waBody?.messages?.[0]?.id || null;
            if (waResp.ok && waMsgId) {
              pool.query('UPDATE sms_logs SET smpp_message_id = $1, channel = $2 WHERE message_id = $3', [waMsgId, 'whatsapp', msgId]).catch(() => {});
              console.log(`[route] WhatsApp dispatched: ${msgId} -> wa:${waMsgId}`);
            } else {
              const waErr = waBody?.error?.message || `HTTP ${waResp.status}`;
              pool.query("UPDATE sms_logs SET status = 'failed', dlr_status = 'UNDELIV', error_message = $1, delivery_time = NOW() WHERE message_id = $2", [waErr.substring(0, 500), msgId]).catch(() => {});
              console.warn(`[route] WhatsApp failed for ${msgId}: ${waErr}`);
            }
          } catch (waFetchErr) {
            pool.query("UPDATE sms_logs SET status = 'failed', dlr_status = 'UNDELIV', error_message = $1, delivery_time = NOW() WHERE message_id = $2", [waFetchErr.message?.substring(0, 500) || 'WhatsApp API unreachable', msgId]).catch(() => {});
            console.warn(`[route] WhatsApp fetch error for ${msgId}:`, waFetchErr.message);
          }
        } else {
          // No WhatsApp API config — mark as unrouted
          setTimeout(async () => {
            await pool.query("UPDATE sms_logs SET status = 'failed', dlr_status = 'UNDELIV', error_message = 'No WhatsApp Cloud API configuration', dlr_timestamp = NOW() WHERE message_id = $1", [msgId]);
          }, 1000);
        }
      } else if (ct === 'ott_telegram') {
        // ── Telegram Bot API dispatch ────────────────────────────────
        const tgs = await pool.query(
          "SELECT * FROM social_api_suppliers WHERE platform = 'telegram_bot' AND is_active = true ORDER BY created_at DESC LIMIT 1"
        );
        const tg = tgs.rows[0];
        if (tg && tg.bot_token) {
          const tgApiUrl = `https://api.telegram.org/bot${tg.bot_token}/sendMessage`;
          const tgHeaders = { 'Content-Type': 'application/json' };
          const tgPayload = { chat_id: String(translatedDest), text: String(translatedMessage), parse_mode: 'HTML', disable_web_page_preview: true };
          let tgAgent = undefined;
          if (tg.proxy_enabled && tg.proxy_host) {
            try {
              const { SocksProxyAgent } = require('socks-proxy-agent');
              const auth3 = tg.proxy_username ? `${encodeURIComponent(tg.proxy_username)}:${encodeURIComponent(tg.proxy_password || '')}@` : '';
              tgAgent = new SocksProxyAgent(`socks5://${auth3}${tg.proxy_host}:${tg.proxy_port}`);
            } catch (_) {}
          }
          try {
            const tgOpts = { method: 'POST', headers: tgHeaders, body: JSON.stringify(tgPayload), signal: AbortSignal.timeout(15000) };
            if (tgAgent) tgOpts.agent = tgAgent;
            const tgResp = await fetch(tgApiUrl, tgOpts);
            const tgBody = await tgResp.json();
            const tgMsgId = tgBody?.result?.message_id || null;
            if (tgResp.ok && tgBody.ok && tgMsgId) {
              pool.query('UPDATE sms_logs SET smpp_message_id = $1, channel = $2 WHERE message_id = $3', [String(tgMsgId), 'telegram', msgId]).catch(() => {});
              console.log(`[route] Telegram dispatched: ${msgId} -> tg:${tgMsgId}`);
            } else {
              const tgErr = tgBody?.description || `HTTP ${tgResp.status}`;
              pool.query("UPDATE sms_logs SET status = 'failed', dlr_status = 'UNDELIV', error_message = $1, delivery_time = NOW() WHERE message_id = $2", [tgErr.substring(0, 500), msgId]).catch(() => {});
              console.warn(`[route] Telegram failed for ${msgId}: ${tgErr}`);
            }
          } catch (tgFetchErr) {
            pool.query("UPDATE sms_logs SET status = 'failed', dlr_status = 'UNDELIV', error_message = $1, delivery_time = NOW() WHERE message_id = $2", [tgFetchErr.message?.substring(0, 500) || 'Telegram API unreachable', msgId]).catch(() => {});
            console.warn(`[route] Telegram fetch error for ${msgId}:`, tgFetchErr.message);
          }
        } else {
          setTimeout(async () => {
            await pool.query("UPDATE sms_logs SET status = 'failed', dlr_status = 'UNDELIV', error_message = 'No Telegram Bot API configuration', dlr_timestamp = NOW() WHERE message_id = $1", [msgId]);
          }, 1000);
        }
      } else if (['http', 'rcs', 'flash_sms'].includes(ct)) {
        // ── HTTP / RCS / Flash SMS dispatch via api_connectors ──────
        const supReq = await pool.query('SELECT * FROM suppliers WHERE id = $1', [supplier.id]);
        const supRow = supReq.rows[0];
        if (supRow) {
          let targetUrl, method, headers = { 'Content-Type': 'application/json' }, submitRegex = null;
          let requiredParamsStr = null;
          if (supRow.api_connector_id) {
            const connReq = await pool.query('SELECT * FROM api_connectors WHERE id = $1 AND is_active = true', [supRow.api_connector_id]);
            const conn = connReq.rows[0];
            if (conn) {
              targetUrl = conn.send_url;
              method = conn.http_method || 'POST';
              requiredParamsStr = conn.params || null;
              if (conn.auth_type === 'API_KEY') headers['X-API-Key'] = conn.api_key || '';
              if (conn.auth_type === 'BEARER') headers['Authorization'] = `Bearer ${conn.api_key || ''}`;
              if (conn.submit_pattern) submitRegex = new RegExp(conn.submit_pattern);
            }
          }
          if (!targetUrl) {
            targetUrl = supRow.api_url;
            method = supRow.api_method || 'POST';
            if (supRow.api_key) headers['Authorization'] = `Bearer ${supRow.api_key}`;
          }
          if (targetUrl) {
            try {
              const httpMethod = (method || 'POST').toUpperCase();
              const isGet = httpMethod === 'GET';
              // Build param map from required_parameters list for GET requests.
              // Standard mapping: to/msisdn/recipient → destination, text/code/message → message, from/sender → sender_id
              const paramMap = {
                msisdn: destination, to: destination, recipient: destination,
                code: message, text: message, message: message,
                from: sender_id || 'NET2APP', sender: sender_id || 'NET2APP',
              };
              if (supRow.api_key) paramMap.apiKey = supRow.api_key;
              if (supRow.api_secret) paramMap.apiSecret = supRow.api_secret;

              let fetchUrl = targetUrl;
              let fetchBody = undefined;
              if (isGet) {
                // GET: append query parameters from required_parameters, falling back to standard to/text/from
                const params = new URLSearchParams();
                if (requiredParamsStr) {
                  const paramNames = requiredParamsStr.split(',').map(p => p.trim()).filter(Boolean);
                  for (const p of paramNames) {
                    const val = paramMap[p] || paramMap[p.toLowerCase()] || '';
                    params.append(p, val);
                  }
                } else {
                  // Fallback: use standard params for GET connectors without explicit required_parameters
                  params.append('to', destination);
                  params.append('text', message);
                  params.append('from', sender_id || 'NET2APP');
                }
                const qs = params.toString();
                fetchUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + qs;
                // Remove Content-Type for GET (no body)
                delete headers['Content-Type'];
                console.log(`[route] GET dispatch: ${fetchUrl.substring(0, 120)}...`);
              } else {
                fetchBody = JSON.stringify({ to: translatedDest, from: translatedSender || 'NET2APP', text: translatedMessage });
              }
              const fetchOpts = { method: httpMethod, headers, signal: AbortSignal.timeout(15000) };
              if (fetchBody !== undefined) fetchOpts.body = fetchBody;
              const resp = await fetch(fetchUrl, fetchOpts);
              const respText = await resp.text();
              if (resp.ok) {
                const matched = submitRegex ? submitRegex.exec(respText) : null;
                const extMsgId = matched ? matched[1] : `EXT_${Date.now()}`;
                pool.query('UPDATE sms_logs SET smpp_message_id = $1, channel = $2 WHERE message_id = $3', [extMsgId, ct, msgId]).catch(() => {});
                console.log(`[route] ${ct} dispatched: ${msgId} -> ${extMsgId}`);
              } else {
                pool.query("UPDATE sms_logs SET status = 'failed', dlr_status = 'UNDELIV', error_message = $1, delivery_time = NOW() WHERE message_id = $2", [respText.substring(0, 500), msgId]).catch(() => {});
                console.warn(`[route] ${ct} dispatch failed for ${msgId}: HTTP ${resp.status}`);
              }
            } catch (err) {
              pool.query("UPDATE sms_logs SET status = 'failed', dlr_status = 'UNDELIV', error_message = $1, delivery_time = NOW() WHERE message_id = $2", [err.message?.substring(0, 500) || 'API unreachable', msgId]).catch(() => {});
              console.warn(`[route] ${ct} fetch error for ${msgId}:`, err.message);
            }
          } else {
            setTimeout(async () => await pool.query("UPDATE sms_logs SET status = 'failed', dlr_status = 'UNDELIV', error_message = 'No API Connector Configured', dlr_timestamp = NOW() WHERE message_id = $1", [msgId]), 1000);
          }
        } else {
          setTimeout(async () => await pool.query("UPDATE sms_logs SET status = 'failed', dlr_status = 'UNDELIV', error_message = 'Supplier record not found', dlr_timestamp = NOW() WHERE message_id = $1", [msgId]), 1000);
        }
      } else if (ct === 'voice_otp') {
        // ── Voice OTP dispatch ─────────────────────────────────────
        // 1. Look up the supplier's voice_otp_config_id and fetch config.
        const vSupReq = await pool.query('SELECT voice_otp_config_id FROM suppliers WHERE id = $1', [supplier.id]);
        const vConfigId = vSupReq.rows[0]?.voice_otp_config_id;
        if (vConfigId) {
          const vCfg = await pool.query('SELECT * FROM voice_otp_configs WHERE id = $1 AND is_active = true', [vConfigId]);
          const cfg = vCfg.rows[0];
          if (cfg) {
            // 2. Detect country prefix from destination.
            const destDigits = String(translatedDest || '').replace(/[^0-9]/g, '');
            let matchedPrefix = null;
            if (cfg.country_prefix) {
              const prefixes = cfg.country_prefix.split(',').map(p => p.trim()).filter(Boolean);
              for (const pfx of prefixes) {
                if (destDigits.startsWith(pfx)) { matchedPrefix = pfx; break; }
              }
            }
            // 3. Build OTP language string (primary + secondary, as user requested).
            const otpCode = String(translatedMessage || '').replace(/[^0-9]/g, ''); // OTP is the message body
            const primaryLang = cfg.primary_language_code || cfg.language_code || 'en';
            const secondaryLang = cfg.secondary_language_code || null;
            const languageLabel = primaryLang;
            // 4. Generate unique call_id.
            const callId = 'VOC' + Date.now() + Math.random().toString(36).substring(2, 6).toUpperCase();
            // 5. Enqueue into voice_call_retry_queue (status='pending', max_retries=2, next_attempt_at=NOW()).
            await pool.query(
              `INSERT INTO voice_call_retry_queue (call_id, destination, otp_code, language, retry_count, max_retries, next_attempt_at, status, client_id)
               VALUES ($1, $2, $3, $4, 0, 2, NOW(), 'pending', $5)`,
              [callId, destination, otpCode, languageLabel, client_id]
            );
            // 6. Insert into voice_otp_logs.
            await pool.query(
              `INSERT INTO voice_otp_logs (call_id, destination, otp_code, language, retry_count, max_retries, status, dlr_status, client_id)
               VALUES ($1, $2, $3, $4, 0, 2, 'initiated', 'PENDING', $5)`,
              [callId, destination, otpCode, languageLabel, client_id]
            );
            // 7. Update sms_logs with channel, call_id, and config info.
            await pool.query(
              `UPDATE sms_logs SET channel = 'voice_otp', smpp_message_id = $1, sender_id = COALESCE($2, sender_id)
               WHERE message_id = $3`,
              [callId, cfg.caller_id || 'voice_otp', msgId]
            );
            console.log(`[route] voice_otp enqueued: ${msgId} -> call ${callId} lang=${languageLabel} prefix=${matchedPrefix || 'auto'} otp_len=${otpCode.length} primary=${primaryLang} secondary=${secondaryLang}`);
          } else {
            await pool.query("UPDATE sms_logs SET channel = 'voice_otp', status = 'failed', dlr_status = 'UNDELIV', error_message = 'Voice OTP config not found or inactive', dlr_timestamp = NOW() WHERE message_id = $1", [msgId]);
            console.warn(`[route] voice_otp config not found for supplier ${supplier.id}`);
          }
        } else {
          await pool.query("UPDATE sms_logs SET channel = 'voice_otp', status = 'failed', dlr_status = 'UNDELIV', error_message = 'No voice_otp_config_id on supplier', dlr_timestamp = NOW() WHERE message_id = $1", [msgId]);
          console.warn(`[route] voice_otp dispatch: supplier ${supplier.id} has no voice_otp_config_id`);
        }
      } else {
        // ── Default: SMPP gateway dispatch ──────────────────────────
        bridge.submitSm({
          supplier_id: supplier.id,
          supplier_code: supplier.code,
          client_id: client_id,
          client_code: c.client_code,
          sender_id: sender_id || '',
          destination: destination,
          message: message,
          message_id: msgId
        }).then(gwRes => {
          if (gwRes && gwRes.smpp_message_id) {
            pool.query('UPDATE sms_logs SET smpp_message_id = $1 WHERE message_id = $2',
              [gwRes.smpp_message_id, msgId]).catch(() => {});
          }
        }).catch(err => console.warn('[gateway] submitSm error:', err.message));
      }
    } else {
      // No supplier routed — mark as failed immediately (no gateway to send through)
      setTimeout(async () => {
        await pool.query(`UPDATE sms_logs SET status='failed', dlr_status='UNDELIV', dlr_timestamp=NOW() WHERE message_id=$1`, [msgId]);
      }, 1000);
    }
    res.json({ success: true, data: { ...ir.rows[0], profit, billing_mode: c.billing_mode } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sms/logs', auth, async (req, res) => {
  try {
    const { client_id, status, limit, offset } = req.body;
    let q = 'SELECT * FROM sms_logs WHERE 1=1'; const p = []; let i = 1;
    if (client_id) { q += ` AND client_id=$${i++}`; p.push(client_id); }
    if (status) { q += ` AND status=$${i++}`; p.push(status); }
    q += ' ORDER BY submit_time DESC';
    q += ` LIMIT $${i++} OFFSET $${i++}`; p.push(limit||100, offset||0);
    const r = await pool.query(q, p);
    res.json({ success: true, data: r.rows });
  } catch (e) {
    console.error('[sms/logs] query failed:', e.message);
    res.status(500).json({ error: 'Failed to fetch SMS logs' });
  }
});
// ===================== SMS DLR LOOKUP (polled by test SMS frontend) =====================
// Returns the current sms_logs row for a message_id so the TestSMS page
// can poll for DLR updates without waiting for the full 30s timeout.
app.get('/api/sms/dlr/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM sms_logs WHERE message_id = $1 LIMIT 1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, data: r.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===================== SMS TEST (full pipeline, no external DLR push) =====================
// Runs the complete SMS send pipeline (auth, route, translation, rates, dispatch)
// but marks messages with source='test_sms' so DLR results update sms_logs
// WITHOUT pushing to external client webhooks/SMPP sessions.
app.post('/api/sms/test', auth, async (req, res) => {
  try {
    const { client_id, destination, sender_id, message } = req.body;
    if (!client_id || !destination || !message) {
      return res.status(400).json({ error: 'client_id, destination, and message required' });
    }

    // 1. Auth — look up client
    const cR = await pool.query("SELECT * FROM clients WHERE id=$1 AND status='active'", [client_id]);
    if (!cR.rows.length) return res.status(404).json({ error: 'Client not found or inactive' });
    const c = cR.rows[0];

    // 2. Blocking checks
    const blockCheck = await pool.checkBlockingRules(destination, message, client_id, null);
    if (blockCheck.blocked) {
      return res.status(400).json({ error: blockCheck.reason, blocked: true });
    }

    // 3. MCC/MNC resolution — with calling_code fallback (e.g. 880 → MCC 470)
    const digitsOnly = String(destination || '').replace(/[^0-9]/g, '');
    let mcc = null, mnc = null, country = null, operator = null;
    const mccGuess = digitsOnly.length >= 3 ? digitsOnly.substring(0, 3) : null;
    if (mccGuess) {
      let match = await pool.query(
        "SELECT mcc, mnc, country, operator FROM mccmnc WHERE mcc = $1 ORDER BY mnc LIMIT 1",
        [mccGuess]
      );
      // Fallback: first 3 digits may be a calling code (e.g. 880 for BD), not an MCC
      if (!match.rows.length) {
        for (let codeLen = 3; codeLen >= 1; codeLen--) {
          const cc = mccGuess.substring(0, codeLen);
          match = await pool.query(
            `SELECT mcc, mnc, country, operator FROM mccmnc m1 WHERE calling_code = $1
             ORDER BY (SELECT COUNT(*) FROM mccmnc m2 WHERE m2.mcc = m1.mcc) DESC, mcc, mnc`,
            [cc]
          );
          if (match.rows.length) break;
        }
      }
      if (match.rows.length) {
        mcc = match.rows[0].mcc; mnc = match.rows[0].mnc;
        country = match.rows[0].country; operator = match.rows[0].operator;
      }
    }

    // 4. Route resolution
    const route = await pool.resolveRouteForClient(client_id, destination);
    let supplier = null, routeId = null, routeName = null,
        supplierConnType = null, trunkId = null, trunkName = null;
    if (route) {
      supplier = { id: route.supplier_id, code: route.supplier_code };
      supplierConnType = route.connection_type;
      routeId = route.route_id;
      routeName = route.route_name;
      trunkId = route.trunk_id;
      trunkName = route.trunk_name;
      if (route.mcc) mcc = route.mcc;
      if (route.mnc) mnc = route.mnc;
      if (route.operator) operator = route.operator;
    }

    // 5. Rate lookup — rates belong to rate_plans; clients/suppliers inherit via rate_plan_id
    let clientRate = 0.025, supplierRate = 0.015;
    if (supplier) {
      const cr = await pool.query(
        `SELECT r.rate FROM rates r
          JOIN clients c ON c.rate_plan_id::text = r.entity_id AND r.entity_type = 'rate_plan'
         WHERE c.id = $1 AND r.is_active = true AND ($2::text IS NULL OR r.mcc = $2)
         ORDER BY r.rate ASC LIMIT 1`,
        [client_id, mcc]
      );
      if (cr.rows.length) clientRate = parseFloat(cr.rows[0].rate);
      const sr = await pool.query(
        `SELECT r.rate FROM rates r
          JOIN suppliers s ON s.rate_plan_id::text = r.entity_id AND r.entity_type = 'rate_plan'
         WHERE s.id = $1 AND r.is_active = true AND ($2::text IS NULL OR r.mcc = $2)
         ORDER BY r.rate ASC LIMIT 1`,
        [supplier.id, mcc]
      );
      if (sr.rows.length) supplierRate = parseFloat(sr.rows[0].rate);
    }

    // 6. Profit check
    const parts = Math.ceil((message || '').length / 160) || 1;
    const profit = clientRate - supplierRate;
    if (profit <= 0) {
      return res.status(400).json({ error: `No profit. Client €${clientRate.toFixed(4)} ≤ Supplier €${supplierRate.toFixed(4)}` });
    }

    // 7. Insert SMS log with test flag
    const msgId = 'TEST' + Date.now();
    const ir = await pool.query(
      `INSERT INTO sms_logs
        (message_id, client_id, client_code, supplier_id, supplier_code,
         sender_id, destination, mcc, mnc, country, operator,
         message, message_parts,
         client_rate, supplier_rate, profit, currency,
         status, submit_time, source,
         route_id, route_name, trunk_id, trunk_name)
       VALUES
        ($1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10, $11,
         $12, $13,
         $14, $15, $16, $17,
         'submitted', NOW(), 'test_sms',
         $18, $19, $20, $21)
       RETURNING *`,
      [msgId,
       client_id, c.client_code,
       supplier?.id || null, supplier?.code || null,
       sender_id || 'TEST', destination,
       mcc, mnc, country, operator,
       message, parts,
       clientRate, supplierRate, profit,
       c.currency || 'EUR',
       routeId, routeName, trunkId, trunkName]
    );
    const log = ir.rows[0];

    // 8. Dispatch through gateway
    let dispatchResult = null;
    if (supplier && bridge && supplierConnType === 'smpp') {
      try {
        dispatchResult = await Promise.race([
          bridge.submitSm({
            supplier_id: supplier.id,
            supplier_code: supplier.code,
            client_id: client_id,
            client_code: c.client_code,
            sender_id: sender_id || 'TEST',
            destination: destination,
            message: message,
            message_id: msgId,
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('gateway_timeout')), 25000)),
        ]);
        if (dispatchResult && dispatchResult.smpp_message_id) {
          await pool.query(
            'UPDATE sms_logs SET smpp_message_id = $1, status = $2 WHERE message_id = $3',
            [dispatchResult.smpp_message_id, 'sent', msgId]
          ).catch(() => {});
        }
      } catch (dispatchErr) {
        console.warn('[sms/test] dispatch failed:', dispatchErr.message);
        await pool.query(
          "UPDATE sms_logs SET status = 'failed', error_message = $1, dlr_status = 'UNDELIV', dlr_timestamp = NOW(), delivery_time = NOW() WHERE message_id = $2",
          [(dispatchErr.message || 'Dispatch failed').substring(0, 500), msgId]
        ).catch(() => {});
      }
    } else if (supplier && ['voice_otp'].includes(supplierConnType)) {
      // Voice OTP: enqueue call in voice_call_retry_queue (same as real handler)
      try {
        const sup = await pool.query("SELECT voice_otp_config_id FROM suppliers WHERE id = $1", [supplier.id]);
        const cfgId = sup.rows[0]?.voice_otp_config_id;
        if (cfgId) {
          const vCfg = await pool.query(
            "SELECT * FROM voice_otp_configs WHERE id = $1 AND is_active = true LIMIT 1",
            [cfgId]
          );
          if (vCfg.rows.length) {
            const cfg = vCfg.rows[0];
            const callId = 'CALL-TEST-' + Date.now();
            // Match real handler schema: otp_code (not message), next_attempt_at=NOW(), client_id
            await pool.query(
              `INSERT INTO voice_call_retry_queue (call_id, destination, otp_code, language, retry_count, max_retries, next_attempt_at, status, client_id)
               VALUES ($1, $2, $3, $4, 0, $5, NOW(), 'pending', $6)`,
              [callId, destination, message, cfg.primary_language_code || cfg.language_code || 'en', cfg.retry_count || 3, client_id]
            );
            await pool.query(
              `INSERT INTO voice_otp_logs (call_id, destination, otp_code, language, retry_count, max_retries, status, dlr_status, client_id)
               VALUES ($1, $2, $3, $4, 0, $5, 'initiated', 'PENDING', $6)`,
              [callId, destination, message, cfg.primary_language_code || cfg.language_code || 'en', cfg.retry_count || 3, client_id]
            );
            await pool.query(
              "UPDATE sms_logs SET status='sent', smpp_message_id=$1, channel='voice_otp' WHERE message_id=$2",
              [callId, msgId]
            );
          } else {
            await pool.query(
              "UPDATE sms_logs SET status='failed', error_message='Voice OTP config found but not active', dlr_status='UNDELIV', dlr_timestamp=NOW() WHERE message_id=$1",
              [msgId]
            ).catch(() => {});
          }
        } else {
          await pool.query(
            "UPDATE sms_logs SET status='failed', error_message='Supplier has no Voice OTP config assigned', dlr_status='UNDELIV', dlr_timestamp=NOW() WHERE message_id=$1",
            [msgId]
          ).catch(() => {});
        }
      } catch (voiceErr) {
        console.warn('[sms/test] voice_otp dispatch failed:', voiceErr.message);
        await pool.query(
          "UPDATE sms_logs SET status='failed', error_message=$1, dlr_status='UNDELIV', dlr_timestamp=NOW(), delivery_time=NOW() WHERE message_id=$2",
          [('Voice OTP: ' + (voiceErr.message || 'dispatch failed')).substring(0, 500), msgId]
        ).catch(() => {});
      }
    } else if (supplier && ['http','rcs','flash_sms'].includes(supplierConnType)) {
      // HTTP/API channels: simple fetch test to supplier's API URL
      try {
        const supRow = await pool.query('SELECT api_url, api_key, api_method FROM suppliers WHERE id=$1', [supplier.id]);
        const apiUrl = supRow.rows[0]?.api_url || '';
        if (apiUrl) {
          const method = (supRow.rows[0]?.api_method || 'POST').toUpperCase();
          const headers = { 'Content-Type': 'application/json' };
          if (supRow.rows[0]?.api_key) headers['Authorization'] = 'Bearer ' + supRow.rows[0].api_key;
          const body = method === 'GET' ? undefined : JSON.stringify({ to: destination, from: sender_id || 'TEST', text: message });
          const fetchUrl = method === 'GET' ? `${apiUrl}?${new URLSearchParams({to:destination,from:sender_id||'TEST',text:message}).toString()}` : apiUrl;
          const resp = await fetch(fetchUrl, { method, headers, body, signal: AbortSignal.timeout(15000) });
          if (resp.ok) {
            await pool.query(
              "UPDATE sms_logs SET status='sent', smpp_message_id=$1 WHERE message_id=$2",
              ['HTTP-TEST-' + Date.now(), msgId]
            ).catch(() => {});
          } else {
            throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
          }
        } else {
          await pool.query(
            "UPDATE sms_logs SET status='sent', smpp_message_id=$1 WHERE message_id=$2",
            ['CHANNEL-TEST-' + Date.now(), msgId]
          ).catch(() => {});
        }
      } catch (httpErr) {
        console.warn('[sms/test] http dispatch failed:', httpErr.message);
        await pool.query(
          "UPDATE sms_logs SET status='failed', error_message=$1, dlr_status='UNDELIV', dlr_timestamp=NOW(), delivery_time=NOW() WHERE message_id=$2",
          [('HTTP: ' + (httpErr.message || 'dispatch failed')).substring(0, 500), msgId]
        ).catch(() => {});
      }
    } else if (supplier) {
      // Other channels (whatsapp, telegram, etc.): not directly testable
      await pool.query(
        "UPDATE sms_logs SET status='submitted', error_message=$1 WHERE message_id=$2",
        [`Channel type '${supplierConnType}' not directly testable via this endpoint`, msgId]
      ).catch(() => {});
    } else if (!supplier) {
      await pool.query(
        "UPDATE sms_logs SET status = 'failed', error_message = 'No route found', dlr_status = 'UNDELIV', dlr_timestamp = NOW() WHERE message_id = $1",
        [msgId]
      ).catch(() => {});
    }

    // 9. Return result
    const finalLog = await pool.query('SELECT * FROM sms_logs WHERE message_id = $1', [msgId]);
    res.json({
      success: true,
      data: finalLog.rows[0] || log,
      dispatched: !!(supplier && bridge),
      route: routeName || 'none',
      supplier: supplier?.code || 'none',
    });
  } catch (e) {
    console.error('[sms/test] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ===================== RATES =====================
// Client/supplier rate endpoints — now resolve through rate_plan_id.
// Rates belong to rate plans; clients/suppliers inherit their plan's rates.
app.get('/api/clients/:id/rates', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT r.* FROM rates r
         JOIN clients c ON c.rate_plan_id::text = r.entity_id AND r.entity_type = 'rate_plan'
       WHERE c.id = $1
       ORDER BY r.country, r.mcc, r.mnc`,
      [req.params.id]
    );
    res.json({ success: true, data: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/suppliers/:id/rates', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT r.* FROM rates r
         JOIN suppliers s ON s.rate_plan_id::text = r.entity_id AND r.entity_type = 'rate_plan'
       WHERE s.id = $1
       ORDER BY r.country, r.mcc, r.mnc`,
      [req.params.id]
    );
    res.json({ success: true, data: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Rate plan rates — direct access to rates owned by a rate plan
app.get('/api/rate-plans/:id/rates', auth, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT * FROM rates WHERE entity_type='rate_plan' AND entity_id=$1 ORDER BY country, mcc, mnc",
      [req.params.id]
    );
    res.json({ success: true, data: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/rates', auth, async (req, res) => {
  const { entity_type, entity_id } = req.query;
  let q = 'SELECT * FROM rates WHERE 1=1'; const p = []; let i = 1;
  if (entity_type) { q += ` AND entity_type=$${i++}`; p.push(entity_type); }
  if (entity_id) { q += ` AND entity_id=$${i++}`; p.push(entity_id); }
  q += ' ORDER BY country, mcc, mnc';
  const r = await pool.query(q, p);
  res.json({ success: true, data: r.rows });
});
app.post('/api/rates', auth, roles('super_admin','admin','billing'), async (req, res) => {
  const { entity_type, entity_id, mcc, mnc, country, operator, rate } = req.body;
  // Deactivate old rate (versioning)
  await pool.query("UPDATE rates SET is_active=false, effective_to=CURRENT_DATE WHERE entity_type=$1 AND entity_id=$2 AND mcc=$3 AND mnc=$4 AND is_active=true", [entity_type, entity_id, mcc, mnc]);
  const r = await pool.query(`INSERT INTO rates (entity_type,entity_id,mcc,mnc,country,operator,rate,effective_from,version) VALUES ($1::varchar,$2::varchar,$3::varchar,$4::varchar,$5,$6,$7,$8, (SELECT COALESCE(MAX(version),0)+1 FROM rates WHERE entity_type=$1::varchar AND entity_id=$2::varchar AND mcc=$3::varchar AND mnc=$4::varchar)) RETURNING *`, [entity_type,entity_id,mcc,mnc,country,operator||'All',rate,req.body.effective_from||new Date().toISOString().split('T')[0]]);
  res.json({ success: true, data: r.rows[0] });
});
app.put('/api/rates/:id', auth, roles('super_admin','admin','billing'), async (req, res) => {
  const id = req.params.id;
  const allowed = ['rate','is_active','effective_from','effective_to','currency',
    'mcc','mnc','country','operator','entity_type','entity_id'];
  const keys = Object.keys(req.body).filter(k => allowed.includes(k) && req.body[k] !== undefined);
  if (!keys.length) return res.status(400).json({ error: 'No valid fields' });
  const sets = keys.map((k, i) => `"${k}"=$${i+1}`).join(',');
  const vals = keys.map(k => req.body[k]);
  await pool.query(`UPDATE rates SET ${sets} WHERE id=$${keys.length+1}`, [...vals, id]);
  res.json({ success: true });
});
app.delete('/api/rates/:id', auth, roles('super_admin','admin','billing'), async (req, res) => {
  await pool.query('DELETE FROM rates WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});
app.post('/api/rates/bulk', auth, roles('super_admin','admin','billing'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of req.body.rates) {
      await client.query("UPDATE rates SET is_active=false, effective_to=CURRENT_DATE WHERE entity_type=$1 AND entity_id=$2 AND mcc=$3 AND mnc=$4 AND is_active=true", [r.entity_type, r.entity_id, r.mcc, r.mnc]);
      await client.query(`INSERT INTO rates (entity_type,entity_id,mcc,mnc,country,operator,rate,effective_from,version) VALUES ($1::varchar,$2::varchar,$3::varchar,$4::varchar,$5,$6,$7,$8, (SELECT COALESCE(MAX(version),0)+1 FROM rates WHERE entity_type=$1::varchar AND entity_id=$2::varchar AND mcc=$3::varchar AND mnc=$4::varchar))`, [r.entity_type, r.entity_id, r.mcc, r.mnc, r.country, r.operator||'All', r.rate, r.effective_from||new Date().toISOString().split('T')[0]]);
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

// ===================== RATE NOTIFICATIONS =====================
// Send email notifications when rates are created or updated.
// Looks up the rate plan, finds assigned clients/suppliers, and emails them.
app.post('/api/rates/notify', auth, roles('super_admin','admin','billing'), async (req, res) => {
  try {
    const { entity_type, entity_id, rate_ids, destination, old_rate, new_rate, change_pct } = req.body || {};
    if (!entity_type || !entity_id) return res.status(400).json({ error: 'entity_type and entity_id required' });
    const entityIdNum = parseInt(entity_id, 10);

    let entities = [];

    if (entity_type === 'rate_plan') {
      // Find all clients and suppliers assigned to this rate plan
      const clients = await pool.query(
        'SELECT id, email, company_name FROM clients WHERE rate_plan_id = $1 AND status = $2',
        [entityIdNum, 'active']
      );
      const suppliers = await pool.query(
        'SELECT id, email, company_name FROM suppliers WHERE rate_plan_id = $1 AND status = $2',
        [entityIdNum, 'active']
      );
      entities = [
        ...clients.rows.map((r) => ({ id: r.id, email: r.email, company_name: r.company_name, type: 'client' })),
        ...suppliers.rows.map((r) => ({ id: r.id, email: r.email, company_name: r.company_name, type: 'supplier' })),
      ];
    } else if (entity_type === 'client') {
      const r = await pool.query('SELECT id, email, company_name FROM clients WHERE id = $1', [entityIdNum]);
      entities = r.rows.map((row) => ({ id: row.id, email: row.email, company_name: row.company_name, type: 'client' }));
    } else if (entity_type === 'supplier') {
      const r = await pool.query('SELECT id, email, company_name FROM suppliers WHERE id = $1', [entityIdNum]);
      entities = r.rows.map((row) => ({ id: row.id, email: row.email, company_name: row.company_name, type: 'supplier' }));
    }

    if (entities.length === 0) {
      return res.json({ success: true, message: 'No entities to notify', sent: 0 });
    }

    const results = [];
    const destLabel = destination || 'Rate Plan';
    const effectiveDate = new Date().toISOString().split('T')[0];
    const pctLabel = change_pct === 'New' ? 'New destination' : (change_pct || (old_rate > 0 ? `${((new_rate - old_rate) / old_rate * 100).toFixed(1)}%` : 'New'));

    for (const ent of entities) {
      if (!ent.email) {
        results.push({ email: '(no email)', sent: false, error: 'No email configured' });
        continue;
      }
      try {
        const r = await emailService.sendRateChangeEmail({
          entity_type: ent.type || 'client',
          entity_id: ent.id,
          destination: destLabel,
          old_rate: old_rate ?? 0,
          new_rate: new_rate ?? 0,
          effective_date: effectiveDate,
          change_pct: pctLabel,
        });
        results.push({ email: ent.email, sent: r.success, error: r.success ? undefined : r.message });
      } catch (e) {
        results.push({ email: ent.email, sent: false, error: e.message });
      }
    }

    const sentCount = results.filter(r => r.sent).length;
    res.json({ success: sentCount > 0, message: `${sentCount}/${results.length} emails sent`, sent: sentCount, total: results.length, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===================== INVOICES =====================
app.get('/api/billing/invoices', auth, async (req, res) => {
  const r = await pool.query('SELECT * FROM invoices ORDER BY created_at DESC LIMIT 50');
  res.json({ success: true, data: r.rows });
});
app.post('/api/billing/invoices', auth, roles('super_admin','admin','billing'), async (req, res) => {
  const { entity_type, entity_id, period_start, period_end } = req.body;
  // Sum SMS for period - DELIVERED only for DLR billing, all SUBMITTED for submit billing
  const smsR = await pool.query(`SELECT COUNT(*) as total_sms, COALESCE(SUM(client_rate*message_parts),0) as total_amount FROM sms_logs WHERE client_id=$1 AND submit_time::date BETWEEN $2 AND $3 AND status='delivered'`, [entity_id, period_start, period_end]);
  const { total_sms, total_amount } = smsR.rows[0];
  const tax = parseFloat(total_amount) * 0.19;
  const grand = parseFloat(total_amount) + tax;
  const entity = await pool.query(entity_type==='client'?'SELECT company_name FROM clients WHERE id=$1':'SELECT company_name FROM suppliers WHERE id=$1', [entity_id]);
  const r = await pool.query(`INSERT INTO invoices (entity_type,entity_id,entity_name,period_start,period_end,total_sms,total_amount,tax_amount,grand_total,due_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [entity_type, entity_id, entity.rows[0]?.company_name||'Unknown', period_start, period_end, total_sms, total_amount, tax, grand, new Date(Date.now()+30*86400000).toISOString().split('T')[0]]);
  res.json({ success: true, data: r.rows[0] });
});

// ===================== HTTP API CONNECTORS =====================
// Test HTTP connector connection
app.post('/api/api-connectors/:id/test', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM api_connectors WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Connector not found' });
    const conn = r.rows[0];
    
    // Attempt real HTTP connection test via fetch
    const startTime = Date.now();
    try {
      const testPayload = conn.test_payload || { to: '+1234567890', from: 'TEST', text: 'Connection test' };
      const headers = { 'Content-Type': 'application/json' };
      if (conn.auth_type === 'API_KEY') headers['X-API-Key'] = conn.api_key || '';
      if (conn.auth_type === 'BEARER') headers['Authorization'] = `Bearer ${conn.api_key || ''}`;
      
      const fetchResp = await fetch(conn.send_url, {
        method: conn.http_method || 'POST',
        headers,
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000),
      });
      const respText = await fetchResp.text();
      const latency = Date.now() - startTime;
      const success = fetchResp.ok && (conn.submit_pattern ? new RegExp(conn.submit_pattern).test(respText) : true);
      
      await pool.query(`UPDATE api_connectors SET connection_status=$1, last_tested_at=NOW() WHERE id=$2`,
        [success ? 'connected' : 'failed', conn.id]);
      
      res.json({ success: true, connected: success, latency_ms: latency, response_status: fetchResp.status, response_body: respText.substring(0, 500) });
    } catch (fetchErr) {
      await pool.query(`UPDATE api_connectors SET connection_status='failed', last_tested_at=NOW() WHERE id=$1`, [conn.id]);
      res.json({ success: false, connected: false, error: fetchErr.message });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Send SMS via HTTP connector
app.post('/api/api-connectors/:id/send', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM api_connectors WHERE id=$1 AND is_active=true', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Connector not found or inactive' });
    const conn = r.rows[0];
    const { to, from, text, client_id } = req.body;
    if (!to || !text) return res.status(400).json({ error: 'to and text required' });
    
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (conn.auth_type === 'API_KEY') headers['X-API-Key'] = conn.api_key || '';
      if (conn.auth_type === 'BEARER') headers['Authorization'] = `Bearer ${conn.api_key || ''}`;
      
      const fetchResp = await fetch(conn.send_url, {
        method: conn.http_method || 'POST',
        headers,
        body: JSON.stringify({ to, from: from || 'NET2APP', text }),
        signal: AbortSignal.timeout(15000),
      });
      const respText = await fetchResp.text();
      const matched = conn.submit_pattern ? new RegExp(conn.submit_pattern).exec(respText) : null;
      const externalMsgId = matched ? matched[1] : `HTTP_${Date.now()}`;
      
      // Log to sms_logs
      const msgId = 'MSG' + Date.now();
      await pool.query(`INSERT INTO sms_logs (message_id, client_id, sender_id, destination, message, status, submit_time, route_name)
        VALUES ($1,$2,$3,$4,$5,'submitted',NOW(),$6)`,
        [msgId, client_id || null, from || 'NET2APP', to, text, conn.name]);
      
      res.json({ success: true, data: { message_id: msgId, external_message_id: externalMsgId, connector: conn.name, status: 'submitted' } });
    } catch (fetchErr) {
      res.status(502).json({ success: false, error: `Connector request failed: ${fetchErr.message}` });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DLR webhook handler (public endpoint for connector DLR callbacks)
app.post('/api/webhooks/dlr/:connector_id', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM api_connectors WHERE id=$1 AND is_active=true', [req.params.connector_id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Connector not found' });
    const conn = r.rows[0];
    
    // Verify webhook secret if configured
    if (conn.dlr_webhook_secret) {
      const secret = req.headers['x-webhook-secret'] || req.headers['x-dlr-secret'] || '';
      if (secret !== conn.dlr_webhook_secret) return res.status(403).json({ error: 'Invalid webhook secret' });
    }
    
    // Extract DLR data from body
    const body = req.body;
    const statusMapping = conn.dlr_status_mapping || { 'delivered': 'DELIVRD', 'failed': 'UNDELIV' };
    const externalStatus = body.status || body.state || '';
    const dlrStatus = statusMapping[externalStatus.toLowerCase()] || externalStatus;
    const externalMsgId = body.message_id || body.id || '';
    
    // Update sms_logs with DLR
    if (externalMsgId) {
      await pool.query(`UPDATE sms_logs SET dlr_status=$1, dlr_timestamp=NOW(), status=$2, delivery_time=NOW()
        WHERE smpp_message_id=$3 OR message_id=$4`,
        [dlrStatus, dlrStatus === 'DELIVRD' ? 'delivered' : 'failed', externalMsgId, externalMsgId]);
    }
    
    console.log(`[Webhook] DLR received for connector ${conn.name}: ${externalMsgId} -> ${dlrStatus}`);
    res.json({ success: true, received: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===================== WHATSAPP INBOUND WEBHOOK =====================
// Meta sends GET (verification) and POST (incoming messages) to this endpoint.
// The verify_token configured in the Meta dashboard must match the
// webhook_verify_token on one of the active WhatsApp social_api_suppliers.
app.get('/api/webhooks/whatsapp', async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode !== 'subscribe') return res.status(400).send('Invalid hub.mode');
    if (!token || !challenge) return res.status(400).send('Missing verify_token or challenge');

    // Look up any active WhatsApp supplier that has this verify_token
    const r = await pool.query(
      "SELECT id FROM social_api_suppliers WHERE platform = 'whatsapp_cloud' AND is_active = true AND webhook_verify_token = $1 LIMIT 1",
      [token]
    );
    if (!r.rows.length) {
      console.warn(`[whatsapp-webhook] verify_token mismatch: ${token}`);
      return res.status(403).send('Invalid verify_token');
    }

    console.log(`[whatsapp-webhook] verification OK for supplier ${r.rows[0].id}`);
    res.status(200).send(String(challenge));
  } catch (e) {
    console.error('[whatsapp-webhook] GET error:', e.message);
    res.status(500).send('Internal error');
  }
});

app.post('/api/webhooks/whatsapp', async (req, res) => {
  try {
    const body = req.body || {};
    // Meta webhook payload: { object: "whatsapp_business_account", entry: [...] }
    if (body.object !== 'whatsapp_business_account') {
      return res.status(200).json({ ok: true }); // acknowledge non-message events silently
    }

    const entries = body.entry || [];
    let storedCount = 0;

    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value || {};
        const messages = value.messages || [];
        const contacts = value.contacts || [];
        const metadata = value.metadata || {};
        const phoneNumberId = metadata.phone_number_id || '';

        for (const msg of messages) {
          const from = msg.from || '';
          const waMsgId = msg.id || '';
          const timestamp = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000).toISOString() : new Date().toISOString();
          const msgType = msg.type || 'text';
          const textBody = msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title || `[${msgType} message]`;
          const contact = contacts.find((c) => c.wa_id === from) || contacts[0] || {};
          const senderName = contact.profile?.name || from;

          // Store in mo_sms
          await pool.query(
            `INSERT INTO mo_sms (channel, external_id, sender, sender_name, recipient, message, message_type, metadata, received_at)
             VALUES ('whatsapp', $1, $2, $3, $4, $5, $6, $7, $8)`,
            [waMsgId, from, senderName, phoneNumberId, textBody, msgType,
             JSON.stringify({ wa_message_id: waMsgId, waba_id: entry.id, phone_number_id: phoneNumberId }),
             timestamp]
          ).catch((e) => console.warn('[whatsapp-webhook] mo_sms insert failed:', e.message));
          storedCount++;

          // Also log to sms_logs for visibility in CDR
          const logMsgId = 'MO_WA' + Date.now() + Math.random().toString(36).substring(2, 6);
          pool.query(
            `INSERT INTO sms_logs (message_id, sender_id, destination, message, status, dlr_status, channel, route_name, submit_time, delivery_time, source)
             VALUES ($1, $2, $3, $4, 'delivered', 'DELIVRD', 'whatsapp', 'WhatsApp Inbound', $5, $5, 'whatsapp_inbound')`,
            [logMsgId, from, phoneNumberId, textBody, timestamp]
          ).catch(() => {});
        }
      }
    }

    if (storedCount > 0) console.log(`[whatsapp-webhook] stored ${storedCount} inbound message(s)`);
    // Always return 200 OK to Meta to acknowledge receipt
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[whatsapp-webhook] POST error:', e.message);
    res.status(200).json({ ok: true }); // still 200 so Meta doesn't retry
  }
});

// ===================== TELEGRAM INBOUND WEBHOOK =====================
// Telegram sends POST with Update objects to the configured webhook URL.
// No GET verification needed (setWebhook handles that internally).
app.post('/api/webhooks/telegram', async (req, res) => {
  try {
    const body = req.body || {};
    const updateId = body.update_id;
    const msg = body.message || body.edited_message || body.channel_post || {};

    if (!msg || !msg.chat) {
      // Non-message update (e.g., inline query) — acknowledge
      return res.status(200).json({ ok: true });
    }

    const from = msg.from || {};
    const chat = msg.chat || {};
    const senderId = String(from.id || chat.id || '');
    const senderName = from.first_name
      ? (from.last_name ? `${from.first_name} ${from.last_name}` : from.first_name)
      : (from.username || `chat_${chat.id}`);
    const chatId = String(chat.id);
    const chatType = chat.type || 'private';
    const textBody = msg.text || msg.caption || `[${Object.keys(msg).filter(k => ['audio','photo','document','video','voice','sticker','location','contact','poll'].includes(k))[0] || 'media'} message]`;
    const msgType = msg.text ? 'text' : (msg.photo ? 'photo' : (msg.document ? 'document' : (msg.audio ? 'audio' : 'other')));
    const tgMsgId = String(msg.message_id || '');
    const timestamp = msg.date ? new Date(msg.date * 1000).toISOString() : new Date().toISOString();

    // Store in mo_sms
    await pool.query(
      `INSERT INTO mo_sms (channel, external_id, sender, sender_name, recipient, message, message_type, metadata, received_at)
       VALUES ('telegram', $1, $2, $3, $4, $5, $6, $7, $8)`,
      [tgMsgId, senderId, senderName, chatId, textBody, msgType,
       JSON.stringify({ tg_message_id: tgMsgId, chat_id: chatId, chat_type: chatType, update_id: updateId, from: from, chat: chat }),
       timestamp]
    ).catch((e) => console.warn('[telegram-webhook] mo_sms insert failed:', e.message));

    // Also log to sms_logs
    const logMsgId = 'MO_TG' + Date.now() + Math.random().toString(36).substring(2, 6);
    pool.query(
      `INSERT INTO sms_logs (message_id, sender_id, destination, message, status, dlr_status, channel, route_name, submit_time, delivery_time, source)
       VALUES ($1, $2, $3, $4, 'delivered', 'DELIVRD', 'telegram', 'Telegram Inbound', $5, $5, 'telegram_inbound')`,
      [logMsgId, senderName || senderId, chatId, textBody, timestamp]
    ).catch(() => {});

    console.log(`[telegram-webhook] inbound #${updateId} from ${senderName || senderId} (${chatType})`);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[telegram-webhook] POST error:', e.message);
    res.status(200).json({ ok: true });
  }
});

// ===================== MO SMS API (Inbound Messages) =====================
app.get('/api/mo_sms', auth, async (req, res) => {
  try {
    const { limit, offset, channel } = req.query;
    let q = 'SELECT * FROM mo_sms WHERE 1=1';
    const params = [];
    let i = 1;
    if (channel) { q += ` AND channel = $${i++}`; params.push(channel); }
    q += ' ORDER BY received_at DESC';
    q += ` LIMIT $${i++} OFFSET $${i++}`;
    params.push(parseInt(limit) || 100, parseInt(offset) || 0);
    const r = await pool.query(q, params);
    res.json({ success: true, data: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/mo_sms/reply', auth, async (req, res) => {
  try {
    const { id, text } = req.body || {};
    if (!id || !text) return res.status(400).json({ success: false, error: 'id and text required' });
    const mo = await pool.query('SELECT * FROM mo_sms WHERE id = $1', [id]);
    if (!mo.rows.length) return res.status(404).json({ error: 'Not found' });
    const row = mo.rows[0];

    // Dispatch reply via the appropriate channel
    let replyResult;
    if (row.channel === 'whatsapp') {
      const sas = await pool.query(
        "SELECT * FROM social_api_suppliers WHERE platform = 'whatsapp_cloud' AND is_active = true ORDER BY created_at DESC LIMIT 1"
      );
      const wa = sas.rows[0];
      if (!wa || !wa.phone_number_id || !wa.access_token) {
        return res.status(400).json({ success: false, error: 'No active WhatsApp API configuration' });
      }
      const waApiUrl = `https://graph.facebook.com/v21.0/${wa.phone_number_id}/messages`;
      const waHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${wa.access_token}` };
      const waPayload = { messaging_product: 'whatsapp', to: row.sender, type: 'text', text: { body: text } };
      const waResp = await fetch(waApiUrl, { method: 'POST', headers: waHeaders, body: JSON.stringify(waPayload), signal: AbortSignal.timeout(15000) });
      const waBody = await waResp.json();
      if (!waResp.ok) throw new Error(waBody?.error?.message || `HTTP ${waResp.status}`);
      replyResult = { wa_message_id: waBody?.messages?.[0]?.id };
    } else if (row.channel === 'telegram') {
      const tgs = await pool.query(
        "SELECT * FROM social_api_suppliers WHERE platform = 'telegram_bot' AND is_active = true ORDER BY created_at DESC LIMIT 1"
      );
      const tg = tgs.rows[0];
      if (!tg || !tg.bot_token) {
        return res.status(400).json({ success: false, error: 'No active Telegram Bot API configuration' });
      }
      const tgApiUrl = `https://api.telegram.org/bot${tg.bot_token}/sendMessage`;
      const tgPayload = { chat_id: row.recipient, text, parse_mode: 'HTML' };
      const tgResp = await fetch(tgApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tgPayload), signal: AbortSignal.timeout(15000) });
      const tgBody = await tgResp.json();
      if (!tgResp.ok || !tgBody.ok) throw new Error(tgBody?.description || `HTTP ${tgResp.status}`);
      replyResult = { tg_message_id: tgBody?.result?.message_id };
    } else {
      return res.status(400).json({ success: false, error: `Reply not supported for channel: ${row.channel}` });
    }

    // Mark as replied
    await pool.query('UPDATE mo_sms SET reply_sent = true, processed = true, reply_text = $1, replied_at = NOW() WHERE id = $2', [text, id]);
    res.json({ success: true, data: { replied: true, ...replyResult } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ===================== API KEYS MANAGEMENT =====================
// Generate API key for client
app.post('/api/clients/:id/api-key', auth, roles('super_admin','admin'), async (req, res) => {
  try {
    const client = await pool.query('SELECT * FROM clients WHERE id=$1', [req.params.id]);
    if (!client.rows.length) return res.status(404).json({ error: 'Client not found' });
    
    const rawKey = 'n2a_' + crypto.randomBytes(24).toString('hex');
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 10);
    
    await pool.query(`INSERT INTO api_keys (client_id, api_key_hash, api_key_prefix) VALUES ($1,$2,$3)`,
      [req.params.id, keyHash, keyPrefix]);
    
    // Update client api_key field for legacy compat
    await pool.query('UPDATE clients SET api_key=$1, api_enabled=true WHERE id=$2', [rawKey, req.params.id]);
    
    res.json({ success: true, data: { api_key: rawKey, prefix: keyPrefix, message: 'Save this key — it won\'t be shown again' } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// List API keys for client
app.get('/api/clients/:id/api-keys', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT id, api_key_prefix, rate_limit_tps, daily_quota, usage_count, last_used_at, is_active, created_at FROM api_keys WHERE client_id=$1 ORDER BY created_at DESC', [req.params.id]);
    res.json({ success: true, data: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Revoke API key
app.delete('/api/api-keys/:id', auth, roles('super_admin','admin'), async (req, res) => {
  try {
    await pool.query('UPDATE api_keys SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ success: true, message: 'API key revoked' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

require("./external-api.cjs")(app, pool, auth, SEED_USER_PASSWORDS, bridge);
require("./users-api.cjs")(app, pool, auth, roles);
// apiExtensions.cjs MUST be required BEFORE the generic CRUD loop runs
// below — its explicit /api/api-connectors handlers need to win the
// Express match against the otherwise-generic handlers.
const apiExtensionsFactory = require("./apiExtensions.cjs");
apiExtensionsFactory(app, pool, auth, roles);
// Wire asterisk-bridge + number-validation-providers into apiExtensions'
// /api/asterisk/* and /api/number/* endpoints. setModules is exported on
// the same module.exports value so call order is: require, factory call,
// setModules.
apiExtensionsFactory.setModules(numValid, astBridge, emailService);
// Do NOT regenerate asterisk config on boot when the host already has
// working pjsip.conf + extensions.conf (defaults to use_existing_config).
// The UI exposes an explicit "Regenerate config" button for opt-in.
if (process.env.ASTERISK_ENABLED === 'true') {
  astBridge.loadSettings().then((s) => {
    if (!s.use_existing_config) {
      astBridge.regenerateConfig().catch((e) => console.warn('[asterisk] regenerate-config on boot failed:', e.message));
    } else {
      console.log('[asterisk] use_existing_config=true; not overwriting existing dialplan');
    }
    // Fresh-boot discovery: pull latest sip_servers + sip_server_destinations
    // from PG (so external row inserts that happened while server.cjs was
    // down are picked up), then (re)start one AMI listener per active row.
    // This replaces the previous startAMIListener() call so config drift
    // between boots (priority changes, archive/restore, new host added) is
    // re-applied automatically. The bridge logs "[asterisk] AMI listener
    // started: server #N …" for each row it brings online.
    astBridge.reloadServersAndRestart().catch((e) => console.warn('[asterisk] reloadServersAndRestart on boot failed:', e.message));
  });
} else {
  console.log('[asterisk] ASTERISK_ENABLED is not "true" — skipping AMI connection attempts entirely');
}
// ============================================================
// 5-second DLR poller for voice_call_retry_queue.
// Runs forever from boot. Polls Postgres every 5s for retry rows
// whose next_attempt_at <= NOW(), then:
//   1. Triggers asterisk.originate()
//   2. Updates voice_otp_logs.dial_status
//   3. Pushes final DLR (success only if status === 'CONNECTED')
// ============================================================
let _pollerStop = false;
async function voiceDlrPollerOnce() {
  try {      const due = await pool.query(
      `SELECT id, call_id, destination, otp_code, language, retry_count, max_retries, client_id, sip_server_id, created_at
         FROM voice_call_retry_queue
        WHERE status IN ('pending','waiting') AND next_attempt_at <= NOW()
        ORDER BY next_attempt_at ASC LIMIT 20`
    );
    if (!due.rows.length) return;
    for (const row of due.rows) {
      // Mark "in progress" so concurrent pollers don't double-dial.
      await pool.query(
        `UPDATE voice_call_retry_queue SET status='in_progress', last_dial_result=$1 WHERE id=$2`,
        ['dial_started', row.id]
      );
      try {
        // Multi-server pick: `next_sip_server_id` is ONLY ever written on a
        // previous failed attempt — so when both fields are populated
        // (sip_server_id=X, next_sip_server_id=Y), they mean "we just tried
        // X and it failed, try Y next". A naive "pinned first" cascade
        // would re-attempt X. Failover must therefore win over pin; the
        // pickServer final fallback passes sip_server_id as excludeId so a
        // still-broken host can't keep getting rediscovered by priority.
        const failover = row.next_sip_server_id ? astBridge.getServer(row.next_sip_server_id) : null;
        const pinned   = row.sip_server_id      ? astBridge.getServer(row.sip_server_id)      : null;
        const chosen = failover
          || pinned
          // Destination-prefix routing beats priority but loses to failover/pin
          // so a previously-failed-stagger-row keeps its retry intent. Empty
          // _destinations inside the bridge means the feature is dormant and
          // the helper short-circuits to plain pickServer('priority', excludeId).
          || astBridge.pickServerForDestination(row.destination, 'priority', row.sip_server_id || undefined);
        if (!chosen) {
          // No callable server yet (AMI listener may still be connecting).
          // Fallback: use the raw server from DB if it exists, bypassing isServerCallable.
          const rawServer = astBridge.getServer(1); // server #1 = local Asterisk
          console.log('[voice-poller] NO_SERVER — fallback to server #1. rawServer:', !!rawServer, 'chosen:', !!chosen);
          if (!rawServer) {
            // Still no server — retry in 10s.
            const retryIn = new Date(Date.now() + 10000);
            await pool.query(`UPDATE voice_call_retry_queue SET status='waiting', error_message='no_servers_available', next_attempt_at=$1 WHERE id=$2`, [retryIn, row.id]);
            await pool.query(`UPDATE voice_otp_logs SET dial_status='RETRY_SCHEDULED', status='retrying', next_retry_at=$1 WHERE call_id=$2`, [retryIn, row.call_id]);
            continue;
          }
          // Direct originate bypassing isServerCallable.
          chosen = rawServer;
        }
        // Race-fix: register the per-server Promise BEFORE firing Originate
        // so a fast DialEnd can't slip through an empty pending map on the
        // chosen server.
        // Dynamic per-attempt timeout: shorter waits for later retries so
        // cumulative timing stays within the user's desired retry windows.
        const attemptTimeouts = [35000, 30000, 25000]; // retry 0,1,2
        const attemptTimeout = attemptTimeouts[row.retry_count || 0] || 25000;
        const waitPromise = astBridge.awaitCallStatus(chosen.id, row.call_id, attemptTimeout);
        const out = await astBridge.originate(chosen.id, {
          call_id: row.call_id, destination: row.destination,
          language: row.language, otp_code: row.otp_code,
          caller_id: null,
        });
        // Persist server attribution immediately (audit trail even if the
        // call ultimately times out).
        await pool.query(`UPDATE voice_call_retry_queue SET sip_server_id=$1 WHERE id=$2`, [chosen.id, row.id]);
        await pool.query(`UPDATE voice_otp_logs SET sip_server_id=$1 WHERE call_id=$2`, [chosen.id, row.call_id]);
        const issued = !!out;
        // Failover seed: if Originate itself failed for THIS server, mark
        // the next-best server on next_sip_server_id so the next retry
        // tick doesn't pick the same broken node.
        if (!issued) {
          const nextSrv = astBridge.pickServer('priority', chosen.id);
          if (nextSrv) await pool.query(`UPDATE voice_call_retry_queue SET next_sip_server_id=$1 WHERE id=$2`, [nextSrv.id, row.id]);
        }
        // If Originate itself failed (e.g. AMI refused the action) we
        // immediately re-queue; otherwise we wait for the AMI DialEnd
        // event which resolves the per-call Promise in asterisk-bridge.
        const success = issued
          ? await waitPromise
          : false;
        if (success) {
          // Clear any stagger-point from a previous failed attempt so the
          // row's history doesn't carry a stale failover target forward.
          await pool.query(
            `UPDATE voice_otp_logs
               SET dial_status='CONNECTED', dlr_status='CONNECTED', status='completed', completed_at=NOW()
             WHERE call_id=$1`,
            [row.call_id]
          );
          await pool.query(
            `UPDATE voice_call_retry_queue
               SET status='connected', completed_at=NOW(), last_dial_result='connected',
                   next_sip_server_id=NULL
             WHERE id=$1`,
            [row.id]
          );
          await pushSyntheticVoiceDlr(row.call_id, 'CONNECTED', row.destination, row.otp_code, row.language);
        } else {
          // Failed this attempt — bump retry_count, schedule next attempt per policy.
          const newRc = (row.retry_count || 0) + 1;
          if (newRc > (row.max_retries || 3)) {
            await pool.query(`UPDATE voice_call_retry_queue SET status='failed', completed_at=NOW() WHERE id=$1`, [row.id]);
            await pool.query(`UPDATE voice_otp_logs SET dial_status='FAILED', status='failed', completed_at=NOW() WHERE call_id=$1`, [row.call_id]);
            await pushSyntheticVoiceDlr(row.call_id, 'FAILED', row.destination, row.otp_code, row.language, row.client_id);
          } else {
            // Cumulative retry timing from initial submission (created_at).
            // User-specified windows: retry1=30-49s, retry2=70-80s, retry3=110-120s.
            const cumulativeOffsets = { 1: 40, 2: 75, 3: 115 };
            const offsetSec = cumulativeOffsets[newRc] || 0;
            const baseTs = row.created_at ? `'${new Date(row.created_at).toISOString()}'::timestamptz` : 'CURRENT_TIMESTAMP';
            const nextSql = offsetSec ? `${baseTs} + INTERVAL '${offsetSec} seconds'` : 'CURRENT_TIMESTAMP';
            await pool.query(
              `UPDATE voice_call_retry_queue SET status='waiting', retry_count=$1, next_attempt_at=${nextSql} WHERE id=$2`,
              [newRc, row.id]
            );
            await pool.query(`UPDATE voice_otp_logs SET retry_count=$1, dial_status='RETRY_SCHEDULED', next_retry_at=${nextSql}, status='retrying' WHERE call_id=$2`,
              [newRc, row.call_id]);
          }
        }
      } catch (e) {
        await pool.query(`UPDATE voice_call_retry_queue SET status='failed', error_message=$1, completed_at=NOW() WHERE id=$2`, [e.message, row.id]);
        await pool.query(`UPDATE voice_otp_logs SET dial_status='ERROR', status='failed', completed_at=NOW() WHERE call_id=$1`, [row.call_id]);
        await pushSyntheticVoiceDlr(row.call_id, 'ERROR', row.destination, row.otp_code, row.language, row.client_id);
      }
    }
  } catch (e) {
    console.warn('[voice-poller] tick failed:', e.message);
  }
}

async function pushSyntheticVoiceDlr(call_id, status, destination, otp_code, language, client_id = null, server_id = null) {
  // Mirror a synthetic SMPP-style DLR into sms_logs so the normal DLR
  // pipeline (webhook OR client SMPP session) picks it up and pushes to
  // the client. Marked with channel='voice_otp' on the row so the
  // receiving client can route it appropriately. If client_id is passed,
  // we populate sms_logs.client_id so /internal/dlr_event can route the
  // final webhook/SMPP-delivery correctly. message_id is the call_id
  // itself (already unique) — DO NOT slice/timestamp it.
  const msgId = String(call_id);
  try {
    await pool.query(
      `INSERT INTO sms_logs (message_id, client_id, destination, sender_id, message, status, dlr_status,
                              delivery_time, channel, route_name, source)
       VALUES ($1, $2, $3, 'voice_otp', $4, $5, $6, NOW(), 'voice_otp', 'voice_otp', 'node_voice_dlr')`,
      [msgId, client_id, destination, '[voice-otp] ' + language + ': ' + otp_code,
       // Status mapping: CONNECTED → delivered, terminal errors → failed,
       // everything else (retry, intermediate) → sent (already submitted to supplier).
       status === 'CONNECTED' ? 'delivered'
         : (status === 'FAIL_NO_SERVER' || status === 'FAILED' || status === 'ERROR') ? 'failed'
         : 'sent',
       status]
    );
  } catch (e) { console.warn('[voice-poller] synthetic DLR insert failed:', e.message); return; }
  // NEW (this turn): push the synthetic DLR through Node → Java gateway
  // so the originating client gets a webhook POST OR an SMPP delivery_sm
  // PDU back on its bound ESME session. Java's DlrRouter.handleDlr()
  // routes by webhook-vs-esme precedence; without this hop the client
  // never gets a DLR even though sms_logs says 'delivered'. NEVER throws —
  // Java being down must NOT abort the poller or lose the sms_logs row.
  if (!client_id) return;
  const dlrStatus = status === 'CONNECTED' ? 'DELIVRD'
                  : status === 'FAILED' ? 'UNDELIV'
                  : status === 'ERROR' ? 'UNDELIV'
                  : status === 'FAIL_NO_SERVER' ? 'UNDELIV'
                  : 'UNDELIV';
  const errorCode = status === 'CONNECTED' ? '000'
                  : status === 'FAIL_NO_SERVER' ? '042'
                  : status === 'TIMEOUT' ? '008'
                  : '004';
  try {
    const r = await astBridge.gatewayPushDlr({
      message_id: msgId,
      smpp_message_id: 'SYNTH_' + msgId,
      dlr_status: dlrStatus,
      error_code: errorCode,
      destination,
      client_id,
      supplier_id: 0,
      // best-effort attribution via the sip_servers row the poller
      // already wrote onto the queue (origin server → log of last push)
      server_id: null,
    });
    const route = (r && r.route) || (r && r.ok === false ? 'java_unreachable' : 'unknown');
    console.log(`[voice-poller] DLR push ${msgId} status=${status} client=${client_id} route=${route}`);
  } catch (e) {
    console.warn('[voice-poller] gatewayPushDlr threw (non-fatal):', e.message);
  }
}

let _voicePollerHandle = null;
function startVoiceDlrPoller() {
  if (_voicePollerHandle) return;
  _voicePollerHandle = setInterval(() => {
    if (_pollerStop) return;
    voiceDlrPollerOnce();
  }, 5000);
  console.log('[voice-poller] started (5s tick)');
}
function stopVoiceDlrPoller() {
  if (_voicePollerHandle) { clearInterval(_voicePollerHandle); _voicePollerHandle = null; }
  _pollerStop = true;
}
// ===================== SMTP TEST =====================
app.post('/api/smtp/test', auth, roles('super_admin','admin'), async (req, res) => {
  try {
    const result = await emailService.testSmtpConnection();
    res.json(result);
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ===================== DASHBOARD =====================
app.get('/api/dashboard/stats', auth, async (req, res) => {
  const r = await pool.query(`SELECT (SELECT COUNT(*) FROM clients) as tc, (SELECT COUNT(*) FROM clients WHERE status='active') as ac, (SELECT COUNT(*) FROM suppliers) as ts, (SELECT COUNT(*) FROM suppliers WHERE status='active') as asu, (SELECT COUNT(*) FROM sms_logs WHERE submit_time::date=CURRENT_DATE) as sms_t, (SELECT COUNT(*) FROM sms_logs WHERE submit_time::date=CURRENT_DATE AND status='delivered') as del_t, (SELECT COUNT(*) FROM suppliers WHERE (connection_type <> 'smpp' AND status = 'active') OR bind_status = 'bound') as ab, (SELECT COUNT(*) FROM suppliers) as tb`);
  res.json({ success: true, data: r.rows[0] });
});

// ===================== SOCIAL API DEVICE PAIRING =====================
// WhatsApp: QR code pairing via Baileys through residential proxy
// Telegram: Phone-number verification flow through proxy
const pair = require('./social-pairing.cjs');

// Start a pairing session for a social API supplier
app.post('/api/social-suppliers/:id/pair', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM social_api_suppliers WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Supplier not found' });
    const supplier = r.rows[0];
    const result = await pair.startPairing(supplier);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Poll pairing status (QR code, connection state, errors)
app.get('/api/social-suppliers/:id/pair-status', auth, async (req, res) => {
  try {
    const status = pair.getStatus(req.params.id);
    // If paired, persist connection_status to DB
    if (status.status === 'connected') {
      pool.query(
        "UPDATE social_api_suppliers SET connection_status = 'connected', last_tested_at = NOW() WHERE id = $1",
        [req.params.id]
      ).catch(() => {});
    }
    if (status.status === 'error' && status.error) {
      pool.query(
        "UPDATE social_api_suppliers SET connection_status = 'error', last_tested_at = NOW() WHERE id = $1",
        [req.params.id]
      ).catch(() => {});
    }
    res.json({ success: true, data: status });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Submit phone number or verification code (Telegram pairing)
app.post('/api/social-suppliers/:id/pair-verify', auth, async (req, res) => {
  try {
    const { phone, code } = req.body || {};
    let result;
    if (phone) {
      result = pair.submitPhone(req.params.id, phone);
    } else if (code) {
      result = pair.submitCode(req.params.id, code);
    } else {
      return res.status(400).json({ error: 'phone or code required' });
    }
    if (result.status === 'connected') {
      pool.query(
        "UPDATE social_api_suppliers SET connection_status = 'connected', last_tested_at = NOW() WHERE id = $1",
        [req.params.id]
      ).catch(() => {});
    }
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Cancel an active pairing session
app.post('/api/social-suppliers/:id/pair-cancel', auth, async (req, res) => {
  try {
    const result = pair.cancelPairing(req.params.id);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===================== WHATSAPP / TELEGRAM MESSAGE SENDING =====================
// Send messages via WhatsApp Cloud API (Meta Business Platform)
app.post('/api/whatsapp/send', auth, async (req, res) => {
  try {
    const { to, text, client_id, supplier_id } = req.body || {};
    if (!to) return res.status(400).json({ success: false, error: 'destination "to" is required' });
    if (!text) return res.status(400).json({ success: false, error: 'message "text" is required' });

    // Resolve the WhatsApp supplier: explicit supplier_id or find first active whatsapp_cloud
    let supplier;
    if (supplier_id) {
      const r = await pool.query(
        "SELECT * FROM social_api_suppliers WHERE id = $1 AND platform = 'whatsapp_cloud' AND is_active = true",
        [supplier_id]
      );
      supplier = r.rows[0];
    } else {
      const r = await pool.query(
        "SELECT * FROM social_api_suppliers WHERE platform = 'whatsapp_cloud' AND is_active = true ORDER BY created_at DESC LIMIT 1"
      );
      supplier = r.rows[0];
    }
    if (!supplier) return res.status(400).json({ success: false, error: 'No active WhatsApp Cloud API supplier configured. Set one up in Business API Connections.' });
    if (!supplier.phone_number_id) return res.status(400).json({ success: false, error: 'WhatsApp supplier is missing phone_number_id' });
    if (!supplier.access_token) return res.status(400).json({ success: false, error: 'WhatsApp supplier is missing access_token' });

    // Build WhatsApp Cloud API request
    const apiUrl = `https://graph.facebook.com/v21.0/${supplier.phone_number_id}/messages`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supplier.access_token}`,
    };
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: String(to).replace(/[^0-9]/g, ''),
      type: 'text',
      text: { body: String(text) },
    };

    // Resolve proxy agent if enabled
    let agent = undefined;
    if (supplier.proxy_enabled && supplier.proxy_host) {
      try {
        const { SocksProxyAgent } = require('socks-proxy-agent');
        const auth = supplier.proxy_username
          ? `${encodeURIComponent(supplier.proxy_username)}:${encodeURIComponent(supplier.proxy_password || '')}@`
          : '';
        agent = new SocksProxyAgent(`socks5://${auth}${supplier.proxy_host}:${supplier.proxy_port}`);
      } catch (_) { /* proceed without proxy */ }
    }

    // Fire the API call
    const startTime = Date.now();
    let waMessageId = null;
    let statusCode = 0;
    try {
      const fetchOpts = { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) };
      if (agent) fetchOpts.agent = agent;
      const resp = await fetch(apiUrl, fetchOpts);
      statusCode = resp.status;
      const body = await resp.json();
      waMessageId = body?.messages?.[0]?.id || body?.wa_id || null;
      const errMsg = body?.error?.message || (resp.ok ? null : `HTTP ${resp.status}`);
      if (!resp.ok) throw new Error(errMsg || 'WhatsApp API returned an error');
    } catch (e) {
      // Log failure to sms_logs
      const msgId = 'WA' + Date.now() + Math.random().toString(36).substring(2, 8);
      const c = client_id ? await pool.query('SELECT client_code FROM clients WHERE id = $1', [client_id]).then(r => r.rows[0]).catch(() => null) : null;
      await pool.query(
        `INSERT INTO sms_logs (message_id, client_id, client_code, sender_id, destination, message, status, dlr_status, channel, route_name, submit_time, delivery_time, error_message)
         VALUES ($1, $2, $3, 'whatsapp', $4, $5, 'failed', 'UNDELIV', 'whatsapp', 'WhatsApp Cloud API', NOW(), NOW(), $6)`,
        [msgId, client_id || null, c?.client_code || null, to, text, e.message?.substring(0, 500) || 'Unknown error']
      );
      return res.status(502).json({ success: false, error: `WhatsApp API call failed: ${e.message}`, message_id: msgId, http_status: statusCode });
    }

    // Log success to sms_logs
    const msgId = 'WA' + Date.now() + Math.random().toString(36).substring(2, 8);
    const c = client_id ? await pool.query('SELECT client_code FROM clients WHERE id = $1', [client_id]).then(r => r.rows[0]).catch(() => null) : null;
    const parts = Math.ceil((text || '').length / 160);
    await pool.query(
      `INSERT INTO sms_logs        (message_id, client_id, client_code, sender_id, destination, message, message_parts, status, dlr_status, channel, route_name, submit_time, smpp_message_id)
       VALUES ($1, $2, $3, 'whatsapp', $4, $5, 1, 'submitted', 'PENDING', 'whatsapp', 'WhatsApp Cloud API', NOW(), $7)`,
      [msgId, client_id || null, c?.client_code || null, to, text, parts, waMessageId]
    );

    const latency = Date.now() - startTime;
    res.json({
      success: true,
      data: {
        message_id: msgId,
        wa_message_id: waMessageId,
        destination: to,
        text,
        channel: 'whatsapp',
        status: 'submitted',
        latency_ms: latency,
        proxied: !!agent,
      }
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Send messages via Telegram Bot API
app.post('/api/telegram/send', auth, async (req, res) => {
  try {
    const { to, text, client_id, supplier_id, parse_mode } = req.body || {};
    if (!to) return res.status(400).json({ success: false, error: 'destination "to" (chat_id) is required' });
    if (!text) return res.status(400).json({ success: false, error: 'message "text" is required' });

    // Resolve the Telegram supplier
    let supplier;
    if (supplier_id) {
      const r = await pool.query(
        "SELECT * FROM social_api_suppliers WHERE id = $1 AND platform = 'telegram_bot' AND is_active = true",
        [supplier_id]
      );
      supplier = r.rows[0];
    } else {
      const r = await pool.query(
        "SELECT * FROM social_api_suppliers WHERE platform = 'telegram_bot' AND is_active = true ORDER BY created_at DESC LIMIT 1"
      );
      supplier = r.rows[0];
    }
    if (!supplier) return res.status(400).json({ success: false, error: 'No active Telegram Bot API supplier configured. Set one up in Business API Connections.' });
    if (!supplier.bot_token) return res.status(400).json({ success: false, error: 'Telegram supplier is missing bot_token' });

    // Build Telegram Bot API request
    const apiUrl = `https://api.telegram.org/bot${supplier.bot_token}/sendMessage`;
    const headers = { 'Content-Type': 'application/json' };
    const payload = {
      chat_id: String(to),
      text: String(text),
      parse_mode: parse_mode || 'HTML',
      disable_web_page_preview: true,
    };

    // Resolve proxy agent if enabled
    let agent = undefined;
    if (supplier.proxy_enabled && supplier.proxy_host) {
      try {
        const { SocksProxyAgent } = require('socks-proxy-agent');
        const auth = supplier.proxy_username
          ? `${encodeURIComponent(supplier.proxy_username)}:${encodeURIComponent(supplier.proxy_password || '')}@`
          : '';
        agent = new SocksProxyAgent(`socks5://${auth}${supplier.proxy_host}:${supplier.proxy_port}`);
      } catch (_) { /* proceed without proxy */ }
    }

    // Fire the API call
    const startTime = Date.now();
    let tgMessageId = null;
    let statusCode = 0;
    try {
      const fetchOpts = { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) };
      if (agent) fetchOpts.agent = agent;
      const resp = await fetch(apiUrl, fetchOpts);
      statusCode = resp.status;
      const body = await resp.json();
      tgMessageId = body?.result?.message_id || null;
      if (!resp.ok || !body.ok) throw new Error(body?.description || body?.error_description || `HTTP ${resp.status}`);
    } catch (e) {
      const msgId = 'TG' + Date.now() + Math.random().toString(36).substring(2, 8);
      const c = client_id ? await pool.query('SELECT client_code FROM clients WHERE id = $1', [client_id]).then(r => r.rows[0]).catch(() => null) : null;
      await pool.query(
        `INSERT INTO sms_logs (message_id, client_id, client_code, sender_id, destination, message, status, dlr_status, channel, route_name, submit_time, delivery_time, error_message)
         VALUES ($1, $2, $3, 'telegram', $4, $5, 'failed', 'UNDELIV', 'telegram', 'Telegram Bot API', NOW(), NOW(), $6)`,
        [msgId, client_id || null, c?.client_code || null, to, text, e.message?.substring(0, 500) || 'Unknown error']
      );
      return res.status(502).json({ success: false, error: `Telegram API call failed: ${e.message}`, message_id: msgId, http_status: statusCode });
    }

    // Log success to sms_logs
    const msgId = 'TG' + Date.now() + Math.random().toString(36).substring(2, 8);
    const c = client_id ? await pool.query('SELECT client_code FROM clients WHERE id = $1', [client_id]).then(r => r.rows[0]).catch(() => null) : null;
    await pool.query(
      `INSERT INTO sms_logs (message_id, client_id, client_code, sender_id, destination, message, message_parts, status, dlr_status, channel, route_name, submit_time, smpp_message_id)
       VALUES ($1, $2, $3, 'telegram', $4, $5, 1, 'submitted', 'PENDING', 'telegram', 'Telegram Bot API', NOW(), $7)`,
      [msgId, client_id || null, c?.client_code || null, to, text, parts, tgMessageId ? String(tgMessageId) : null]
    );

    const latency = Date.now() - startTime;
    res.json({
      success: true,
      data: {
        message_id: msgId,
        tg_message_id: tgMessageId,
        chat_id: to,
        text,
        channel: 'telegram',
        status: 'submitted',
        latency_ms: latency,
        proxied: !!agent,
      }
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ===================== RESIDENTIAL PROXY ENDPOINTS =====================
// Public endpoint — local proxy tools POST their IP:port to register as an available proxy.
// Uses a simple shared secret (PROXY_REGISTER_SECRET env var) for basic auth.
app.post('/api/proxy/register', async (req, res) => {
  try {
    const secret = process.env.PROXY_REGISTER_SECRET || 'net2app-proxy-2024';
    const provided = req.headers['x-proxy-secret'] || req.body?.secret || '';
    if (provided !== secret) return res.status(403).json({ error: 'Invalid proxy secret' });

    const { name, host, port, username, password, proxy_type } = req.body || {};
    if (!host || !port) return res.status(400).json({ error: 'host and port required' });

    // Upsert: if a proxy with this host:port already exists, update it; else insert.
    const existing = await pool.query(
      'SELECT id FROM residential_proxies WHERE host = $1 AND port = $2',
      [host, parseInt(port)]
    );
    const publicIp = req.ip || req.socket?.remoteAddress || host;

    if (existing.rows.length) {
      await pool.query(
        `UPDATE residential_proxies
           SET name = COALESCE($1, name), username = $2, password = $3,
               proxy_type = COALESCE($4, proxy_type), public_ip = $5,
               is_online = true, last_heartbeat = NOW(), updated_at = NOW()
         WHERE id = $6`,
        [name || ('Proxy ' + host), username || '', password || '', proxy_type || 'socks5', publicIp, existing.rows[0].id]
      );
      return res.json({ success: true, message: 'Proxy updated', id: existing.rows[0].id, public_ip: publicIp });
    }

    const r = await pool.query(
      `INSERT INTO residential_proxies (name, proxy_type, host, port, username, password, public_ip, is_active, is_online, last_heartbeat)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, NOW()) RETURNING id`,
      [name || ('Proxy ' + host), proxy_type || 'socks5', host, parseInt(port), username || '', password || '', publicIp]
    );
    res.json({ success: true, message: 'Proxy registered', id: r.rows[0].id, public_ip: publicIp });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Heartbeat — proxy tools call this periodically to keep the proxy marked online
app.post('/api/proxy/heartbeat', async (req, res) => {
  try {
    const secret = process.env.PROXY_REGISTER_SECRET || 'net2app-proxy-2024';
    const provided = req.headers['x-proxy-secret'] || req.body?.secret || '';
    if (provided !== secret) return res.status(403).json({ error: 'Invalid proxy secret' });

    const { host, port } = req.body || {};
    if (!host || !port) return res.status(400).json({ error: 'host and port required' });
    const publicIp = req.ip || req.socket?.remoteAddress || host;

    await pool.query(
      `UPDATE residential_proxies SET is_online = true, last_heartbeat = NOW(), public_ip = $3, updated_at = NOW()
       WHERE host = $1 AND port = $2`,
      [host, parseInt(port), publicIp]
    );
    res.json({ success: true, message: 'Heartbeat received', public_ip: publicIp });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// List all registered proxies (authenticated — for the UI)
app.get('/api/residential_proxies', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM residential_proxies ORDER BY is_online DESC, last_heartbeat DESC NULLS LAST');
    res.json({ success: true, data: r.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete a proxy
app.delete('/api/residential_proxies/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM residential_proxies WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===================== SINGLE-ROW GETS =====================
// The generic CRUD loop below only registers collection-level GET/POST/PUT/DELETE.
// Detail/refresh-by-id paths need single-row GET too — register them explicitly
// above the generic loop so they take precedence on Express's match order.
// Keep this list focused; add a table here only if the GUI has a detail page
// that fetches by id (after add/edit, on direct-link navigation, etc.).
['route_maps','trunks','routes','route_plans','campaigns','clients','suppliers','users','invoices','payments','notification_templates','ott_devices','api_connectors','social_api_suppliers'].forEach(t => {
  app.get(`/api/${t}/:id`, auth, async (req, res) => {
    try {
      const r = await pool.query(`SELECT * FROM ${t} WHERE id = $1`, [req.params.id]);
      if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true, data: r.rows[0] });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
});

// ===================== SUPER ADMIN: PM2 Management =====================
// GET /api/admin/pm2/status - List all PM2 processes
app.get('/api/admin/pm2/status', auth, roles('super_admin'), async (req, res) => {
  try {
    const { stdout } = await execAsync('pm2 jlist');
    const processes = JSON.parse(stdout).map(p => ({
      name: p.name,
      pm_id: p.pm_id,
      status: p.pm2_env?.status,
      restart_time: p.pm2_env?.restart_time,
      uptime: p.pm2_env?.pm_uptime,
      cpu: p.monit?.cpu,
      memory: p.monit?.memory,
      exec_path: p.pm_exec_path,
      exec_mode: p.pm2_env?.exec_mode
    }));
    res.json({ success: true, data: processes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/pm2/logs/:name - Get PM2 logs for a process
app.get('/api/admin/pm2/logs/:name', auth, roles('super_admin'), async (req, res) => {
  try {
    const name = sanitizePm2Name(req.params.name);
    const type = req.query.type || 'all';
    const lines = Math.min(Math.max(parseInt(req.query.lines) || 100, 1), 5000);
    const logDir = '/root/.pm2/logs';
    const result = {};
    if (type === 'out' || type === 'all') {
      const outPath = logDir + '/' + name + '-out.log';
      if (fs.existsSync(outPath)) {
        const { stdout } = await execAsync('tail -' + lines + ' "' + outPath + '"');
        result.out = stdout;
      } else {
        result.out = 'Log file not found: ' + outPath;
      }
    }
    if (type === 'error' || type === 'all') {
      const errPath = logDir + '/' + name + '-error.log';
      if (fs.existsSync(errPath)) {
        const { stdout } = await execAsync('tail -' + lines + ' "' + errPath + '"');
        result.error = stdout;
      } else {
        result.error = 'Log file not found: ' + errPath;
      }
    }
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/pm2/:name/restart - Restart a PM2 process
app.post('/api/admin/pm2/:name/restart', auth, roles('super_admin'), async (req, res) => {
  try {
    const name = sanitizePm2Name(req.params.name);
    const { stdout } = await execAsync('pm2 restart ' + name);
    res.json({ success: true, message: "Process '" + name + "' restarted", output: stdout });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/pm2/:name/start - Start a PM2 process
app.post('/api/admin/pm2/:name/start', auth, roles('super_admin'), async (req, res) => {
  try {
    const name = sanitizePm2Name(req.params.name);
    const { stdout } = await execAsync('pm2 start ' + name);
    res.json({ success: true, message: "Process '" + name + "' started", output: stdout });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/pm2/:name/stop - Stop a PM2 process
app.post('/api/admin/pm2/:name/stop', auth, roles('super_admin'), async (req, res) => {
  try {
    const name = sanitizePm2Name(req.params.name);
    const { stdout } = await execAsync('pm2 stop ' + name);
    res.json({ success: true, message: "Process '" + name + "' stopped", output: stdout });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===================== SUPER ADMIN: Tenant Monitoring & Control =====================

// GET /api/admin/tenants - List all tenants with extended monitoring info
app.get('/api/admin/tenants', auth, roles('super_admin'), async (req, res) => {
  try {
    const clients = await pool.query(
      'SELECT id, client_code, company_name, email, balance, currency, credit_limit, status, api_enabled, created_at, updated_at FROM clients ORDER BY id'
    );
    const tenantsWithStats = await Promise.all(clients.rows.map(async (client) => {
      try {
        const smsStats = await pool.query(
          "SELECT COUNT(*)::int as total_sms, COUNT(*) FILTER (WHERE status='DELIVRD')::int as delivered, COUNT(*) FILTER (WHERE status='REJECTD' OR status='UNDELIV')::int as failed, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int as last_24h FROM sms_logs WHERE client_id = $1",
          [client.id]
        );
        return { ...client, sms: smsStats.rows[0] };
      } catch {
        return { ...client, sms: { total_sms: 0, delivered: 0, failed: 0, last_24h: 0 } };
      }
    }));
    res.json({ success: true, data: tenantsWithStats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/tenants/:id - Get single tenant with full details
app.get('/api/admin/tenants/:id', auth, roles('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const client = await pool.query(
      'SELECT id, client_code, company_name, email, balance, currency, credit_limit, status, api_enabled, created_at, updated_at FROM clients WHERE id = $1',
      [id]
    );
    if (!client.rows.length) return res.status(404).json({ error: 'Tenant not found' });
    const smsStats = await pool.query(
      "SELECT COUNT(*)::int as total_sms, COUNT(*) FILTER (WHERE status='DELIVRD')::int as delivered, COUNT(*) FILTER (WHERE status='REJECTD' OR status='UNDELIV')::int as failed, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int as last_24h, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int as last_7d, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int as last_30d FROM sms_logs WHERE client_id = $1",
      [id]
    );
    const recentSms = await pool.query(
      'SELECT id, sender, receiver, message, status, created_at FROM sms_logs WHERE client_id = $1 ORDER BY created_at DESC LIMIT 20',
      [id]
    );
    res.json({ success: true, data: { ...client.rows[0], sms: smsStats.rows[0], recent_sms: recentSms.rows } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/admin/tenants/:id - Update tenant settings
app.put('/api/admin/tenants/:id', auth, roles('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['company_name', 'contact_person', 'email', 'phone', 'address', 'country', 'balance', 'currency', 'credit_limit', 'billing_mode', 'status', 'api_enabled', 'max_tps'];
    const updates = [];
    const values = [];
    let idx = 1;
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(field + '=$' + idx);
        values.push(req.body[field]);
        idx++;
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });
    values.push(id);
    const r = await pool.query(
      'UPDATE clients SET ' + updates.join(',') + ', updated_at=NOW() WHERE id=$' + idx + ' RETURNING *',
      values
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Tenant not found' });
    res.json({ success: true, data: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/tenants/:id/toggle-active - Toggle tenant active status
app.post('/api/admin/tenants/:id/toggle-active', auth, roles('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
  "UPDATE clients SET status = CASE WHEN status='active' THEN 'inactive' ELSE 'active' END, updated_at=NOW() WHERE id=$1 RETURNING id, client_code, status",
      [id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Tenant not found' });
    res.json({ success: true, data: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/tenants/:id/toggle-api - Reset tenant API key
app.post('/api/admin/tenants/:id/toggle-api', auth, roles('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
      'UPDATE clients SET api_enabled = NOT api_enabled, updated_at=NOW() WHERE id=$1 RETURNING id, client_code, api_enabled',
      [id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Tenant not found' });
    res.json({ success: true, data: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/tenants/:id/adjust-balance - Adjust tenant balance
app.post('/api/admin/tenants/:id/adjust-balance', auth, roles('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;
    if (amount === undefined || typeof amount !== 'number') return res.status(400).json({ error: 'Amount must be a number' });
    const r = await pool.query(
      'UPDATE clients SET balance = balance + $1, updated_at=NOW() WHERE id=$2 RETURNING id, client_code, balance',
      [amount, id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Tenant not found' });
    pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'balance_adjustment', JSON.stringify({ client_id: id, amount, reason: reason || 'manual adjustment' })]
    ).catch(e => console.warn('[admin] audit log insert failed:', e.message));
    res.json({ success: true, data: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ===================== SUPER ADMIN: Services Management =====================

const SERVICE_REGISTRY = {
  'http': { name: 'HTTP API Server', pm2: 'net2app-hub', description: 'Main REST API and web server' },
  'sms': { name: 'SMS Gateway', pm2: 'net2app-hub', description: 'SMS sending and delivery' },
  'smpp': { name: 'SMPP Gateway', pm2: 'net2app-hub', description: 'SMPP protocol gateway' },
  'voiceotp': { name: 'Voice OTP', pm2: 'net2app-hub', description: 'Voice call OTP delivery via Asterisk' },
  'flash': { name: 'Flash SMS', pm2: 'net2app-hub', description: 'Flash/SIM SMS messaging' },
  'whatsapp': { name: 'WhatsApp', pm2: 'net2app-hub', description: 'WhatsApp messaging via Graph API' },
  'rch': { name: 'RCH Gateway', pm2: 'net2app-hub', description: 'RCH protocol gateway' },
  'proxy': { name: 'Proxy Manager', pm2: 'net2app-hub', description: 'Residential proxy and routing' },
};
const SERVICE_NAMES = Object.keys(SERVICE_REGISTRY);

// GET /api/admin/services - List all available services
app.get('/api/admin/services', auth, roles('super_admin'), async (req, res) => {
  try {
    const { stdout } = await execAsync('pm2 jlist');
    const processes = JSON.parse(stdout);
    
    const services = SERVICE_NAMES.map(key => {
      const svc = SERVICE_REGISTRY[key];
      const proc = processes.find(p => p.name === svc.pm2);
      return {
        id: key,
        name: svc.name,
        description: svc.description,
        pm2_process: svc.pm2,
        status: proc ? (proc.pm2_env?.status || 'unknown') : 'unknown',
        uptime: proc?.pm2_env?.pm_uptime || null,
        restarts: proc?.pm2_env?.restart_time || 0,
        cpu: proc?.monit?.cpu || 0,
        memory: proc?.monit?.memory || 0
      };
    });
    
    res.json({ success: true, data: services });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/services/restart-all - Restart all services
app.post('/api/admin/services/restart-all', auth, roles('super_admin'), async (req, res) => {
  try {
    const { stdout } = await execAsync('pm2 restart net2app-hub');
    res.json({ success: true, message: 'All services restart initiated', output: stdout });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/services/restart/:name - Restart a specific service
app.post('/api/admin/services/restart/:name', auth, roles('super_admin'), async (req, res) => {
  try {
    const name = sanitizePm2Name(req.params.name);
    const svc = SERVICE_REGISTRY[name];
    if (!svc) {
      return res.status(404).json({ error: 'Unknown service: ' + name + '. Available: ' + SERVICE_NAMES.join(', ') });
    }
    const { stdout } = await execAsync('pm2 restart ' + svc.pm2);
    res.json({ success: true, message: "Service '" + svc.name + "' (" + name + ") restart initiated", output: stdout });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===================== ALL OTHER CRUD (Generic) =====================
const tables = ['mccmnc','trunks','routes','route_plans','route_maps','payments','campaigns','translations','notifications','notification_templates','ott_devices','api_connectors','social_api_suppliers','voice_otp_configs','voice_otp_logs','license','tenants','platform_settings','smtp_config','audit_logs'];

tables.forEach(table => {
  app.get(`/api/${table}`, auth, async (req, res) => {
    try {
      const r = await pool.query(`SELECT * FROM ${table} ORDER BY id DESC LIMIT 500`);
      res.json({ success: true, data: r.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post(`/api/${table}`, auth, async (req, res) => {
    try {
      // Convert empty strings to null so INTEGER/FK columns don't choke
      const clean = {};
      for (const [k, v] of Object.entries(req.body)) {
        clean[k] = (v === '' || v === undefined) ? null : v;
      }
      const keys = Object.keys(clean);
      const vals = keys.map(k => clean[k]);
      const ph = keys.map((_, i) => '$' + (i + 1)).join(',');
      const r = await pool.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${ph}) RETURNING *`, vals);
      res.json({ success: true, data: r.rows[0] });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.put(`/api/${table}/:id`, auth, async (req, res) => {
    try {
      // Convert empty strings to null so INTEGER/FK columns don't choke
      const clean = {};
      for (const [k, v] of Object.entries(req.body)) {
        clean[k] = (v === '' || v === undefined) ? null : v;
      }
      const keys = Object.keys(clean);
      const sets = keys.map((k, i) => `${k}=$${i+1}`).join(',');
      const vals = keys.map(k => clean[k]);
      if (keys.length > 0) await pool.query(`UPDATE ${table} SET ${sets} WHERE id=$${keys.length+1}`, [...vals, req.params.id]);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.delete(`/api/${table}/:id`, auth, roles('super_admin','admin'), async (req, res) => {
    try {
      await pool.query(`DELETE FROM ${table} WHERE id=$1`, [req.params.id]);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
});

// SPA fallback — serve index.html for any non-API GET route so React Router handles it.
// Express 5 / path-to-regexp v8 does not accept bare '*'; use a regex route instead.
app.get(/^(?!\/(api|internal|uploads)\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ---------- BOOT ----------
(async () => {
  await bootstrapPasswordMigration(pool);
  try {
    const h = await bridge.health();
    if (h && h.ok) console.log(`[gateway] Java SMPP gateway reachable at ${bridge.base}`);
    else console.log(`[gateway] Java SMPP gateway NOT reachable at ${bridge.base} — SMPP will be unavailable`);
  } catch (e) { console.log('[gateway] health probe failed (non-fatal):', e.message); }

  // Auto-bind all active outbound SMPP suppliers on startup via Java 21 gateway.
  // Inbound suppliers (is_inbound=true) are skipped — they connect TO us.
  // Wrapped in a 120s total timeout so a stuck supplier doesn't delay
  // the entire startup indefinitely.
  try {
    const suppliers = await pool.query(
      "SELECT * FROM suppliers WHERE connection_type = 'smpp' AND is_inbound = false AND status = 'active'"
    );
    console.log(`[gateway] Auto-binding ${suppliers.rows.length} active outbound supplier(s) on startup...`);
    // === START LISTENING IMMEDIATELY — don't wait for auto-bind ===
    app.listen(PORT, () => {
      console.log(`NET2APP Hub running on port ${PORT}`);
      console.log(`DB: ${pool.options.database} on ${pool.options.host}:${pool.options.port}`);
    });

    // === Auto-bind runs asynchronously after server is up ===
    const AUTO_BIND_TIMEOUT_MS = 120_000;
    const TIMEOUT_SENTINEL = Symbol('auto-bind-timeout');
    const winner = await Promise.race([
      (async () => {
        for (const s of suppliers.rows) {
          try {
            const result = await performSupplierBind(s);
            if (result.ok) {
              console.log(`[gateway] Auto-bind OK: supplier ${s.id} (${s.supplier_code}) bound @ SMPP v${result.negotiatedVersion || 'auto'}`);
            } else {
              console.log(`[gateway] Auto-bind FAIL: supplier ${s.id} (${s.supplier_code}) — ${result.gatewayDown ? 'Java gateway unreachable' : 'supplier rejected bind'}`);
            }
          } catch (bindErr) {
            await pool.query("UPDATE suppliers SET bind_status='error' WHERE id=$1", [s.id])
              .catch(e => console.warn(`[gateway] Auto-bind DB error for supplier ${s.id}: ${e.message}`));
            console.warn(`[gateway] Auto-bind ERROR for supplier ${s.id}: ${bindErr.message}`);
          }
        }
        return 'completed';
      })(),
      new Promise(resolve => setTimeout(() => resolve(TIMEOUT_SENTINEL), AUTO_BIND_TIMEOUT_MS)),
    ]);
    if (winner === TIMEOUT_SENTINEL) {
      console.warn(`[gateway] Auto-bind TIMEOUT after ${AUTO_BIND_TIMEOUT_MS / 1000}s — remaining suppliers will not be bound at startup (background attempts continue)`);
    } else {
      console.log('[gateway] Startup auto-bind phase complete');
    }
  } catch (e) { console.warn('[gateway] auto-bind phase failed (non-fatal):', e.message); }
  // Run the multi-channel migration SQL idempotently (safe on every boot).
  try {
    const fsr = require('fs');
    const sql = fsr.readFileSync(path.join(__dirname, 'src', 'database', 'multi_channel_migrations.sql'), 'utf8');
    await pool.query(sql);
    console.log('[migrations] multi_channel_migrations.sql applied');
  } catch (e) { console.warn('[migrations] apply failed (non-fatal):', e.message); }
  // Start the 5-second voice-DLR retry poller.
  // Ensure mo_sms table exists (idempotent CREATE IF NOT EXISTS).
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mo_sms (
        id SERIAL PRIMARY KEY,
        channel VARCHAR(20) NOT NULL,
        external_id VARCHAR(100),
        sender VARCHAR(100),
        sender_name VARCHAR(255),
        recipient VARCHAR(100),
        message TEXT,
        message_type VARCHAR(30) DEFAULT 'text',
        metadata JSONB,
        reply_sent BOOLEAN DEFAULT false,
        reply_text TEXT,
        replied_at TIMESTAMPTZ,
        processed BOOLEAN DEFAULT false,
        received_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_mo_sms_channel ON mo_sms(channel);
      CREATE INDEX IF NOT EXISTS idx_mo_sms_received ON mo_sms(received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_mo_sms_external ON mo_sms(channel, external_id);
    `);
    console.log('[migrations] mo_sms table verified');
  } catch (e) { console.warn('[migrations] mo_sms table creation failed (non-fatal):', e.message); }
  startVoiceDlrPoller();
})().catch(e => { console.error('Boot failed:', e); process.exit(1); });
