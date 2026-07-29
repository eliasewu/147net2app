import React, { useState } from 'react';
import { Card } from '../../components/UI/Card';
import { Badge } from '../../components/UI/Badge';
import { Copy, Check, Globe, Key, Lock, Send, BarChart3, RefreshCw, Code, Terminal, Server, Shield, ChevronDown, ChevronRight } from 'lucide-react';

// ============================================================
// REST API DOCUMENTATION
// Base URL: https://your-server.com/api/v1
// Auth: Bearer token (JWT) | X-API-Key header | SMPP username+password
// ============================================================

interface EndpointDoc {
  method: 'GET' | 'POST';
  path: string;
  title: string;
  desc: string;
  auth: string;
  curl: string;
  response: string;
  params?: { name: string; type: string; required: boolean; desc: string }[];
}

const API_ENDPOINTS: EndpointDoc[] = [
  // ─── AUTH ──────────────────────────────────────────────
  {
    method: 'POST', path: '/api/v1/auth/login', title: 'Login / Get Token',
    desc: 'Authenticate with your SMPP username and password to receive a JWT Bearer token. Also accepts platform user credentials (admin, support, billing roles).',
    auth: 'None (public)',
    curl: `curl -X POST https://your-server.com/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"username": "your_smpp_username", "password": "your_smpp_password"}'`,
    response: `{
  "success": true,
  "token": "eyJhbGciOi...",
  "client": {
    "id": 1,
    "client_code": "CLT001",
    "company_name": "TechCorp Global",
    "billing_mode": "dlr",
    "currency": "EUR"
  },
  "expires_in": "8h"
}`,
    params: [
      { name: 'username', type: 'string', required: true, desc: 'SMPP username (smpp_username from client account)' },
      { name: 'password', type: 'string', required: true, desc: 'SMPP password (smpp_password from client account)' },
    ]
  },
  {
    method: 'GET', path: '/api/v1/auth/verify', title: 'Verify Token',
    desc: 'Check if a JWT token is still valid and get its expiry information.',
    auth: 'Bearer token',
    curl: `curl https://your-server.com/api/v1/auth/verify \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"`,
    response: `{
  "success": true,
  "valid": true,
  "type": "client",
  "expires": "2026-07-10T08:00:00.000Z"
}`
  },
  {
    method: 'POST', path: '/api/v1/auth/refresh', title: 'Refresh Token',
    desc: 'Extend the expiry of an existing JWT token without re-login. Works up to 24 hours after the original token expired.',
    auth: 'Bearer token',
    curl: `curl -X POST https://your-server.com/api/v1/auth/refresh \\
  -H "Authorization: Bearer YOUR_EXPIRED_JWT"`,
    response: `{
  "success": true,
  "token": "eyJhbGciOi...",
  "client": { "id": 1, "client_code": "CLT001", "company_name": "TechCorp Global" },
  "expires_in": "8h"
}`
  },
  // ─── SMS ───────────────────────────────────────────────
  {
    method: 'POST', path: '/api/v1/sms/send', title: 'Send SMS',
    desc: 'Send an SMS message through the routing engine. Supports all channels: SMPP, HTTP, WhatsApp, Telegram, RCS, Voice OTP. Authentication via Bearer token, X-API-Key header, or username+password in body/query.',
    auth: 'Bearer token / X-API-Key / username+password',
    curl: `# Option A: Bearer Token
curl -X POST https://your-server.com/api/v1/sms/send \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "1234567890", "from": "NET2APP", "text": "Hello World"}'

# Option B: X-API-Key
curl -X POST https://your-server.com/api/v1/sms/send \\
  -H "X-API-Key: n2a_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "1234567890", "text": "Hello World"}'

# Option C: SMPP username+password (in body)
curl -X POST https://your-server.com/api/v1/sms/send \\
  -H "Content-Type: application/json" \\
  -d '{"username": "techcorp_smpp", "password": "secure123", "to": "1234567890", "text": "Hello World"}'`,
    response: `{
  "success": true,
  "data": {
    "message_id": "MSG1752086400000abc",
    "to": "1234567890",
    "from": "NET2APP",
    "text": "Hello World",
    "parts": 1,
    "rate": 0.0250,
    "supplier_rate": 0.0150,
    "profit": 0.0100,
    "currency": "EUR",
    "cost": 0.0250,
    "status": "submitted",
    "billing_mode": "dlr",
    "route": "Premium OTP Route",
    "submitted_at": "2026-07-09T12:00:00.000Z"
  },
  "quota": { "used": 42, "quota": 5000 }
}`,
    params: [
      { name: 'to', type: 'string', required: true, desc: 'Destination phone number (E.164 format recommended)' },
      { name: 'text', type: 'string', required: true, desc: 'Message body (160 char = 1 part for GSM7, 70 for Unicode)' },
      { name: 'from', type: 'string', required: false, desc: 'Sender ID / alphanumeric originator (defaults to SMPP username)' },
      { name: 'dlr_url', type: 'string', required: false, desc: 'Webhook URL for DLR callbacks' },
    ]
  },
  {
    method: 'GET', path: '/api/v1/sms/dlr/:messageId', title: 'Check DLR Status',
    desc: 'Query the delivery status of a previously sent message by its message_id.',
    auth: 'Bearer token / X-API-Key / username+password',
    curl: `curl "https://your-server.com/api/v1/sms/dlr/MSG1752086400000abc" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"`,
    response: `{
  "success": true,
  "data": {
    "message_id": "MSG1752086400000abc",
    "destination": "1234567890",
    "status": "delivered",
    "dlr_status": "DELIVRD",
    "dlr_timestamp": "2026-07-09T12:00:05.000Z",
    "submit_time": "2026-07-09T12:00:00.000Z",
    "delivery_time": "2026-07-09T12:00:05.000Z"
  }
}`
  },
  // ─── ACCOUNT ───────────────────────────────────────────
  {
    method: 'GET', path: '/api/v1/account/balance', title: 'Check Balance',
    desc: 'Get current account balance, credit limit, available funds, currency, and billing mode.',
    auth: 'Bearer token / X-API-Key / username+password',
    curl: `curl "https://your-server.com/api/v1/account/balance" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"`,
    response: `{
  "success": true,
  "data": {
    "balance": 5000.0000,
    "credit_limit": 10000.0000,
    "available": 15000.0000,
    "currency": "EUR",
    "billing_mode": "dlr"
  }
}`
  },
  {
    method: 'GET', path: '/api/v1/account/usage', title: 'API Usage Stats',
    desc: 'Get API key usage statistics: rate limit, daily quota, usage count, and remaining quota.',
    auth: 'Bearer token / X-API-Key / username+password',
    curl: `curl "https://your-server.com/api/v1/account/usage" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"`,
    response: `{
  "success": true,
  "data": {
    "api_key_prefix": "n2a_abc...",
    "rate_limit_tps": 10,
    "daily_quota": 5000,
    "used_today": 42,
    "remaining": 4958,
    "last_used": "2026-07-09T12:00:00.000Z"
  }
}`
  },
];

// Auth method badges
const AUTH_METHODS = [
  { icon: <Key size={16} />, title: 'Bearer Token (JWT)', desc: 'Obtain via POST /api/v1/auth/login using your SMPP credentials. Include as: Authorization: Bearer <token>', color: 'green' },
  { icon: <Shield size={16} />, title: 'X-API-Key Header', desc: 'Static API key generated in the platform. Include as: X-API-Key: n2a_xxxxxxxxxxxxxxxx', color: 'blue' },
  { icon: <Lock size={16} />, title: 'Username + Password', desc: 'Your SMPP username and password, sent in the request body (username/password fields) or query string.', color: 'purple' },
];

// Status codes
const STATUS_CODES = [
  { code: 200, desc: 'Success — request processed' },
  { code: 400, desc: 'Bad Request — missing required fields (to, text) or no-profit route' },
  { code: 401, desc: 'Unauthorized — invalid or missing credentials' },
  { code: 402, desc: 'Payment Required — insufficient balance' },
  { code: 403, desc: 'Forbidden — IP blacklisted or account inactive' },
  { code: 422, desc: 'Unprocessable — destination not reachable via requested channel' },
  { code: 429, desc: 'Too Many Requests — rate limit or daily quota exceeded' },
  { code: 500, desc: 'Internal Server Error' },
];

// SMS statuses
const SMS_STATUSES = [
  { status: 'submitted', desc: 'Message accepted and queued for routing' },
  { status: 'sent', desc: 'Message dispatched to supplier gateway' },
  { status: 'delivered', desc: 'DLR received — message delivered to handset' },
  { status: 'failed', desc: 'Delivery failed — check error_code and error_message' },
  { status: 'expired', desc: 'Message validity period expired before delivery' },
  { status: 'rejected', desc: 'Message rejected by supplier or platform' },
];

// Billing modes
const BILLING_MODES = [
  { mode: 'submit', desc: 'Charged immediately when message is submitted (credit deducted upfront)' },
  { mode: 'dlr', desc: 'Charged only when DLR confirms DELIVRD (credit deducted on delivery confirmation)' },
];

// Rate limiting
const RATE_LIMITS = [
  { label: 'Per-client TPS', value: 'Configurable per API key (default 10 TPS) - token bucket algorithm' },
  { label: 'Daily Quota', value: 'Configurable per API key (default 5,000 SMS/day) - resets at midnight UTC' },
  { label: 'Response Headers', value: 'Retry-After header returned on 429 responses (seconds until next token)' },
];

const METHOD_COLORS: Record<string, 'success' | 'info' | 'warning' | 'danger'> = { GET: 'success', POST: 'info', PUT: 'warning', DELETE: 'danger' };

// Tailwind JIT cannot resolve dynamic classes from template literals.
// Use hardcoded color maps instead.
const AUTH_CARD_COLORS: Record<string, { border: string; bg: string; iconBg: string }> = {
  green:  { border: 'border-green-200',  bg: 'bg-green-50/50',  iconBg: 'bg-green-100' },
  blue:   { border: 'border-blue-200',   bg: 'bg-blue-50/50',   iconBg: 'bg-blue-100' },
  purple: { border: 'border-purple-200', bg: 'bg-purple-50/50', iconBg: 'bg-purple-100' },
};

export const ApiDocs: React.FC = () => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['auth', 'endpoints', 'sms-lifecycle']));

  const toggleSection = (s: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const copyCurl = (idx: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const Section = ({ id, title, icon, children }: { id: string; title: string; icon: React.ReactNode; children: React.ReactNode }) => {
    const expanded = expandedSections.has(id);
    return (
      <Card className="overflow-hidden">
        <button onClick={() => toggleSection(id)} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-blue-600">{icon}</span>
            <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          </div>
          {expanded ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
        </button>
        {expanded && <div className="px-5 pb-5 border-t border-gray-100 pt-4">{children}</div>}
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">REST API Documentation</h1>
          <p className="text-gray-500 mt-1">Send SMS, check balance, and manage your account via the REST API</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info">v1</Badge>
          <Badge variant="success">Production Ready</Badge>
        </div>
      </div>

      {/* Base URL & Quick Info */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><Globe size={20} className="text-blue-600" /></div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Base URL</p>
              <p className="text-sm font-mono text-gray-500 mt-0.5">https://your-server.com/api/v1</p>
              <p className="text-xs text-gray-400 mt-0.5">Replace with your server's domain/IP</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-100 rounded-lg"><Terminal size={20} className="text-green-600" /></div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Content Type</p>
              <p className="text-sm font-mono text-gray-500 mt-0.5">application/json</p>
              <p className="text-xs text-gray-400 mt-0.5">All requests & responses are JSON</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-100 rounded-lg"><Server size={20} className="text-purple-600" /></div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Character Encoding</p>
              <p className="text-sm font-mono text-gray-500 mt-0.5">UTF-8</p>
              <p className="text-xs text-gray-400 mt-0.5">GSM-7 for ASCII, UCS-2 for Unicode</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Authentication Section */}
      <Section id="auth" title="Authentication" icon={<Lock size={20} />}>
        <p className="text-gray-600 mb-4 text-sm">
          The REST API supports <strong>three authentication methods</strong>. Use any one — they are checked in order: Bearer token → X-API-Key → username+password.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {AUTH_METHODS.map((m, i) => {
            const colors = AUTH_CARD_COLORS[m.color] || AUTH_CARD_COLORS.blue;
            return (
            <div key={i} className={`p-4 rounded-xl border-2 ${colors.border} ${colors.bg}`}>
              <div className={`p-2 rounded-lg ${colors.iconBg} inline-block mb-2`}>
                {m.icon}
              </div>
              <p className="font-semibold text-sm text-gray-800 mb-1">{m.title}</p>
              <p className="text-xs text-gray-600">{m.desc}</p>
            </div>
            );
          })}
        </div>
        <div className="mt-4 bg-blue-50 p-4 rounded-lg text-sm">
          <p className="font-semibold text-blue-800 mb-1">💡 Pro Tip</p>
          <p className="text-blue-700 text-xs">
            For production use, obtain a JWT token via <code className="bg-blue-100 px-1 rounded">POST /api/v1/auth/login</code> and include it as <code className="bg-blue-100 px-1 rounded">Authorization: Bearer &lt;token&gt;</code>. 
            The SMPP username and password you use for SMPP connections are the same credentials for the REST API. 
            Tokens expire after 8 hours — use <code className="bg-blue-100 px-1 rounded">POST /api/v1/auth/refresh</code> to extend.
          </p>
        </div>
      </Section>

      {/* Endpoints Section */}
      <Section id="endpoints" title="API Endpoints" icon={<Send size={20} />}>
        <div className="space-y-4">
          {API_ENDPOINTS.map((ep, idx) => (
            <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Endpoint Header */}
              <div className="flex items-start gap-3 p-4 bg-gray-50 border-b border-gray-200">
                <Badge variant={METHOD_COLORS[ep.method]}>{ep.method}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm">{ep.title}</p>
                  <p className="text-xs font-mono text-blue-600 mt-0.5">{ep.path}</p>
                  <p className="text-xs text-gray-500 mt-1">{ep.desc}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-gray-400">Auth:</span>
                    <Badge variant="default" size="sm">{ep.auth}</Badge>
                  </div>
                </div>
              </div>

              {/* Parameters */}
              {ep.params && ep.params.length > 0 && (
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Parameters</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-400">
                        <th className="pb-1 pr-2">Name</th>
                        <th className="pb-1 pr-2">Type</th>
                        <th className="pb-1 pr-2">Required</th>
                        <th className="pb-1">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ep.params.map((p, pi) => (
                        <tr key={pi} className="border-t border-gray-50">
                          <td className="py-1.5 pr-2 font-mono text-blue-600">{p.name}</td>
                          <td className="py-1.5 pr-2 text-gray-500">{p.type}</td>
                          <td className="py-1.5 pr-2">{p.required ? <Badge variant="danger" size="sm">Yes</Badge> : <span className="text-gray-400">No</span>}</td>
                          <td className="py-1.5 text-gray-600">{p.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* cURL Example */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Code size={14} className="text-gray-400" />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">cURL Example</span>
                  </div>
                  <button
                    onClick={() => copyCurl(idx, ep.curl)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    {copiedIndex === idx ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                    <span>{copiedIndex === idx ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="bg-gray-900 text-green-400 p-3 rounded-lg text-xs overflow-x-auto font-mono leading-relaxed">
                  {ep.curl}
                </pre>
              </div>

              {/* Response */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Response (200 OK)</span>
                </div>
                <pre className="bg-gray-50 border border-gray-200 p-3 rounded-lg text-xs overflow-x-auto font-mono leading-relaxed text-gray-700">
                  {ep.response}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* SMS Lifecycle Section */}
      <Section id="sms-lifecycle" title="SMS Lifecycle & Billing" icon={<RefreshCw size={20} />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">SMS Status Flow</h3>
            <div className="space-y-2">
              {SMS_STATUSES.map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <Badge variant={s.status === 'delivered' ? 'success' : s.status === 'failed' || s.status === 'rejected' || s.status === 'expired' ? 'danger' : 'warning'} size="sm">{s.status}</Badge>
                  <span className="text-xs text-gray-600">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Billing Modes</h3>
            <div className="space-y-3">
              {BILLING_MODES.map((b, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-lg">
                  <Badge variant={b.mode === 'submit' ? 'warning' : 'info'} size="sm">{b.mode.toUpperCase()}</Badge>
                  <p className="text-xs text-gray-600 mt-1.5">{b.desc}</p>
                </div>
              ))}
            </div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 mt-4">Route Resolution</h3>
            <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
              <p className="mb-1">Messages are routed through the platform's routing engine:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-gray-500">
                <li>Client's routing plan → routes → trunks → supplier</li>
                <li>MCCMNC destination matching for rate lookup</li>
                <li>Profit check (client rate must be &gt; supplier rate)</li>
                <li>Balance verification before dispatch</li>
                <li>Channel dispatch (SMPP / HTTP / WhatsApp / Telegram / Voice OTP)</li>
              </ol>
            </div>
          </div>
        </div>
      </Section>

      {/* Rate Limiting Section */}
      <Section id="rate-limiting" title="Rate Limits & Quotas" icon={<BarChart3 size={20} />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {RATE_LIMITS.map((r, i) => (
            <div key={i} className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm font-semibold text-gray-700 mb-1">{r.label}</p>
              <p className="text-xs text-gray-600">{r.value}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* HTTP Status Codes Section */}
      <Section id="status-codes" title="HTTP Status Codes" icon={<Server size={20} />}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {STATUS_CODES.map((s, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
              <Badge variant={s.code < 300 ? 'success' : s.code < 500 ? 'warning' : 'danger'} size="sm">{s.code}</Badge>
              <span className="text-xs text-gray-600">{s.desc}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Footer */}
      <div className="text-center py-6">
        <p className="text-xs text-gray-400">
          NET2APP Hub REST API v1 • Base URL: https://your-server.com/api/v1 • 
          All requests use JSON • Authentication via Bearer token, API key, or SMPP credentials
        </p>
      </div>
    </div>
  );
};
