// =====================================================================
// Security Middleware — Rate Limiting, Bot Blocking, IP Protection
// =====================================================================
// Protects the NET2APP Hub from scrapers, brute-force attacks, and
// automated abuse at the application layer. Works alongside nginx
// (which handles basic headers and connection-level filtering).
//
// Layers:
//   1. Helmet — secure HTTP headers (CSP, HSTS, etc.)
//   2. Bot Blocker — rejects known scraper/bot user agents at the door
//   3. API Rate Limiter — per-endpoint throttling (auth, SMS, billing)
//   4. General Rate Limiter — catch-all for unclassified routes
// =====================================================================

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// ═══════════════════════════════════════════════════════════════════
// 1. HELMET — Secure HTTP Headers
// ═══════════════════════════════════════════════════════════════════
// Adds: CSP, X-Frame-Options, X-Content-Type-Options, HSTS,
// Referrer-Policy, and more. Configured to allow inline styles/scripts
// needed by the React SPA.
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,       // allow audio uploads
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// ═══════════════════════════════════════════════════════════════════
// 2. BOT BLOCKER — Reject Common Scrapers & Bots
// ═══════════════════════════════════════════════════════════════════
// Blocks well-known scraper/bot user agents at the middleware level
// before they can hit any endpoint. Does NOT block legitimate search
// engine crawlers (Googlebot, Bingbot, etc.).
const BOT_PATTERNS = [
  // Aggressive scrapers / data harvesters
  /httrack/i, /scrapy/i, /wget/i, /python-requests/i, /python-urllib/i,
  /go-http-client/i, /axios/i, /node-fetch/i, /okhttp/i,
  // Common vulnerability scanners
  /nikto/i, /sqlmap/i, /nmap/i, /nessus/i, /openvas/i, /acunetix/i,
  /burpsuite/i, /zap/i, /wfuzz/i, /ffuf/i, /dirbuster/i, /gobuster/i,
  // Aggressive bots that ignore robots.txt
  /ahrefsbot/i, /semrushbot/i, /rogerbot/i, /dotbot/i,
  /mj12bot/i, /blexbot/i,
  // Email harvesters
  /harvest/i, /extractor/i, /grabber/i,
  // Generic script/bot identifiers
  /HeadlessChrome/i, /PhantomJS/i, /SlimerJS/i, /CasperJS/i,
];

function blockBots(req, res, next) {
  // Skip bot checks for robots.txt, favicon, and static assets
  const path = req.path || '';
  if (path === '/robots.txt' || path === '/favicon.ico' || path.startsWith('/assets/')) {
    return next();
  }
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  for (const pattern of BOT_PATTERNS) {
    if (pattern.test(ua)) {
      console.warn(`[security] blocked bot UA: "${ua.substring(0, 80)}" from ${req.ip}`);
      return res.status(403).json({ error: 'Automated access not permitted' });
    }
  }
  next();
}

// ═══════════════════════════════════════════════════════════════════
// 3. API RATE LIMITERS — Protect Specific Endpoints
// ═══════════════════════════════════════════════════════════════════

// --- Auth limiter: 10 attempts per IP per 15 minutes ---
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  keyGenerator: (req) => req.ip + '_auth',
});

// --- SMS send limiter: 60 per IP per minute ---
const smsSendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'SMS rate limit exceeded. Max 60/minute.' },
  keyGenerator: (req) => req.ip + '_sms_send',
});

// --- SMS test limiter: 10 per IP per minute (tighter for test endpoint) ---
const smsTestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Test SMS rate limit exceeded. Max 10/minute.' },
  keyGenerator: (req) => req.ip + '_sms_test',
});

// --- Billing/invoice limiter: 20 per IP per minute ---
const billingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Billing endpoint rate limit exceeded.' },
  keyGenerator: (req) => req.ip + '_billing',
});

// --- General API limiter: 200 per IP per minute (catch-all) ---
const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'API rate limit exceeded. Slow down.' },
  keyGenerator: (req) => req.ip,
});

// --- Voice OTP limiter: 30 per IP per minute ---
const voiceOtpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Voice OTP rate limit exceeded.' },
  keyGenerator: (req) => req.ip + '_voice_otp',
});

// --- Webhook limiter: 100 per IP per minute (external DLR pushes) ---
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Webhook rate limit exceeded.' },
  keyGenerator: (req) => req.ip + '_webhook',
});

// ═══════════════════════════════════════════════════════════════════
// 4. ATTACH ALL MIDDLEWARE TO THE APP
// ═══════════════════════════════════════════════════════════════════
function attachSecurityMiddleware(app) {
  // Layer 1: Helmet security headers (applied before all routes)
  app.use(helmetMiddleware);

  // Layer 2: Bot blocker (blocks scraper user agents)
  app.use(blockBots);

  // Layer 3: Per-endpoint rate limiters
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/', generalApiLimiter);
  app.use('/api/sms/send', smsSendLimiter);
  app.use('/api/sms/test', smsTestLimiter);
  app.use('/api/voice-otp/send', voiceOtpLimiter);
  app.use('/api/voice-otp/', generalApiLimiter);
  app.use('/api/billing/', billingLimiter);
  app.use('/api/invoices/', billingLimiter);
  app.use('/api/payments/', billingLimiter);
  app.use('/api/rates/', generalApiLimiter);
  app.use('/api/clients/', generalApiLimiter);
  app.use('/api/suppliers/', generalApiLimiter);
  app.use('/api/bind/', generalApiLimiter);
  app.use('/api/asterisk/', generalApiLimiter);
  app.use('/api/notifications/', generalApiLimiter);
  app.use('/api/email-templates/', generalApiLimiter);
  app.use('/api/translations/', generalApiLimiter);
  app.use('/api/ip-lists/', generalApiLimiter);
  app.use('/api/webhooks/', webhookLimiter);

  // Layer 4: General catch-all for any unclassified /api/ route
  app.use('/api/', generalApiLimiter);

  console.log('[security] Helmet + rate limiters + bot blocker active');
}

module.exports = { attachSecurityMiddleware };
