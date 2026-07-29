import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, Clock, ArrowRight, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../store/DataContext';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Badge } from '../components/UI/Badge';
import { api } from '../services/api';

type ClientSession = {
  id: number;
  client_code: string;
  company_name: string;
  smpp_username: string;
  smpp_ip: string;
  smpp_port: number;
  account_status: string;
  session_status: string;
  connected_at: string | null;
  disconnected_at: string | null;
  last_activity: string | null;
  system_id: string;
  bind_mode: string;
  negotiated_version: string | null;
  session_ip: string | null;
  session_port: number | null;
  bound_count: number | null;
  smpp_session_id: string | null;
};

type SupplierBindRow = {
  id: number;
  supplier_code: string;
  company_name: string;
  connection_type: string;
  bind_status: string;
  consecutive_failures: number;
  status: string;
  is_inbound: boolean;
  smpp_host: string;
  smpp_port: number;
  smpp_version: string;
  session_status: string;
  connected_at: string | null;
  disconnected_at: string | null;
  last_activity: string | null;
  system_id: string;
  bind_mode: string;
  negotiated_version: string | null;
  session_ip: string | null;
  session_port: number | null;
  bound_count: number | null;
  smpp_session_id: string | null;
};

type BindHistoryEntry = {
  id: number;
  entity_type: string;
  entity_id: number;
  system_id: string;
  ip_address: string | null;
  port: number;
  bind_mode: string;
  status: string;
  negotiated_version: string | null;
  smpp_session_id: string | null;
  created_at: string;
  entity_code: string | null;
  entity_name: string | null;
};

export const BindStatus: React.FC = () => {
  const navigate = useNavigate();
  const { suppliers, clients } = useData();
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [clientSessions, setClientSessions] = useState<ClientSession[]>([]);
  const [supplierSessions, setSupplierSessions] = useState<SupplierBindRow[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [bindHistory, setBindHistory] = useState<BindHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const historyOffsetRef = React.useRef(0);
  const filterTypeRef = React.useRef('');
  const filterIdRef = React.useRef('');
  const [historyTotal, setHistoryTotal] = useState(0);
  const HISTORY_PAGE = 100;
  const [filterEntityType, setFilterEntityType] = useState<string>('');
  const [filterEntityId, setFilterEntityId] = useState<string>('');

  const fetchClientSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await api.get('/bind/clients');
      if (res?.success && Array.isArray(res.data)) {
        setClientSessions(res.data);
      }
    } catch (e) {
      setClientSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const fetchSupplierSessions = useCallback(async () => {
    setLoadingSuppliers(true);
    try {
      const res = await api.get('/bind/status');
      if (res?.success && Array.isArray(res.data)) {
        setSupplierSessions(res.data);
      }
    } catch (e) {
      setSupplierSessions([]);
    } finally {
      setLoadingSuppliers(false);
    }
  }, []);

  const fetchBindHistory = useCallback(async (append = false) => {
    setLoadingHistory(true);
    const off = append ? historyOffsetRef.current : 0;
    try {
      const filter = [];
      if (filterTypeRef.current) filter.push(`entity_type=${encodeURIComponent(filterTypeRef.current)}`);
      if (filterIdRef.current) filter.push(`entity_id=${encodeURIComponent(filterIdRef.current)}`);
      const qs = `limit=${HISTORY_PAGE}&offset=${off}${filter.length ? '&' + filter.join('&') : ''}`;
      const res = await api.get(`/bind/history?${qs}`);
      if (res?.success && Array.isArray(res.data)) {
        setBindHistory(prev => append ? [...prev, ...res.data] : res.data);
        historyOffsetRef.current = off + res.data.length;
        setHistoryTotal(res.total || 0);
      }
    } catch (e) {
      if (!append) setBindHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => { fetchClientSessions(); fetchSupplierSessions(); fetchBindHistory(); }, []);

  // SSE — subscribe to real-time bind events so the page updates instantly
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const es = new EventSource(`/api/bind/events?token=${encodeURIComponent(token)}`);
    es.addEventListener('bind_update', (e) => {
      try {
        const evt = JSON.parse(e.data);
        void evt; // used for future targeted refresh (entity_type/entity_id)
        // After a bind event, re-fetch the affected section to sync state.
        // We debounce slightly so rapid events batch into one refresh.
        clearTimeout((window as any).__bindRefreshTimer);
        (window as any).__bindRefreshTimer = setTimeout(() => {
      fetchClientSessions();
      fetchSupplierSessions();
          setLastRefresh(new Date());
        }, 300);
      } catch (_) { /* ignore parse errors */ }
    });
    es.onerror = () => {
      // EventSource auto-reconnects; no action needed
    };
    return () => {
      es.close();
      clearTimeout((window as any).__bindRefreshTimer);
    };
  }, [fetchClientSessions, fetchSupplierSessions, fetchBindHistory]);

  // Polling fallback — reconciles state every 5 minutes in case SSE disconnects
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setLastRefresh(new Date());
      fetchClientSessions();
      fetchSupplierSessions();
      fetchBindHistory();
    }, 300000); // 5 minutes — sessions only; history is event-driven
    return () => clearInterval(interval);
  }, [autoRefresh, fetchClientSessions, fetchSupplierSessions, fetchBindHistory]);

  const getClientSession = (clientId: string): ClientSession | undefined => {
    return clientSessions.find(s => String(s.id) === String(clientId));
  };

  const getSupplierSession = (supplierId: string): SupplierBindRow | undefined => {
    return supplierSessions.find(s => String(s.id) === String(supplierId));
  };

  // SMPP suppliers use real smpp_sessions data for bind status.
  // Non-SMPP channels (HTTP, Voice OTP, WhatsApp, Telegram, RCS, etc.) have no TCP bind
  // and are considered "bound" whenever the supplier is active.
  const getSupplierTrueBindStatus = (supplierId: string, connectionType?: string): 'bound' | 'unbound' | 'error' => {
    const ct = connectionType || 'smpp';
    // Non-SMPP channels: active = bound
    if (ct !== 'smpp') {
      const s = suppliers.find(x => String(x.id) === String(supplierId));
      if (!s) return 'unbound';
      return s.status === 'active' ? 'bound' : 'unbound';
    }
    // SMPP: use real smpp_sessions
    const sess = getSupplierSession(supplierId);
    if (!sess) return 'unbound';
    if (sess.session_status === 'bound') return 'bound';
    if (sess.session_status === 'error') return 'error';
    return 'unbound';
  };

  const getClientBindStatus = (clientId: string): 'bound' | 'unbound' | 'error' => {
    const client = clients.find(c => String(c.id) === String(clientId));
    if (!client || client.status !== 'active') return 'unbound';
    const sess = getClientSession(clientId);
    if (!sess) return 'unbound';
    if (sess.session_status === 'bound') return 'bound';
    if (sess.session_status === 'error') return 'error';
    return 'unbound';
  };

  const NON_SMPP_CHANNELS = ['http', 'voice_otp', 'local_bypass', 'rcs', 'flash_sms'];

  const smppSuppliers = suppliers.filter(s => s.connection_type === 'smpp');
  const nonSMPPSuppliers = suppliers.filter(s => NON_SMPP_CHANNELS.includes(s.connection_type));
  const ottSuppliers = suppliers.filter(s => ['ott_whatsapp', 'ott_telegram'].includes(s.connection_type));

  const supplierStats = {
    total: suppliers.length,
    bound: suppliers.filter(s => getSupplierTrueBindStatus(s.id, s.connection_type) === 'bound').length,
    unbound: suppliers.filter(s => getSupplierTrueBindStatus(s.id, s.connection_type) === 'unbound' && s.status === 'active').length,
    error: suppliers.filter(s => getSupplierTrueBindStatus(s.id, s.connection_type) === 'error').length,
    blocked: suppliers.filter(s => s.consecutive_failures >= 20).length,
  };

  const clientStats = {
    total: clients.length,
    bound: clients.filter(c => getClientBindStatus(c.id) === 'bound').length,
    unbound: clients.filter(c => getClientBindStatus(c.id) === 'unbound').length,
    active: clients.filter(c => c.status === 'active').length,
    withSession: clientSessions.filter(s => s.session_status === 'bound').length,
  };

  const getStatusBadge = (status: string, failures?: number) => {
    if (failures !== undefined && failures >= 20) {
      return <Badge variant="danger" dot>BLOCKED</Badge>;
    }
    const variants: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
      bound: 'success', unbound: 'danger', binding: 'warning', error: 'danger',
    };
    return <Badge variant={variants[status] || 'danger'} dot size="sm">{status.toUpperCase()}</Badge>;
  };

  const CHANNEL_LABELS: Record<string, string> = {
    smpp: 'SMPP', http: 'HTTP API', voice_otp: 'Voice OTP',
    local_bypass: 'Local Bypass', rcs: 'RCS', flash_sms: 'Flash SMS',
    ott_whatsapp: 'WhatsApp', ott_telegram: 'Telegram', email: 'Email',
  };
  
  const handleReconnect = async (supplierId: string) => {
    setConnectingId(supplierId);
    try {
      const res = await api.post(`/bind/${supplierId}/connect`);
      if (res?.success) {
        await fetchSupplierSessions();
      }
    } catch (e) {
      console.warn('[BindStatus] reconnect failed:', e);
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async (supplierId: string) => {
    setConnectingId(supplierId);
    try {
      const res = await api.post(`/bind/${supplierId}/disconnect`);
      if (res?.success) {
        await fetchSupplierSessions();
      }
    } catch (e) {
      console.warn('[BindStatus] disconnect failed:', e);
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Bind Status</h1>
          <p className="text-gray-500 mt-1">Monitor Client and Supplier SMPP/OTT connection status — live session data</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <span className="text-sm text-gray-600">Auto-refresh</span>
          </label>
          <span className="text-sm text-gray-500">Updated: {lastRefresh.toLocaleTimeString()}</span>
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={() => { fetchClientSessions(); fetchSupplierSessions(); fetchBindHistory(); setLastRefresh(new Date()); }}>Refresh</Button>
        </div>
      </div>

      {/* Combined Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3">
        <div className="bg-white rounded-xl p-3 border text-center">
          <p className="text-xs text-gray-500">Total Clients</p>
          <p className="text-xl font-bold text-gray-800">{clientStats.total}</p>
          <p className="text-[10px] text-gray-400">{clientStats.active} active</p>
        </div>
        <div className="bg-white rounded-xl p-3 border text-center">
          <p className="text-xs text-gray-500">Clients Bound</p>
          <p className="text-xl font-bold text-green-600">{clientStats.bound}</p>
          <p className="text-[10px] text-gray-400">{clientStats.unbound} unbound</p>
        </div>
        <div className="bg-white rounded-xl p-3 border text-center">
          <p className="text-xs text-gray-500">Total Suppliers</p>
          <p className="text-xl font-bold text-gray-800">{supplierStats.total}</p>
        </div>
        <div className="bg-white rounded-xl p-3 border text-center">
          <p className="text-xs text-gray-500">Suppliers Bound</p>
          <p className="text-xl font-bold text-green-600">{supplierStats.bound}</p>
          <p className="text-[10px] text-gray-400">{supplierStats.unbound} unbound</p>
        </div>
        <div className="bg-white rounded-xl p-3 border text-center">
          <p className="text-xs text-gray-500">Errors</p>
          <p className="text-xl font-bold text-red-600">{supplierStats.error}</p>
        </div>
        <div className="bg-white rounded-xl p-3 border text-center">
          <p className="text-xs text-gray-500">Blocked</p>
          <p className="text-xl font-bold text-orange-600">{supplierStats.blocked}</p>
        </div>
        <div className="bg-white rounded-xl p-3 border text-center">
          <p className="text-xs text-gray-500">SMPP</p>
          <p className="text-xl font-bold text-blue-600">{smppSuppliers.length}</p>
        </div>
        <div className="bg-white rounded-xl p-3 border text-center">
          <p className="text-xs text-gray-500">API/Voice</p>
          <p className="text-xl font-bold text-indigo-600">{nonSMPPSuppliers.length}</p>
        </div>
        <div className="bg-white rounded-xl p-3 border text-center">
          <p className="text-xs text-gray-500">OTT</p>
          <p className="text-xl font-bold text-purple-600">{ottSuppliers.length}</p>
        </div>
      </div>

      {/* Unbound / Broken warning banner */}
      {(() => {
        const unbound = suppliers.filter(s => getSupplierTrueBindStatus(s.id, s.connection_type) !== 'bound' && s.status === 'active');
        const blocked = suppliers.filter(s => s.consecutive_failures >= 20);
        if (unbound.length === 0 && blocked.length === 0) return null;
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex items-center gap-2 flex-shrink-0">
              <AlertTriangle size={20} className="text-amber-600" />
              <span className="font-semibold text-amber-800 text-sm">Connection Issues</span>
            </div>
            <div className="flex-1 text-sm text-amber-700">
              {unbound.length > 0 && <span>{unbound.length} supplier{unbound.length !== 1 ? 's' : ''} unbound. </span>}
              {blocked.length > 0 && <span>{blocked.length} supplier{blocked.length !== 1 ? 's' : ''} blocked.</span>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="secondary" size="sm" onClick={() => navigate('/suppliers')} icon={<ArrowRight size={14} />}>View Suppliers</Button>
            </div>
          </div>
        );
      })()}

      {/* Client Bind Status — ESME Sessions (real smpp_sessions data) */}
      <Card title="ESME — Client Bind Status" subtitle={`${clients.length} clients — live SMPP session data from gateway`}>
        {loadingSessions && clientSessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
            <p>Loading session data...</p>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {clients.filter(c => c.status === 'active').map(client => {
            const bindStatus = getClientBindStatus(client.id);
            const sess = getClientSession(client.id);
            return (
              <div key={client.id}
                className={`p-4 rounded-xl border-2 transition-all ${
                  bindStatus === 'bound' ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
                }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${bindStatus === 'bound' ? 'bg-green-500' : 'bg-red-400'}`}>
                      {bindStatus === 'bound' ? <Wifi size={18} /> : <WifiOff size={18} />}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{client.client_code}</p>
                      <p className="text-xs text-gray-600">{client.company_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(bindStatus)}
                  </div>
                </div>
                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">SMPP User:</span>
                    <span className="font-mono text-gray-700">{client.smpp_username || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Connection:</span>
                    <span className={`font-medium flex items-center gap-1 ${bindStatus === 'bound' ? 'text-green-600' : 'text-red-500'}`}>
                      {bindStatus === 'bound' ? <Wifi size={13} /> : <WifiOff size={13} />}
                      {bindStatus === 'bound' ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                      {sess && sess.session_status === 'bound' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Remote IP:</span>
                        <span className="font-mono text-gray-700">{sess.session_ip || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Port:</span>
                        <span className="font-mono text-gray-700">{sess.session_port || 2775}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Bind Mode:</span>
                        <span className="font-mono text-gray-700">{sess.bind_mode || 'transceiver'}</span>
                      </div>
                      {sess.negotiated_version && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">SMPP v:</span>
                          <span className="font-mono text-green-600 font-medium">v{sess.negotiated_version}</span>
                        </div>
                      )}
                      {sess.connected_at && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Connected:</span>
                          <span className="font-mono text-gray-700 text-[10px]">{new Date(sess.connected_at).toLocaleString()}</span>
                        </div>
                      )}
                      {sess.bound_count != null && sess.bound_count > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Sessions:</span>
                          <span className="font-mono text-blue-600 font-medium">{sess.bound_count}</span>
                        </div>
                      )}
                    </>
                  )}
                  {sess && sess.session_status === 'unbound' && sess.disconnected_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Disconnected:</span>
                      <span className="font-mono text-gray-500 text-[10px]">{new Date(sess.disconnected_at).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Route Plan:</span>
                    <span className={`font-medium ${client.routing_plan_id ? 'text-green-600' : 'text-yellow-600'}`}>
                      {client.routing_plan_id ? 'Assigned' : 'None'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </Card>

      {/* Supplier Bind Status - SMSC SMPP */}
      <Card title="SMSC — Supplier Bind Status" subtitle={`${smppSuppliers.length} connections — live SMPP session data from gateway`}>
        {loadingSuppliers && supplierSessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
            <p>Loading session data...</p>
          </div>
        ) : smppSuppliers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <span className="text-4xl">🔌</span>
            <p className="mt-2">No SMPP/HTTP suppliers configured</p>
            <p className="text-xs mt-1 mb-4">Add a supplier to monitor its connection status here</p>
            <Button variant="secondary" size="sm" onClick={() => navigate('/suppliers/add')}>
              <ArrowRight size={14} className="mr-1" /> Add Supplier
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {smppSuppliers.map(supplier => {
              const trueStatus = getSupplierTrueBindStatus(supplier.id, supplier.connection_type);
              const sess = getSupplierSession(supplier.id);
              const isBound = trueStatus === 'bound';
              return (
              <div key={supplier.id}
                className={`p-4 rounded-xl border-2 transition-all ${
                  isBound ? 'border-green-300 bg-green-50' :
                  trueStatus === 'error' || supplier.consecutive_failures >= 20 ? 'border-red-300 bg-red-50' :
                  'border-red-300 bg-red-50'
                }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${
                      isBound ? 'bg-green-500' : trueStatus === 'error' ? 'bg-yellow-500' : 'bg-red-400'
                    }`}>
                      {isBound ? <Wifi size={18} /> : trueStatus === 'error' ? <Clock size={18} /> : <WifiOff size={18} />}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{supplier.supplier_code}</p>
                      <p className="text-xs text-gray-600">{supplier.company_name}</p>
                    </div>
                  </div>
                  {getStatusBadge(trueStatus, supplier.consecutive_failures)}
                </div>
                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">SMPP User:</span>
                    <span className="font-mono text-gray-700">{supplier.smpp_username || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Connection:</span>
                    <span className={`font-medium flex items-center gap-1 ${isBound ? 'text-green-600' : 'text-red-500'}`}>
                      {isBound ? <Wifi size={13} /> : <WifiOff size={13} />}
                      {isBound ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Direction:</span>
                    <span className={`font-medium flex items-center gap-1 ${supplier.is_inbound ? 'text-purple-600' : 'text-blue-600'}`}>
                      {supplier.is_inbound ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                      {supplier.is_inbound ? 'Inbound' : 'Outbound'}
                    </span>
                  </div>
                      {sess && isBound && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Remote IP:</span>
                        <span className="font-mono text-gray-700">{sess.session_ip || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Sess Port:</span>
                        <span className="font-mono text-gray-700">{sess.session_port || 2775}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Bind Mode:</span>
                        <span className="font-mono text-gray-700">{sess.bind_mode || 'transceiver'}</span>
                      </div>
                      {sess.negotiated_version && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">SMPP v:</span>
                          <span className="font-mono text-green-600 font-medium">v{sess.negotiated_version}</span>
                        </div>
                      )}
                      {sess.connected_at && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Connected:</span>
                          <span className="font-mono text-gray-700 text-[10px]">{new Date(sess.connected_at).toLocaleString()}</span>
                        </div>
                      )}
                      {sess.bound_count != null && sess.bound_count > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Sessions:</span>
                          <span className="font-mono text-blue-600 font-medium">{sess.bound_count}</span>
                        </div>
                      )}
                    </>
                  )}
                  {sess && !isBound && sess.disconnected_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Disconnected:</span>
                      <span className="font-mono text-gray-500 text-[10px]">{new Date(sess.disconnected_at).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Failures:</span>
                    <span className={`font-medium ${supplier.consecutive_failures > 10 ? 'text-red-600' : supplier.consecutive_failures > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {supplier.consecutive_failures}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {supplier.is_inbound ? (
                    <Button size="sm" variant="secondary" className="flex-1" onClick={() => navigate(`/suppliers/${supplier.id}/edit`)} title="Edit config">
                      <ArrowRight size={14} className="mr-1" /> Edit Inbound Config
                    </Button>
                  ) : isBound ? (
                    <Button size="sm" variant="danger" className="flex-1" onClick={() => handleDisconnect(supplier.id)} loading={connectingId === supplier.id}>Disconnect</Button>
                  ) : (
                    <>
                      <Button size="sm" variant="success" className="flex-1" onClick={() => handleReconnect(supplier.id)} loading={connectingId === supplier.id}>Reconnect</Button>
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/suppliers/${supplier.id}/edit`)} title="Edit config">
                        <ArrowRight size={14} />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )})}
          </div>
        )}
      </Card>

      {/* Non-SMPP Channel Suppliers (HTTP, Voice OTP, Local Bypass, etc.) */}
      {nonSMPPSuppliers.length > 0 && (
      <Card title="Supplier — API / Voice / Non-SMPP Channels" subtitle={`${nonSMPPSuppliers.length} connections — active status = connected`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {nonSMPPSuppliers.map(supplier => {
            const isActive = supplier.status === 'active';
            return (
              <div key={supplier.id}
                className={`p-4 rounded-xl border-2 transition-all ${
                  isActive ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${isActive ? 'bg-green-500' : 'bg-gray-400'}`}>
                      <span className="text-lg">{supplier.connection_type === 'voice_otp' ? '📞' : supplier.connection_type === 'http' ? '🌐' : '🔗'}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{supplier.supplier_code}</p>
                      <p className="text-xs text-gray-600">{supplier.company_name}</p>
                    </div>
                  </div>
                  <Badge variant={isActive ? 'success' : 'default'} size="sm">
                    {isActive ? 'CONNECTED' : supplier.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Connection:</span>
                    <span className={`font-medium flex items-center gap-1 ${isActive ? 'text-green-600' : 'text-red-500'}`}>
                      {isActive ? <Wifi size={13} /> : <WifiOff size={13} />}
                      {isActive ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Channel:</span>
                    <span className="font-medium text-blue-600">{CHANNEL_LABELS[supplier.connection_type] || supplier.connection_type.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Host:</span>
                    <span className="font-mono text-gray-700">{supplier.smpp_host || supplier.api_url || 'N/A'}</span>
                  </div>
                </div>
                <div className="mt-3">
                  <Button size="sm" variant="secondary" className="w-full" onClick={() => navigate(`/suppliers/${supplier.id}/edit`)} title="Edit config">
                    <ArrowRight size={14} className="mr-1" /> Edit Config
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      )}

      {/* Supplier Bind Status - OTT */}
      <Card title="Supplier — OTT Connections (WhatsApp / Telegram)" subtitle={`${ottSuppliers.length} connections — active status = connected`}>
        {ottSuppliers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <span className="text-4xl">📱</span>
            <p className="mt-2">No WhatsApp/Telegram suppliers configured</p>
            <p className="text-xs mt-1 mb-4">Pair OTT devices then add an OTT supplier to monitor here</p>
            <div className="flex items-center justify-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => navigate('/suppliers/social-api')}>
                <ArrowRight size={14} className="mr-1" /> Social API
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/business-api-connect')}>
                <ArrowRight size={14} className="mr-1" /> Business API
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ottSuppliers.map(supplier => {
              const trueStatus = getSupplierTrueBindStatus(supplier.id, supplier.connection_type);
              const isBound = trueStatus === 'bound';
              return (
              <div key={supplier.id}
                className={`p-4 rounded-xl border-2 transition-all ${
                  isBound ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
                }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${isBound ? 'bg-green-500' : 'bg-red-400'}`}>
                      {supplier.connection_type === 'ott_whatsapp' ? <span className="text-lg">📱</span> : <span className="text-lg">✈️</span>}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{supplier.supplier_code}</p>
                      <p className="text-xs text-gray-600">{supplier.company_name}</p>
                    </div>
                  </div>
                  {getStatusBadge(trueStatus, supplier.consecutive_failures)}
                </div>
                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Connection:</span>
                    <span className={`font-medium flex items-center gap-1 ${isBound ? 'text-green-600' : 'text-red-500'}`}>
                      {isBound ? <Wifi size={13} /> : <WifiOff size={13} />}
                      {isBound ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Platform:</span>
                    <span className="font-medium text-gray-700">{supplier.connection_type === 'ott_whatsapp' ? 'WhatsApp' : 'Telegram'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Failures:</span>
                    <span className={`font-medium ${supplier.consecutive_failures > 10 ? 'text-red-600' : supplier.consecutive_failures > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {supplier.consecutive_failures}
                    </span>
                  </div>
                </div>
                <div className="mt-3">
                  <Button size="sm" variant="secondary" className="w-full" onClick={() => navigate(`/suppliers/${supplier.id}/edit`)} title="Edit config">
                    <ArrowRight size={14} className="mr-1" /> Edit Config
                  </Button>
                </div>
              </div>
            )})}
          </div>
        )}
      </Card>

      {/* Routing Flow Diagram */}
      <Card title="SMS Routing Flow">
        <div className="bg-gray-50 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-center gap-3 text-center">
            {[
              { emoji:'📱', label:'Client\nSMPP Bind', desc:'username/password\nIP whitelist' },
              { emoji:'✅', label:'Validation', desc:'Rate + Balance\n+ Credit Check' },
              { emoji:'🗺️', label:'Route Map', desc:'MCCMNC Pattern\nMatch' },
              { emoji:'🔀', label:'Route\nSelection', desc:'Priority / LCR\n/ Percentage' },
              { emoji:'🔗', label:'Trunk\nSelection', desc:'Supplier Bind\nStatus Check' },
              { emoji:'🏢', label:'Supplier\nGateway', desc:'SMPP/HTTP\n/OTT' },
              { emoji:'📩', label:'DLR\nCallback', desc:'Delivery\nReceipt' },
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 min-w-[100px]">
                  <div className="text-xl mb-1">{step.emoji}</div>
                  <p className="text-xs font-medium text-gray-800 whitespace-pre-line">{step.label}</p>
                  <p className="text-[10px] text-gray-500 whitespace-pre-line">{step.desc}</p>
                </div>
                {i < 6 && <div className="text-lg text-gray-400 mt-1">↓</div>}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Bind History Timeline */}
      <Card title="Bind History Timeline" subtitle={`${bindHistory.length} events${filterEntityType ? ' — filtered' : ''} — chronological bind/unbind/error log`}>
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            value={filterEntityType}
            onChange={e => {
              const v = e.target.value;
              setFilterEntityType(v); filterTypeRef.current = v;
              setFilterEntityId(''); filterIdRef.current = '';
              historyOffsetRef.current = 0; setBindHistory([]);
              setTimeout(() => fetchBindHistory(), 0);
            }}
            className="text-sm border rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All entities</option>
            <option value="client">ESME Clients</option>
            <option value="supplier">SMSC Suppliers</option>
          </select>
          {filterEntityType && (
            <select
              value={filterEntityId}
              onChange={e => {
                const v = e.target.value;
                setFilterEntityId(v); filterIdRef.current = v;
                historyOffsetRef.current = 0; setBindHistory([]);
                setTimeout(() => fetchBindHistory(), 0);
              }}
              className="text-sm border rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[180px]"
            >
              <option value="">All {filterEntityType === 'client' ? 'clients' : 'suppliers'}</option>
              {filterEntityType === 'client'
                ? clients.map(c => (
                    <option key={c.id} value={c.id}>{c.client_code} — {c.company_name}</option>
                  ))
                : suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.supplier_code} — {s.company_name}</option>
                  ))
              }
            </select>
          )}
          {(filterEntityType || filterEntityId) && (
            <button
              onClick={() => {
                setFilterEntityType(''); filterTypeRef.current = '';
                setFilterEntityId(''); filterIdRef.current = '';
                historyOffsetRef.current = 0; setBindHistory([]);
                setTimeout(() => fetchBindHistory(), 0);
              }}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Clear filter
            </button>
          )}
        </div>
        {loadingHistory && bindHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
            <p>Loading history...</p>
          </div>
        ) : bindHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <span className="text-4xl">📋</span>
            <p className="mt-2">No bind history recorded yet</p>
            <p className="text-xs">Events appear here when clients or suppliers bind/unbind</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {bindHistory.map((entry) => {
                const isSupplier = entry.entity_type === 'supplier';
                const isBound = entry.status === 'bound';
                const isError = entry.status === 'error';
                const isBinding = entry.status === 'binding';
                const dotColor = isBound ? 'bg-green-500' : isError ? 'bg-red-500' : isBinding ? 'bg-yellow-500' : 'bg-red-400';
                const borderColor = isBound ? 'border-green-200' : isError ? 'border-red-200' : isBinding ? 'border-yellow-200' : 'border-red-200';
                const time = new Date(entry.created_at);
                const timeAgo = Math.floor((Date.now() - time.getTime()) / 1000);
                const timeAgoStr = timeAgo < 60 ? `${timeAgo}s ago` : timeAgo < 3600 ? `${Math.floor(timeAgo / 60)}m ago` : timeAgo < 86400 ? `${Math.floor(timeAgo / 3600)}h ago` : `${Math.floor(timeAgo / 86400)}d ago`;
                return (
                  <div key={entry.id} className="flex items-start gap-4 ml-2">
                    {/* Dot */}
                    <div className={`relative z-10 w-6 h-6 rounded-full ${dotColor} flex-shrink-0 mt-0.5 flex items-center justify-center ring-4 ring-white`}>
                      {isBound ? <Wifi size={12} className="text-white" /> : <WifiOff size={12} className="text-white" />}
                    </div>
                    {/* Card */}
                    <div className={`flex-1 bg-white border ${borderColor} rounded-lg p-3`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={isSupplier ? 'info' : 'default'} size="sm">{isSupplier ? 'SMSC' : 'ESME'}</Badge>
                          <span className="font-medium text-sm text-gray-800">{entry.entity_code || entry.system_id}</span>
                          {entry.entity_name && <span className="text-xs text-gray-400">({entry.entity_name})</span>}
                        </div>
                        <Badge variant={isBound ? 'success' : isError ? 'danger' : isBinding ? 'warning' : 'danger'} size="sm">
                          {entry.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-500">
                        <div>
                          <span className="text-gray-400">System ID:</span>
                          <span className="ml-1 font-mono text-gray-700">{entry.system_id}</span>
                        </div>
                        {entry.ip_address && (
                          <div>
                            <span className="text-gray-400">IP:</span>
                            <span className="ml-1 font-mono text-gray-700">{entry.ip_address}:{entry.port}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-400">Mode:</span>
                          <span className="ml-1 font-mono text-gray-700">{entry.bind_mode}</span>
                        </div>
                        {entry.negotiated_version && (
                          <div>
                            <span className="text-gray-400">SMPP:</span>
                            <span className="ml-1 font-mono text-green-600">v{entry.negotiated_version}</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-xs">
                        <span className="text-gray-400">{time.toLocaleString()}</span>
                        <span className="text-gray-300">{timeAgoStr}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {historyOffsetRef.current > 0 && historyOffsetRef.current < historyTotal && (
              <div className="mt-4 text-center">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fetchBindHistory(true)}
                  loading={loadingHistory}
                  icon={<ArrowRight size={14} />}
                >
                  Load More ({historyTotal - historyOffsetRef.current} remaining)
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
