import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit, Trash2, TestTube, Zap, MessageCircle, Smartphone, Loader2, Download, Globe, Send, RefreshCw, Wand2, X } from 'lucide-react';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { Badge } from '../../components/UI/Badge';
import { Modal } from '../../components/UI/Modal';
import { Input, Select, Textarea } from '../../components/UI/Input';
import { Table } from '../../components/UI/Table';
import { api } from '../../services/api';

interface ApiConnector {
  id: string;
  name: string;
  provider: string;
  region: string;
  auth_type: string;
  http_method: string;
  api_key: string;
  api_secret?: string;
  send_url: string;
  dlr_url: string;
  submit_pattern: string;
  dlr_pattern: string;
  dlr_value: string;
  params: string;
  send_body_template?: string;
  send_response_pattern?: string;
  dlr_query_url?: string;
  dlr_query_params?: string;
  dlr_response_pattern?: string;
  dlr_status_mapping?: Record<string, string>;
  is_active: boolean;
  connector_type?: 'http' | 'rcs' | 'flash_sms';
  connection_status?: string;
}

const KNOWN_PROVIDERS = [
  'Twilio', 'Vonage', 'Infobip', 'Sinch', 'MessageBird', 'Plivo', 'Bandwidth',
  'Telnyx', 'ClickSend', 'BulkSMS', 'Textlocal', 'Clickatell', 'Routee',
  'MSG91', 'Gupshup', 'SSL Wireless', 'BulkSMSBD', 'Unifonic', 'CEQUENS',
  'Link Mobility', 'Google Jibe', 'Samsung', 'Vodafone', 'Orange', 'Telefonica',
  'T-Mobile', 'CM.com', 'Mitto', 'Borno',
];

const REGIONS = ['Global', 'Europe', 'India', 'Bangladesh', 'Middle East', 'Africa', 'Asia', 'Americas'];

const BULK_IMPORT_CONNECTORS: Array<any> = [
  { name: 'Vonage SMS', provider: 'Vonage', region: 'Global', auth_type: 'API_KEY', http_method: 'POST', send_url: 'https://rest.nexmo.com/sms/json', dlr_url: '', submit_pattern: '"status":"0"', dlr_pattern: '"status":"delivered"', dlr_value: 'delivered', params: 'to,from,text,api_key,api_secret', connector_type: 'http' },
  { name: 'Twilio SMS', provider: 'Twilio', region: 'Global', auth_type: 'BASIC', http_method: 'POST', send_url: 'https://api.twilio.com/2010-04-01/Accounts/{{account_sid}}/Messages.json', dlr_url: '', submit_pattern: '"status":"queued"', dlr_pattern: '"status":"delivered"', dlr_value: 'delivered', params: 'To,From,Body', connector_type: 'http' },
  { name: 'Infobip SMS', provider: 'Infobip', region: 'Global', auth_type: 'BEARER', http_method: 'POST', send_url: 'https://api.infobip.com/sms/2/text/advanced', dlr_url: '', submit_pattern: '"status":"PENDING"', dlr_pattern: '"status":"DELIVERED"', dlr_value: 'DELIVERED', params: 'to,from,text', connector_type: 'http' },
  { name: 'Sinch SMS', provider: 'Sinch', region: 'Global', auth_type: 'BEARER', http_method: 'POST', send_url: 'https://sms.api.sinch.com/xms/v1/{{service_plan_id}}/batches', dlr_url: '', submit_pattern: '"accepted"', dlr_pattern: '"status":"Delivered"', dlr_value: 'Delivered', params: 'to,from,body', connector_type: 'http' },
  { name: 'MessageBird', provider: 'MessageBird', region: 'Global', auth_type: 'API_KEY', http_method: 'POST', send_url: 'https://rest.messagebird.com/messages', dlr_url: '', submit_pattern: '"status":"sent"', dlr_pattern: '"status":"delivered"', dlr_value: 'delivered', params: 'recipients,originator,body', connector_type: 'http' },
  { name: 'Borno Voice OTP', provider: 'Borno', region: 'Bangladesh', auth_type: 'API_KEY', http_method: 'GET', send_url: 'https://backborno.xyz/voice_otp.php', dlr_url: '', submit_pattern: '"status":"success"', dlr_pattern: '"status":"delivered"', dlr_value: 'delivered', params: 'apiKey,msisdn,code', send_response_pattern: '"transaction_id":"([^"]+)"', dlr_query_url: 'https://backborno.xyz/check_delivery_otp.php', dlr_query_params: 'apiKey,trans_id', connector_type: 'http' },
];

export const APIConnectors: React.FC = () => {
  const [connectors, setConnectors] = useState<ApiConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'http' | 'rcs' | 'flash_sms' | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ApiConnector | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  // Test response viewer state
  const [testSendResponse, setTestSendResponse] = useState<any>(null);
  const [testDlrResponse, setTestDlrResponse] = useState<any>(null);
  const [testSendLoading, setTestSendLoading] = useState(false);
  const [testDlrLoading, setTestDlrLoading] = useState(false);
  // Auto-fill URL state
  const [autoFillUrl, setAutoFillUrl] = useState('');
  const [dlrMappingRows, setDlrMappingRows] = useState<Array<{ key: string; value: string }>>([]);

  const [form, setForm] = useState({
    name: '', provider: '', region: 'Global', auth_type: 'API_KEY', http_method: 'POST',
    api_key: '', send_url: '', dlr_url: '', submit_pattern: '', dlr_pattern: '', dlr_value: 'delivered',
    params: '', is_active: true, connector_type: 'http' as ApiConnector['connector_type'],
    send_body_template: '', send_response_pattern: '',
    dlr_query_url: '', dlr_query_params: '', dlr_response_pattern: '',
    dlr_status_mapping: {} as Record<string, string>,
  });

  // ===================== FETCH =====================
  const fetchConnectors = useCallback(async () => {
    try {
      const r = await api.get('/api-connectors');
      if (r?.success && Array.isArray(r.data)) {
        setConnectors(r.data.map((c: any) => ({
          ...c, id: String(c.id),
          connector_type: c.connector_type || 'http',
          connection_status: c.connection_status || 'untested',
          dlr_status_mapping: c.dlr_status_mapping || { delivered: 'DELIVRD', failed: 'UNDELIV' },
        })));
      }
    } catch (e) { console.error('fetchConnectors:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConnectors(); }, [fetchConnectors]);

  // ===================== BULK IMPORT =====================
  const handleBulkImport = async () => {
    setImporting(true);
    setImportProgress({ done: 0, total: BULK_IMPORT_CONNECTORS.length });
    let imported = 0, skipped = 0;
    for (const conn of BULK_IMPORT_CONNECTORS) {
      try {
        await api.post('/api-connectors', {
          name: conn.name, provider: conn.provider, connector_type: conn.connector_type,
          region: conn.region, auth_type: conn.auth_type, http_method: conn.http_method,
          send_url: conn.send_url, dlr_url: conn.dlr_url || null,
          submit_pattern: conn.submit_pattern || null, dlr_pattern: conn.dlr_pattern || null,
          dlr_value: conn.dlr_value || null, params: conn.params || null, is_active: true,
          send_response_pattern: conn.send_response_pattern || null,
          dlr_query_url: conn.dlr_query_url || null,
          dlr_query_params: conn.dlr_query_params || null,
        });
        imported++;
      } catch (e: any) {
        if (e?.response?.status === 409 || e?.message?.includes('duplicate')) skipped++;
      }
      setImportProgress({ done: imported + skipped, total: BULK_IMPORT_CONNECTORS.length });
    }
    setImporting(false);
    await fetchConnectors();
  };

  // ===================== SMART AUTO-FILL: parse URL + fire real request =====================
  const [autoFillLoading, setAutoFillLoading] = useState(false);

  // Detect whether a URL is a send URL or a DLR query URL from path + param keywords
  const detectUrlType = (urlObj: URL): 'send' | 'dlr' => {
    const path = urlObj.pathname.toLowerCase();
    const dlrPathKeywords = ['dlr', 'check_delivery', 'check_status', 'status_check', 'callback'];
    if (dlrPathKeywords.some(k => path.includes(k))) return 'dlr';
    // Check params: if only has trans_id/msg_id without msisdn/to/text, it's likely DLR
    const paramNames: string[] = [];
    urlObj.searchParams.forEach((_, key) => paramNames.push(key.toLowerCase()));
    const hasDlrParams = paramNames.some(p => ['trans_id', 'transid', 'msg_id', 'message_id', 'msgid'].includes(p));
    const hasSendParams = paramNames.some(p => ['msisdn', 'to', 'phone', 'number', 'destination', 'text', 'message', 'code', 'body', 'sms'].includes(p));
    if (hasDlrParams && !hasSendParams) return 'dlr';
    return 'send';
  };

  const handleSmartAutoFill = async () => {
    if (!autoFillUrl.trim()) return;
    setAutoFillLoading(true);
    setError(null);

    // Parse URL once
    const urlStr = autoFillUrl.trim();
    let urlObj: URL;
    try {
      urlObj = new URL(urlStr);
    } catch {
      setAutoFillLoading(false);
      setError('Invalid URL format');
      return;
    }

    const urlType = detectUrlType(urlObj);
    const origin = urlObj.origin;
    const pathname = urlObj.pathname;
    const host = urlObj.hostname.toLowerCase();
    let newForm = { ...form };

    // Detect API key
    urlObj.searchParams.forEach((val, key) => {
      const k = key.toLowerCase();
      if ((k.includes('api') || k.includes('key') || k.includes('token') || k.includes('auth')) && val && !newForm.api_key) {
        newForm.api_key = val;
      }
    });

    // Auto-detect provider + name
    const providerMatch = KNOWN_PROVIDERS.find(p => host.includes(p.toLowerCase().replace(/\s/g, '')));
    if (providerMatch) newForm.provider = providerMatch;
    if (!newForm.name) newForm.name = host.replace(/^www\./, '').split('.')[0];

    if (urlType === 'dlr') {
      // ===== DLR URL detected =====
      newForm.dlr_query_url = origin + pathname;
      const dlrParams: string[] = [];
      urlObj.searchParams.forEach((_, key) => {
        const k = key.toLowerCase();
        if (k === 'trans_id' || k === 'transid') {
          dlrParams.push(key + '={{message_id}}');
        } else if (!k.includes('api') && !k.includes('key') && !k.includes('token') && !k.includes('auth')) {
          dlrParams.push(key);
        } else {
          dlrParams.push(key);
        }
      });
      newForm.dlr_query_params = dlrParams.join(',');

      // DLR queries are typically GET
      newForm.http_method = 'GET';
      // Also suggest send URL from same domain if not already set
      if (!newForm.send_url) newForm.send_url = origin + '/voice_otp.php';

      // Fire test-dlr to detect DLR response pattern
      try {
        const r = await api.post('/api-connectors/test-dlr', {
          dlr_query_url: newForm.dlr_query_url,
          dlr_query_params: newForm.dlr_query_params,
          api_key: newForm.api_key,
          auth_type: newForm.auth_type,
        });

        if (r?.response?.body) {
          const respBody = typeof r.response.body === 'string' ? r.response.body : JSON.stringify(r.response.body);
          // Detect DLR response pattern from status field
          if (/"status"\s*:\s*"(delivered|DELIVRD|success|ok|sent|completed)"/i.test(respBody)) {
            const m = respBody.match(/"status"\s*:\s*"(\w+)"/i);
            if (m) newForm.dlr_response_pattern = `"status":"${m[1]}"`;
          }
          setTestDlrResponse({ ...r, auto_detected: true });
        }

        setForm(newForm);
        setError('✅ DLR URL detected — auto-filled DLR Query section (status: ' + (r?.response?.status || 'N/A') + ', ' + (r?.latency_ms || 'N/A') + 'ms)');
        setTimeout(() => setError(null), 6000);
      } catch (e: any) {
        setForm(newForm);
        setError('⚠️ DLR URL parsed but test request failed: ' + (e.message || 'network error') + '. Patterns not auto-detected.');
        setTimeout(() => setError(null), 6000);
      }

    } else {
      // ===== Send SMS URL detected (existing logic) =====
      newForm.send_url = origin + pathname;
      if (urlStr.includes('?') && urlObj.searchParams.toString().length > 2) {
        newForm.http_method = 'GET';
      }

      const paramsList: string[] = [];
      urlObj.searchParams.forEach((val, key) => {
        const k = key.toLowerCase();
        if (k.includes('api') || k.includes('key') || k.includes('token') || k.includes('auth')) {
          if (!newForm.api_key && val) newForm.api_key = val;
          paramsList.push(key);
        } else if (k.includes('msisdn') || k.includes('to') || k.includes('phone') || k.includes('number') || k.includes('destination')) {
          paramsList.push(key);
        } else if (k.includes('text') || k.includes('msg') || k.includes('message') || k.includes('code') || k.includes('body') || k.includes('sms')) {
          paramsList.push(key);
        } else if (k.includes('from') || k.includes('sender') || k.includes('originator') || k.includes('source')) {
          paramsList.push(key);
        } else {
          paramsList.push(key);
        }
      });
      if (paramsList.length > 0) newForm.params = paramsList.join(',');

      // Fire a real request to detect patterns
      try {
        const r = await api.post('/api-connectors/test-send', {
          send_url: newForm.send_url,
          http_method: newForm.http_method,
          api_key: newForm.api_key,
          auth_type: newForm.auth_type,
          params: newForm.params,
        });

        if (r?.response?.body) {
          const respBody = typeof r.response.body === 'string' ? r.response.body : JSON.stringify(r.response.body);

          // Auto-detect submit_pattern
          if (/"status"\s*:\s*"(success|ok|queued|accepted|sent|submitted)"/i.test(respBody)) {
            const m = respBody.match(/"status"\s*:\s*"(\w+)"/i);
            if (m) newForm.submit_pattern = `"status":"${m[1]}"`;
          } else if (/"ok"\s*:\s*true/i.test(respBody)) {
            newForm.submit_pattern = '"ok":true';
          } else if (r.response.status >= 200 && r.response.status < 300) {
            newForm.submit_pattern = `HTTP ${r.response.status}`;
          }

          // Auto-detect send_response_pattern (message ID extraction)
          const idPatterns = [
            { regex: /"transaction_id"\s*:\s*"([^"]+)"/i, label: 'transaction_id' },
            { regex: /"message_id"\s*:\s*"([^"]+)"/i, label: 'message_id' },
            { regex: /"msgid"\s*:\s*"([^"]+)"/i, label: 'msgid' },
            { regex: /"id"\s*:\s*"([^"]+)"/i, label: 'id' },
            { regex: /"call_id"\s*:\s*"([^"]+)"/i, label: 'call_id' },
            { regex: /"reference"\s*:\s*"([^"]+)"/i, label: 'reference' },
          ];
          for (const p of idPatterns) {
            const m = respBody.match(p.regex);
            if (m) {
              newForm.send_response_pattern = `"${p.label}":"([^"]+)"`;
              break;
            }
          }

          // Auto-detect DLR URL from response body
          const dlrUrlMatch = respBody.match(/"(?:dlr_url|callback_url|webhook_url|status_url)"\s*:\s*"([^"]+)"/i);
          if (dlrUrlMatch && !newForm.dlr_query_url) {
            newForm.dlr_query_url = dlrUrlMatch[1];
          }

          // If no DLR URL detected, suggest from same domain using common paths
          if (!newForm.dlr_query_url) {
            const dlrCandidates = [
              origin + '/check_delivery_otp.php',
              origin + '/dlr_query.php',
              origin + '/dlr.php',
              origin + '/status.php',
              origin + '/api/dlr',
            ];
            newForm.dlr_query_url = dlrCandidates[0];
          }

          setTestSendResponse({ ...r, auto_detected: true });
        }

        setForm(newForm);
        setError('✅ Send URL auto-filled + DLR URL suggested (status: ' + (r?.response?.status || 'N/A') + ', ' + (r?.latency_ms || 'N/A') + 'ms)');
        setTimeout(() => setError(null), 6000);
      } catch (e: any) {
        setForm(newForm);
        setError('⚠️ URL parsed but test request failed: ' + (e.message || 'network error') + '. Patterns not auto-detected.');
        setTimeout(() => setError(null), 6000);
      }
    }

    setAutoFillLoading(false);
  };

  // ===================== DERIVED DATA =====================
  const tabConnectors = activeTab === 'all' ? connectors : connectors.filter(c => c.connector_type === activeTab);
  const filtered = tabConnectors.filter(c =>
    (c.name.toLowerCase().includes(search.toLowerCase()) || c.provider.toLowerCase().includes(search.toLowerCase())) &&
    (regionFilter === 'all' || c.region === regionFilter)
  );
  const counts = {
    http: connectors.filter(c => c.connector_type === 'http' || !c.connector_type).length,
    rcs: connectors.filter(c => c.connector_type === 'rcs').length,
    flash_sms: connectors.filter(c => c.connector_type === 'flash_sms').length,
    total: connectors.length, active: connectors.filter(c => c.is_active).length,
    connected: connectors.filter(c => c.connection_status === 'connected').length,
  };

  // ===================== MODAL =====================
  const openModal = (conn?: ApiConnector) => {
    if (conn) {
      setEditing(conn);
      setForm({
        name: conn.name, provider: conn.provider, region: conn.region, auth_type: conn.auth_type,
        http_method: conn.http_method, api_key: conn.api_key || '', send_url: conn.send_url,
        dlr_url: conn.dlr_url || '', submit_pattern: conn.submit_pattern || '',
        dlr_pattern: conn.dlr_pattern || '', dlr_value: conn.dlr_value || 'delivered',
        params: conn.params || '', is_active: conn.is_active,
        connector_type: conn.connector_type || 'http',
        send_body_template: conn.send_body_template || '',
        send_response_pattern: conn.send_response_pattern || '',
        dlr_query_url: conn.dlr_query_url || '',
        dlr_query_params: conn.dlr_query_params || '',
        dlr_response_pattern: conn.dlr_response_pattern || '',
        dlr_status_mapping: conn.dlr_status_mapping || { delivered: 'DELIVRD', failed: 'UNDELIV' },
      });
      const dm = conn.dlr_status_mapping || { delivered: 'DELIVRD', failed: 'UNDELIV' };
      setDlrMappingRows(Object.entries(dm).map(([k, v]) => ({ key: k, value: v })));
    } else {
      setEditing(null);
      setForm({
        name: '', provider: '', region: 'Global', auth_type: 'API_KEY', http_method: 'POST',
        api_key: '', send_url: '', dlr_url: '', submit_pattern: '', dlr_pattern: '',
        dlr_value: 'delivered', params: '', is_active: true,
        connector_type: activeTab === 'all' ? 'http' : activeTab,
        send_body_template: '', send_response_pattern: '',
        dlr_query_url: '', dlr_query_params: '', dlr_response_pattern: '',
        dlr_status_mapping: { delivered: 'DELIVRD', failed: 'UNDELIV' },
      });
      setDlrMappingRows([{ key: 'delivered', value: 'DELIVRD' }, { key: 'failed', value: 'UNDELIV' }]);
    }
    setAutoFillUrl('');
    setTestSendResponse(null);
    setTestDlrResponse(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.send_url) return;
    setSaving(true);
    try {
      const mapping: Record<string, string> = {};
      dlrMappingRows.forEach(r => { if (r.key.trim()) mapping[r.key.trim()] = r.value.trim(); });

      const payload: any = {
        name: form.name || form.provider || 'Unnamed',
        provider: form.provider || form.name || 'Unknown',
        connector_type: form.connector_type,
        region: form.region, auth_type: form.auth_type, http_method: form.http_method,
        api_key: form.api_key,
        send_url: form.send_url,
        dlr_url: form.dlr_url || null,
        submit_pattern: form.submit_pattern || null,
        dlr_pattern: form.dlr_pattern || null,
        dlr_value: form.dlr_value || null,
        params: form.params || null,
        send_body_template: form.send_body_template || null,
        send_response_pattern: form.send_response_pattern || null,
        dlr_query_url: form.dlr_query_url || null,
        dlr_query_params: form.dlr_query_params || null,
        dlr_response_pattern: form.dlr_response_pattern || null,
        dlr_status_mapping: Object.keys(mapping).length > 0 ? mapping : null,
        is_active: form.is_active,
      };

      if (editing) {
        await api.put(`/api-connectors/${editing.id}`, payload);
      } else {
        await api.post('/api-connectors', payload);
      }
      setShowModal(false);
      await fetchConnectors();
    } catch (e: any) { setError('Save failed: ' + (e.message || 'Unknown error')); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try { await api.delete(`/api-connectors/${id}`); await fetchConnectors(); }
    catch (e: any) { setError('Delete failed: ' + (e.message || 'Unknown error')); }
  };

  const handleTest = async (conn: ApiConnector) => {
    const id = conn.id;
    setConnectors(prev => prev.map(c => c.id === id ? { ...c, connection_status: 'testing' } : c));
    try {
      const r = await api.post(`/api-connectors/${id}/test`, {});
      const ok = r?.success === true || r?.connected === true;
      setConnectors(prev => prev.map(c => c.id === id ? { ...c, connection_status: ok ? 'connected' : 'failed' } : c));
      setTestResults(prev => ({ ...prev, [id]: { ok, msg: r?.message || r?.msg || (ok ? 'Connected' : 'Failed') } }));
    } catch (e: any) {
      setConnectors(prev => prev.map(c => c.id === id ? { ...c, connection_status: 'failed' } : c));
      setTestResults(prev => ({ ...prev, [id]: { ok: false, msg: e.message || 'Test failed' } }));
    } finally { await fetchConnectors(); }
  };

  // ===================== TEST SEND SMS (inline) =====================
  const handleTestSend = async () => {
    setTestSendLoading(true);
    setTestSendResponse(null);
    try {
      const r = await api.post('/api-connectors/test-send', {
        send_url: form.send_url,
        http_method: form.http_method,
        send_body_template: form.send_body_template,
        submit_pattern: form.submit_pattern,
        api_key: form.api_key,
        auth_type: form.auth_type,
        params: form.params,
      });
      setTestSendResponse(r);
    } catch (e: any) {
      setTestSendResponse({ success: false, error: e.message || 'Request failed' });
    } finally { setTestSendLoading(false); }
  };

  // ===================== TEST DLR QUERY (inline) =====================
  const handleTestDlr = async () => {
    setTestDlrLoading(true);
    setTestDlrResponse(null);
    try {
      const r = await api.post('/api-connectors/test-dlr', {
        dlr_query_url: form.dlr_query_url,
        dlr_query_params: form.dlr_query_params,
        dlr_response_pattern: form.dlr_response_pattern,
        api_key: form.api_key,
        auth_type: form.auth_type,
      });
      setTestDlrResponse(r);
    } catch (e: any) {
      setTestDlrResponse({ success: false, error: e.message || 'Request failed' });
    } finally { setTestDlrLoading(false); }
  };

  // ===================== TABLE COLUMNS =====================
  const columns: any[] = [
    { key: 'name', header: 'Connector', render: (c: ApiConnector) => <div><p className="font-medium text-gray-800">{c.name}</p><p className="text-xs text-gray-500">{c.provider}</p></div> },
    { key: 'type', header: 'Type', render: (c: ApiConnector) => {
      if (c.connector_type === 'rcs') return <Badge variant="purple" dot>RCS</Badge>;
      if (c.connector_type === 'flash_sms') return <Badge variant="warning" dot>Flash</Badge>;
      return <Badge variant="info">HTTP</Badge>;
    }},
    { key: 'region', header: 'Region', render: (c: ApiConnector) => <Badge variant={c.region === 'Global' ? 'info' : c.region === 'Bangladesh' ? 'success' : 'default'}>{c.region || 'Global'}</Badge> },
    { key: 'auth', header: 'Auth', render: (c: ApiConnector) => <Badge variant="default">{c.auth_type}</Badge> },
    { key: 'status', header: 'Status', render: (c: ApiConnector) => {
      if (c.connection_status === 'testing') return <Badge variant="warning">Testing...</Badge>;
      if (c.connection_status === 'connected') return <Badge variant="success" dot>Connected</Badge>;
      if (c.connection_status === 'failed') return <Badge variant="danger" dot>Failed</Badge>;
      return <Badge variant={c.is_active ? 'default' : 'danger'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>;
    }},
    { key: 'actions', header: 'Actions', render: (c: ApiConnector) => (
      <div className="flex gap-1">
        <button onClick={() => handleTest(c)} className="p-1.5 rounded hover:bg-gray-100" title="Test"><TestTube size={14} className="text-blue-500" /></button>
        <button onClick={() => openModal(c)} className="p-1.5 rounded hover:bg-gray-100"><Edit size={14} className="text-gray-500" /></button>
        <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded hover:bg-gray-100"><Trash2 size={14} className="text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">API Connectors</h1>
          <p className="text-gray-500 mt-1">{counts.total} API connectors — HTTP, RCS & Flash SMS</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Download size={18} />} onClick={handleBulkImport} loading={importing}>
            Import {BULK_IMPORT_CONNECTORS.length} Providers
          </Button>
          <Button icon={<Plus size={18} />} onClick={() => openModal()}>Add Connector</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total</p><p className="text-2xl font-bold mt-1">{counts.total}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-sm text-blue-600">HTTP API</p><p className="text-2xl font-bold text-blue-700 mt-1">{counts.http}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
          <p className="text-sm text-purple-600">RCS</p><p className="text-2xl font-bold text-purple-700 mt-1">{counts.rcs}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
          <p className="text-sm text-yellow-600">Flash SMS</p><p className="text-2xl font-bold text-yellow-700 mt-1">{counts.flash_sms}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-600">Connected</p><p className="text-2xl font-bold text-green-700 mt-1">{counts.connected}</p>
        </div>
      </div>

      {/* Import progress */}
      {importing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-blue-700">Importing...</p>
            <span className="text-sm text-blue-600">{importProgress.done}/{importProgress.total}</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: importProgress.total > 0 ? `${(importProgress.done / importProgress.total) * 100}%` : '0%' }} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[{ key: 'all', label: `All (${counts.total})`, icon: null }, { key: 'http', label: `HTTP (${counts.http})`, icon: <Smartphone size={14} /> }, { key: 'rcs', label: `RCS (${counts.rcs})`, icon: <MessageCircle size={14} /> }, { key: 'flash_sms', label: `Flash (${counts.flash_sms})`, icon: <Zap size={14} /> }].map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key as typeof activeTab); setSearch(''); }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Search + Region */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search by connector or provider name..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="all">All Regions</option>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card noPadding>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-400" /><span className="ml-2 text-gray-500">Loading...</span></div>
        ) : (
          <Table columns={columns} data={filtered} keyExtractor={c => c.id} />
        )}
      </Card>

      {/* Test Results */}
      {Object.entries(testResults).map(([id, r]) => (
        <div key={id} className={`p-3 rounded-lg text-sm ${r.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {connectors.find(c => c.id === id)?.name}: {r.msg}
        </div>
      ))}
      {error && (
        <div className="p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700 flex items-center justify-between">
          <span>{error}</span><button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2">✕</button>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit API Connector' : 'Add API Connector'} size="xl"
        footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Update' : 'Create'}</Button></div>}>
        <div className="space-y-6">
          {/* AI Auto-fill */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wand2 size={16} className="text-indigo-600" />
              <span className="text-sm font-semibold text-indigo-800">AI Auto-Fill from API URL</span>
            </div>
            <p className="text-xs text-indigo-600 mb-3">Paste a Send URL or DLR URL — we'll auto-detect the type and fill the right section. Works with Send SMS URLs (<code>voice_otp.php?apiKey=...&msisdn=...&code=...</code>) and DLR Query URLs (<code>check_delivery_otp.php?apiKey=...&trans_id=...</code>).</p>
            <div className="flex gap-2">
              <Input label="" value={autoFillUrl} onChange={e => setAutoFillUrl(e.target.value)} placeholder="Paste send URL or DLR query URL here..." className="flex-1" />
              <Button onClick={handleSmartAutoFill} icon={autoFillLoading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} variant="secondary" className="mt-0 self-end" loading={autoFillLoading}>Auto-Fill</Button>
            </div>
          </div>

          {/* Section: Send SMS Integration */}
          <div className="border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2"><Send size={14} className="text-blue-600" /> Send SMS Integration</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="My API Connector" required />
              <Select label="Provider" value={form.provider} onChange={e => setForm(p => ({ ...p, provider: e.target.value }))}
                options={[{ value: '', label: 'Select...' }, ...KNOWN_PROVIDERS.map(p => ({ value: p, label: p }))]} />
            </div>
            <div className="grid grid-cols-4 gap-4 mt-4">
              <Select label="Region" value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))} options={REGIONS.map(r => ({ value: r, label: r }))} />
              <Select label="Category" value={form.connector_type || 'http'} onChange={e => setForm(p => ({ ...p, connector_type: e.target.value as ApiConnector['connector_type'] }))}
                options={[{ value: 'http', label: 'HTTP API' }, { value: 'rcs', label: 'RCS' }, { value: 'flash_sms', label: 'Flash SMS' }]} />
              <Select label="Auth Type" value={form.auth_type} onChange={e => setForm(p => ({ ...p, auth_type: e.target.value }))}
                options={[{ value: 'API_KEY', label: 'API Key' }, { value: 'BASIC', label: 'Basic Auth' }, { value: 'BEARER', label: 'Bearer Token' }, { value: 'OAUTH2', label: 'OAuth 2.0' }, { value: 'NONE', label: 'None' }]} />
              <Select label="HTTP Method" value={form.http_method} onChange={e => setForm(p => ({ ...p, http_method: e.target.value }))}
                options={[{ value: 'POST', label: 'POST' }, { value: 'GET', label: 'GET' }, { value: 'PUT', label: 'PUT' }]} />
            </div>
            <div className="mt-4">
              <Input label="API Key / Token" value={form.api_key} onChange={e => setForm(p => ({ ...p, api_key: e.target.value }))} placeholder="Your API key or token" />
            </div>
            <div className="mt-4">
              <Textarea label="Send URL Template *" value={form.send_url} onChange={e => setForm(p => ({ ...p, send_url: e.target.value }))} rows={2}
                placeholder="https://api.twilio.com/2010-04-01/Accounts/{{sid}}/Messages.json" required />
            </div>
            <div className="mt-4">
              <Input label="Query Parameters (comma-separated)" value={form.params} onChange={e => setForm(p => ({ ...p, params: e.target.value }))} placeholder="to,from,text,api_key (for GET) or POST body fields" />
            </div>
            {form.http_method !== 'GET' && (
              <div className="mt-4">
                <Textarea label="Send Body Template (POST)" value={form.send_body_template} onChange={e => setForm(p => ({ ...p, send_body_template: e.target.value }))} rows={3}
                  placeholder='{"to":"{{to}}","text":"{{text}}","from":"{{from}}"} — use {{to}}, {{text}}, {{from}}, {{msisdn}}, {{code}} as placeholders' />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Input label="Submit Success Pattern" value={form.submit_pattern} onChange={e => setForm(p => ({ ...p, submit_pattern: e.target.value }))} placeholder='"status":"success"' />
              <Input label="Send Response Pattern (extract msg ID)" value={form.send_response_pattern} onChange={e => setForm(p => ({ ...p, send_response_pattern: e.target.value }))} placeholder='"message_id":"(\\w+)"' />
            </div>
            <div className="mt-3">
              <Button variant="secondary" size="sm" icon={testSendLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} onClick={handleTestSend} loading={testSendLoading}>
                Send Test Request
              </Button>
            </div>
            {/* Test Send Response Viewer */}
            {testSendResponse && (
              <div className={`mt-3 rounded-lg p-3 text-xs font-mono border ${testSendResponse?.success !== false ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-700">Send SMS Response</span>
                  <button onClick={() => setTestSendResponse(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                </div>
                {testSendResponse.error ? (
                  <p className="text-red-600">{testSendResponse.error}</p>
                ) : (
                  <>
                    <p className="mb-1"><span className="text-gray-500">Status:</span> {testSendResponse.response?.status} ({testSendResponse.latency_ms}ms)</p>
                    <p className="mb-1"><span className="text-gray-500">Success:</span> <Badge variant={testSendResponse.parsed_success ? 'success' : 'danger'}>{testSendResponse.parsed_success ? 'Yes' : 'No'}</Badge></p>
                    <details className="mt-1"><summary className="cursor-pointer text-blue-600 hover:underline">Raw Response</summary><pre className="mt-1 p-2 bg-gray-100 rounded overflow-x-auto text-xs max-h-40">{JSON.stringify(testSendResponse.response?.body || testSendResponse, null, 2)}</pre></details>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Section: DLR Query */}
          <div className="border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2"><RefreshCw size={14} className="text-green-600" /> Active DLR Query</h3>
            <p className="text-xs text-gray-500 mb-3">Poll the provider's API to check delivery status. Use {'{{message_id}}'} as a placeholder.</p>
            <div className="grid grid-cols-2 gap-4">
              <Input label="DLR Query URL" value={form.dlr_query_url} onChange={e => setForm(p => ({ ...p, dlr_query_url: e.target.value }))} placeholder="https://api.provider.com/dlr?msgid={{message_id}}" />
              <Input label="DLR Query Params" value={form.dlr_query_params} onChange={e => setForm(p => ({ ...p, dlr_query_params: e.target.value }))} placeholder="msgid,api_key" />
            </div>
            <div className="mt-3">
              <Input label="DLR Response Pattern" value={form.dlr_response_pattern} onChange={e => setForm(p => ({ ...p, dlr_response_pattern: e.target.value }))} placeholder='"status":"DELIVERED"' />
            </div>
            <div className="mt-3">
              <Button variant="secondary" size="sm" icon={testDlrLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} onClick={handleTestDlr} loading={testDlrLoading} disabled={!form.dlr_query_url}>
                Test DLR Query
              </Button>
            </div>
            {/* Test DLR Response Viewer */}
            {testDlrResponse && (
              <div className={`mt-3 rounded-lg p-3 text-xs font-mono border ${testDlrResponse?.success !== false ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-700">DLR Query Response</span>
                  <button onClick={() => setTestDlrResponse(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                </div>
                {testDlrResponse.error ? (
                  <p className="text-red-600">{testDlrResponse.error}</p>
                ) : (
                  <>
                    <p className="mb-1"><span className="text-gray-500">Status:</span> {testDlrResponse.response?.status} ({testDlrResponse.latency_ms}ms)</p>
                    <p className="mb-1"><span className="text-gray-500">DLR OK:</span> <Badge variant={testDlrResponse.parsed_dlr_ok ? 'success' : 'danger'}>{testDlrResponse.parsed_dlr_ok ? 'Yes' : 'No'}</Badge></p>
                    <details className="mt-1"><summary className="cursor-pointer text-blue-600 hover:underline">Raw Response</summary><pre className="mt-1 p-2 bg-gray-100 rounded overflow-x-auto text-xs max-h-40">{JSON.stringify(testDlrResponse.response?.body || testDlrResponse, null, 2)}</pre></details>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Section: DLR Webhook + Status Mapping */}
          <div className="border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2"><Globe size={14} className="text-purple-600" /> DLR Webhook & Status Mapping</h3>
            <Input label="DLR Webhook URL" value={form.dlr_url} onChange={e => setForm(p => ({ ...p, dlr_url: e.target.value }))} placeholder="https://your-server.com/dlr-callback (push/webhook, leave empty for active polling)" />
            <div className="grid grid-cols-3 gap-4 mt-4">
              <Input label="DLR Success Pattern" value={form.dlr_pattern} onChange={e => setForm(p => ({ ...p, dlr_pattern: e.target.value }))} />
              <Input label="DLR Success Value" value={form.dlr_value} onChange={e => setForm(p => ({ ...p, dlr_value: e.target.value }))} />
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">DLR Status Mapping</span>
                <Button size="sm" variant="secondary" onClick={() => setDlrMappingRows([...dlrMappingRows, { key: '', value: '' }])} icon={<Plus size={12} />}>Add Row</Button>
              </div>
              <p className="text-xs text-gray-500 mb-2">Map provider statuses to NET2APP DLR codes (DELIVRD, UNDELIV, EXPIRED, REJECTED, PENDING)</p>
              {dlrMappingRows.map((row, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm" placeholder="Provider status (e.g. delivered)"
                    value={row.key} onChange={e => {
                      const rows = [...dlrMappingRows]; rows[idx] = { ...rows[idx], key: e.target.value }; setDlrMappingRows(rows);
                    }} />
                  <span className="self-center text-gray-400">→</span>
                  <input className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm" placeholder="NET2APP DLR (e.g. DELIVRD)"
                    value={row.value} onChange={e => {
                      const rows = [...dlrMappingRows]; rows[idx] = { ...rows[idx], value: e.target.value }; setDlrMappingRows(rows);
                    }} />
                  <button onClick={() => setDlrMappingRows(dlrMappingRows.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 p-1"><X size={14} /></button>
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <span className="text-sm">Active</span>
          </label>
        </div>
      </Modal>
    </div>
  );
};
