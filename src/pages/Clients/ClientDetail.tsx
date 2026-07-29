import { Rate, ClientIP } from '../../types';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Send, RefreshCw, CreditCard, BarChart3, MessageSquare, Radio, Plus, Shield, TrendingUp, TrendingDown } from 'lucide-react';
import { useData } from '../../store/DataContext';
import { api } from '../../services/api';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { Badge } from '../../components/UI/Badge';
import { Modal } from '../../components/UI/Modal';
import { Input } from '../../components/UI/Input';

export const ClientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getClientById, updateClient, deleteClient, smsLogs, invoices, routePlans, reloadClientRates, addRate, updateRate, mccmnc } = useData();
  const client = id ? getClientById(id) : undefined;
const [showTopup, setShowTopup] = useState(false);
const [showDelete, setShowDelete] = useState(false);
const [deleting, setDeleting] = useState(false);
const [restoring, setRestoring] = useState(false);
const [topupAmount, setTopupAmount] = useState(1000);
  const [activeTab, setActiveTab] = useState<'overview' | 'cdr' | 'usage' | 'payments' | 'rates'>('overview');

  // IP whitelist management
  const [clientIPs, setClientIPs] = useState<ClientIP[]>([]);
  const [newIP, setNewIP] = useState('');
  const [newIPLabel, setNewIPLabel] = useState('');
  const [loadingIPs, setLoadingIPs] = useState(false);
  const [ipError, setIpError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoadingIPs(true);
    api.get(`/clients/${id}/ips`).then((r: any) => {
      if (r?.success && Array.isArray(r.data)) setClientIPs(r.data);
    }).catch(() => {}).finally(() => setLoadingIPs(false));
  }, [id]);

  const addIP = async () => {
    if (!newIP || !id) return;
    setIpError('');
    try {
      const r = await api.post(`/clients/${id}/ips`, { ip_address: newIP, label: newIPLabel });
      if (r.success && r.data) setClientIPs(prev => [...prev, r.data]);
      setNewIP(''); setNewIPLabel('');
    } catch {
      setIpError('Failed to add IP. Please try again.');
    }
  };

  const removeIP = async (ipId: string) => {
    if (!id) return;
    setIpError('');
    try {
      await api.delete(`/clients/${id}/ips/${ipId}`);
      setClientIPs(prev => prev.filter(ip => ip.id !== ipId));
    } catch {
      setIpError('Failed to remove IP. Please try again.');
    }
  };

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 text-lg">Client not found</p>
        <Button variant="secondary" onClick={() => navigate('/clients')} className="mt-4">Back to Clients</Button>
      </div>
    );
  }

  const clientSMS = smsLogs.filter(l => l.client_id === client.id);
  const clientInvoices = invoices.filter(i => i.entity_id === client.id && i.entity_type === 'client');
  const clientPayments = [
    { id: '1', amount: 10000, date: '2024-01-05', method: 'Bank Transfer', reference: 'BT-123456', status: 'completed' },
    { id: '2', amount: 5000, date: '2024-02-10', method: 'Credit Card', reference: 'CC-789012', status: 'completed' },
  ];
  const routePlan = routePlans.find(p => p.id === client.routing_plan_id);

  // Quick Add Rate modal
  const [showQuickAddRate, setShowQuickAddRate] = useState(false);
  const [quickRateCountry, setQuickRateCountry] = useState('');
  const [quickRateMnc, setQuickRateMnc] = useState('');
  const [quickRateValue, setQuickRateValue] = useState(0);
  const [quickRateEffective, setQuickRateEffective] = useState(new Date().toISOString().split('T')[0]);
  const [quickRateActive, setQuickRateActive] = useState(true);
  const [quickRateSubmitting, setQuickRateSubmitting] = useState(false);
  const [quickRateError, setQuickRateError] = useState('');

  const openQuickAddRate = () => {
    setQuickRateCountry('');
    setQuickRateMnc('');
    setQuickRateValue(0);
    setQuickRateEffective(new Date().toISOString().split('T')[0]);
    setQuickRateActive(true);
    setQuickRateError('');
    setShowQuickAddRate(true);
  };

  const handleQuickAddRate = async () => {
    if (!quickRateCountry || !quickRateValue || !id) return;
    setQuickRateSubmitting(true);
    try {
      const mcc = mccmnc.find(m => m.country === quickRateCountry)?.mcc || '';
      const mnc = quickRateMnc || '*';
      const op = mccmnc.find(m => m.mcc === mcc && m.mnc === mnc);
      const opName = mnc === '*' ? 'All' : (op?.operator || 'All');
      await addRate({
        entity_type: 'client',
        entity_id: id,
        mcc,
        mnc,
        country: quickRateCountry,
        operator: opName,
        rate: quickRateValue,
        currency: 'EUR',
        effective_from: quickRateEffective,
        effective_to: null,
        is_active: quickRateActive,
      });
      setShowQuickAddRate(false);
      fetchRates();
    } catch {
      setQuickRateError('Failed to add rate. Please try again.');
    } finally {
      setQuickRateSubmitting(false);
    }
  };

  // Inline rate editing state
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [editingRateValue, setEditingRateValue] = useState(0);
  const [editingRateSaving, setEditingRateSaving] = useState<string | null>(null);
  const [rateChangeMap, setRateChangeMap] = useState<Record<string, { oldRate: number; newRate: number }>>({});
  const rateChangeTimers = React.useRef<Record<string, NodeJS.Timeout>>({});

  const markRateChange = (rateId: string, oldRate: number, newRate: number) => {
    if (rateChangeTimers.current[rateId]) clearTimeout(rateChangeTimers.current[rateId]);
    setRateChangeMap(prev => ({ ...prev, [rateId]: { oldRate, newRate } }));
    rateChangeTimers.current[rateId] = setTimeout(() => {
      setRateChangeMap(prev => { const next = { ...prev }; delete next[rateId]; return next; });
      delete rateChangeTimers.current[rateId];
    }, 4000);
  };

  const startEditRate = (r: Rate) => {
    setEditingRateId(r.id);
    setEditingRateValue(r.rate);
  };

  const cancelEditRate = () => {
    setEditingRateId(null);
    setEditingRateValue(0);
  };

  const saveEditRate = async (r: Rate) => {
    if (editingRateSaving === r.id || editingRateId !== r.id) return;
    if (editingRateValue === r.rate) { cancelEditRate(); return; }
    setEditingRateId(null);
    setEditingRateSaving(r.id);
    try {
      const oldRate = r.rate;
      await updateRate(r.id, { rate: editingRateValue });
      markRateChange(r.id, oldRate, editingRateValue);
      fetchRates();
    } catch {
      setEditingRateId(r.id);
    } finally {
      setEditingRateSaving(null);
    }
  };

  const toggleRateActive = async (r: Rate) => {
    if (editingRateSaving === r.id) return;
    setEditingRateSaving(r.id);
    try {
      await updateRate(r.id, { is_active: !r.is_active });
      fetchRates();
    } finally {
      setEditingRateSaving(null);
    }
  };

  const saveEffectiveDate = async (r: Rate, date: string) => {
    if (!date || date === r.effective_from || editingRateSaving === r.id) return;
    setEditingRateSaving(r.id);
    try {
      await updateRate(r.id, { effective_from: date });
      fetchRates();
    } finally {
      setEditingRateSaving(null);
    }
  };

  // Fetch client-specific rates
  const [clientRates, setClientRates] = useState<Rate[]>([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [ratesError, setRatesError] = useState('');
  const fetchRates = async () => {
    if (!id) return;
    setLoadingRates(true);
    setRatesError('');
    try {
      const rates = await reloadClientRates(id);
      setClientRates(rates);
    } catch {
      setRatesError('Failed to load rates');
    } finally {
      setLoadingRates(false);
    }
  };
  useEffect(() => { fetchRates(); }, [id]);

  const handleTopup = () => {
    updateClient(client.id, { balance: client.balance + topupAmount });
    setShowTopup(false);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteClient(client.id);
      navigate('/clients');
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await api.post(`/clients/${client.id}/restore`);
      window.location.reload();
    } finally {
      setRestoring(false);
    }
  };

  const usageData = [
    { month: 'Jan', sms: 150000, cost: 3750 },
    { month: 'Feb', sms: 180000, cost: 4500 },
    { month: 'Mar', sms: 220000, cost: 5500 },
    { month: 'Apr', sms: 195000, cost: 4875 },
    { month: 'May', sms: 210000, cost: 5250 },
    { month: 'Jun', sms: 240000, cost: 6000 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-800">{client.company_name}</h1>              <Badge variant={(({active:'success',suspended:'danger',deleted:'danger'} as Record<string,string>)[client.status]||'warning') as any}>{client.status}</Badge>
            </div>
            <p className="text-gray-500">{client.client_code} • {client.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Edit size={16} />} onClick={() => navigate(`/clients/${client.id}/edit`)}>Edit</Button>
          {client.status === 'deleted' ? (
            <Button variant="success" icon={<RefreshCw size={16} />} onClick={handleRestore} loading={restoring}>Restore</Button>
          ) : (
            <Button variant="secondary" icon={<Send size={16} />} onClick={() => {}}>Send Welcome Email</Button>
          )}
          {client.status !== 'deleted' && (
            <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setShowDelete(true)}>Delete</Button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
          <CreditCard size={20} className="mb-2" />
          <p className="text-sm opacity-80">Balance</p>
          <p className="text-2xl font-bold">€{client.balance.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white">
          <BarChart3 size={20} className="mb-2" />
          <p className="text-sm opacity-80">Credit Limit</p>
          <p className="text-2xl font-bold">€{client.credit_limit.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white">
          <MessageSquare size={20} className="mb-2" />
          <p className="text-sm opacity-80">SMS This Month</p>
          <p className="text-2xl font-bold">{clientSMS.length.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-5 text-white">
          <Radio size={20} className="mb-2" />
          <p className="text-sm opacity-80">Max TPS</p>
          <p className="text-2xl font-bold">{client.max_tps}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-sm text-gray-500">Actions</p>
          <Button size="sm" onClick={() => setShowTopup(true)} className="mt-2 w-full">Top Up</Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/testing/sms')} className="mt-2 w-full">Send Test SMS</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['overview', 'cdr', 'usage', 'payments', 'rates'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Company Details">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-gray-500">Company</p><p className="font-medium">{client.company_name}</p></div>
              <div><p className="text-gray-500">Client Code</p><p className="font-mono">{client.client_code}</p></div>
              <div><p className="text-gray-500">Contact</p><p>{client.contact_person}</p></div>
              <div><p className="text-gray-500">Email</p><p>{client.email}</p></div>
              <div><p className="text-gray-500">Phone</p><p>{client.phone}</p></div>
              <div><p className="text-gray-500">Country</p><p>{client.country}</p></div>
              <div className="col-span-2"><p className="text-gray-500">Address</p><p>{client.address}</p></div>
            </div>
          </Card>

          <Card title="SMPP/HTTP Settings">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-gray-500">SMPP Username</p><p className="font-mono">{client.smpp_username}</p></div>
              <div><p className="text-gray-500">System Type</p><p>{client.system_type}</p></div>
              <div><p className="text-gray-500">Port</p><p>{client.smpp_port}</p></div>
              <div><p className="text-gray-500">Max TPS</p><p>{client.max_tps}</p></div>
              <div><p className="text-gray-500">Billing Mode</p><Badge variant={client.billing_mode === 'dlr' ? 'info' : 'warning'}>{client.billing_mode}</Badge></div>
              <div><p className="text-gray-500">API Enabled</p><Badge variant={client.api_enabled ? 'success' : 'default'}>{client.api_enabled ? 'Yes' : 'No'}</Badge></div>
              <div><p className="text-gray-500">Force DLR</p><Badge variant={client.force_dlr ? 'success' : 'default'}>{client.force_dlr ? 'Yes' : 'No'}</Badge></div>
              {client.force_dlr && <div><p className="text-gray-500">DLR Timeout</p><p className="font-mono">{client.force_dlr_timeout_mode === 'fixed' ? `${client.dlr_timeout || 150}s` : client.force_dlr_timeout_mode === 'random_0_5' ? 'Random 0–5s' : 'Random 0–10s'}</p></div>}
              {client.webhook_url && <div className="col-span-2"><p className="text-gray-500">Webhook</p><p className="text-xs font-mono">{client.webhook_url}</p></div>}
            </div>
          </Card>

          <Card title={`IP Whitelist (${clientIPs.length})`}>
            {loadingIPs ? (
              <p className="text-sm text-gray-500 text-center py-4">Loading...</p>
            ) : (
              <div className="space-y-3">
                {ipError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{ipError}</div>
                )}
                {clientIPs.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No IPs whitelisted. Add at least one for SMPP access.</p>
                ) : (
                  <div className="space-y-2">{clientIPs.map(ip => (
                    <div key={ip.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                      <div className="flex items-center gap-2">
                        <Shield size={14} className="text-green-500" />
                        <span className="font-mono text-sm">{ip.ip_address}</span>
                        {ip.label && <span className="text-xs text-gray-400">({ip.label})</span>}
                      </div>
                      <button onClick={() => removeIP(ip.id)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}</div>
                )}
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <input
                    type="text"
                    value={newIP}
                    onChange={e => setNewIP(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addIP(); } }}
                    placeholder="192.168.1.100"
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <input
                    type="text"
                    value={newIPLabel}
                    onChange={e => setNewIPLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addIP(); } }}
                    placeholder="Label (optional)"
                    className="w-32 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <button
                    type="button"
                    onClick={addIP}
                    disabled={!newIP}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              </div>
            )}
          </Card>

          <Card title="Routing Configuration">
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600">Route Plan</span>
                <Badge variant="info">{routePlan?.plan_name || 'None'}</Badge>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600">Currency</span>
                <Badge>{client.currency}</Badge>
              </div>
            </div>
          </Card>

          <Card title="Recent Invoices">
            {clientInvoices.length === 0 ? (
              <p className="text-gray-500 text-sm">No invoices yet</p>
            ) : (
              <div className="space-y-3">
                {clientInvoices.slice(0, 3).map(inv => (
                  <div key={inv.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-800">{inv.invoice_number}</p>
                      <p className="text-xs text-gray-500">{new Date(inv.period_start).toLocaleDateString()} - {new Date(inv.period_end).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">€{inv.grand_total.toLocaleString()}</p>
                      <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'overdue' ? 'danger' : 'warning'}>{inv.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'cdr' && (
        <Card title="CDR (Call Detail Records)" noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clientSMS.slice(0, 20).map(sms => (
                  <tr key={sms.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><span className="font-mono text-xs">{sms.message_id.slice(0, 12)}...</span></td>
                    <td className="px-4 py-3"><span className="font-mono">{sms.destination}</span></td>
                    <td className="px-4 py-3"><Badge variant={sms.status === 'delivered' ? 'success' : sms.status === 'failed' ? 'danger' : 'warning'} size="sm">{sms.status}</Badge></td>
                    <td className="px-4 py-3">€{sms.client_rate.toFixed(4)}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(sms.submit_time).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'usage' && (
        <Card title="Monthly Usage">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <p className="text-sm text-blue-600">Total SMS</p>
                <p className="text-2xl font-bold text-blue-700">1.2M</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <p className="text-sm text-green-600">Total Cost</p>
                <p className="text-2xl font-bold text-green-700">€30,000</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <p className="text-sm text-purple-600">Avg Rate/SMS</p>
                <p className="text-2xl font-bold text-purple-700">€0.025</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Month</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">SMS Count</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {usageData.map((row, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 font-medium">{row.month}</td>
                      <td className="px-4 py-3 text-right">{row.sms.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-semibold">€{row.cost.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'payments' && (
        <Card title="Payment History" noPadding>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {clientPayments.map(p => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-mono text-xs">{p.reference}</td>
                  <td className="px-4 py-3">{p.method}</td>
                  <td className="px-4 py-3 text-right font-semibold">€{p.amount.toLocaleString()}</td>
                  <td className="px-4 py-3">{p.date}</td>
                  <td className="px-4 py-3"><Badge variant="success">{p.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === 'rates' && (
        <Card title={`Client Rates (${clientRates.length})`}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Rates fetched directly for {client.company_name}</p>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openQuickAddRate}>Quick Add Rate</Button>
              <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={fetchRates} loading={loadingRates}>Refresh</Button>
            </div>
          </div>
          {clientRates.length === 0 && !loadingRates ? (
            <p className="text-gray-500 text-sm py-4 text-center">{ratesError ? <span className="text-red-500">{ratesError}</span> : 'No rates configured for this client'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Operator</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">MCC/MNC</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Rate (EUR)</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Effective</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {clientRates.map((r: any) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-medium">{r.country}</td>
                      <td className="px-3 py-2.5 text-gray-600">{r.operator}</td>
                      <td className="px-3 py-2.5"><span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">{r.mcc}{r.mnc}</span></td>
                      <td className="px-3 py-2.5 text-right">
                        {editingRateId === r.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              step="0.0001"
                              value={editingRateValue}
                              onChange={e => setEditingRateValue(parseFloat(e.target.value) || 0)}
                              onKeyDown={e => { if (e.key === 'Enter') saveEditRate(r); if (e.key === 'Escape') cancelEditRate(); }}
                              onBlur={() => saveEditRate(r)}
                              className="w-24 px-2 py-1 text-right border border-blue-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                              autoFocus
                            />
                            <span className="text-xs text-gray-400">EUR</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditRate(r)}
                            className="font-semibold text-sm cursor-pointer hover:text-blue-600 hover:bg-blue-50 px-2 py-0.5 rounded transition-colors group relative"
                            title="Click to edit rate"
                          >
                            {editingRateSaving === r.id ? (
                              <span className="text-gray-400 italic text-xs">saving…</span>
                            ) : (
                              <span className="flex items-center gap-1">
                                €{Number(r.rate).toFixed(4)}
                                {rateChangeMap[r.id] && (
                                  rateChangeMap[r.id].newRate > rateChangeMap[r.id].oldRate
                                    ? <span title={`Increased from €${rateChangeMap[r.id].oldRate.toFixed(4)}`}><TrendingUp size={12} className="text-green-500" /></span>
                                    : <span title={`Decreased from €${rateChangeMap[r.id].oldRate.toFixed(4)}`}><TrendingDown size={12} className="text-red-500" /></span>
                                )}
                                <Edit size={10} className="inline ml-1 opacity-0 group-hover:opacity-100 text-gray-400 -mt-0.5" />
                              </span>
                            )}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => toggleRateActive(r)}
                          className="cursor-pointer"
                          title={`Click to ${r.is_active ? 'deactivate' : 'activate'} rate`}
                        >
                          {editingRateSaving === r.id ? (
                            <span className="text-gray-400 italic text-xs">…</span>
                          ) : (
                            <Badge variant={r.is_active ? 'success' : 'danger'} size="sm">{r.is_active ? 'Active' : 'Inactive'}</Badge>
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">
                        <input
                          type="date"
                          value={r.effective_from ? r.effective_from.split('T')[0] : ''}
                          onChange={e => saveEffectiveDate(r, e.target.value)}
                          className="bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-300 w-[130px]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Topup Modal */}
      <Modal isOpen={showTopup} onClose={() => setShowTopup(false)} title="Top Up Balance"
        footer={<div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setShowTopup(false)}>Cancel</Button><Button onClick={handleTopup}>Confirm Top Up</Button></div>}>
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-700">Current Balance: <strong>€{client.balance.toLocaleString()}</strong></p>
          </div>
          <Input label="Top Up Amount (EUR)" type="number" value={topupAmount} onChange={(e) => setTopupAmount(Number(e.target.value))} min={1} />
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-700">New Balance: <strong>€{(client.balance + topupAmount).toLocaleString()}</strong></p>
          </div>
        </div>
      </Modal>

      {/* Quick Add Rate Modal */}
      <Modal
        isOpen={showQuickAddRate}
        onClose={() => setShowQuickAddRate(false)}
        title={`Quick Add Rate — ${client.company_name}`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowQuickAddRate(false)}>Cancel</Button>
            <Button onClick={handleQuickAddRate} loading={quickRateSubmitting} disabled={!quickRateCountry || !quickRateValue}>Add Rate</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
            Client: <strong>{client.client_code} — {client.company_name}</strong>
          </div>
          {quickRateError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{quickRateError}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
            <select
              value={quickRateCountry}
              onChange={e => { setQuickRateCountry(e.target.value); setQuickRateMnc(''); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Country</option>
              {[...new Set((mccmnc || []).filter(m => m && m.country).map(m => m.country))].sort().map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {quickRateCountry && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Operator</label>
              <select
                value={quickRateMnc}
                onChange={e => setQuickRateMnc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Operators (*)</option>
                {(mccmnc || []).filter(m => m.country === quickRateCountry).map(op => (
                  <option key={op.mnc} value={op.mnc}>{op.mnc} — {op.operator} ({op.network_type})</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Input label="Rate (EUR) *" type="number" step="0.0001" value={quickRateValue} onChange={e => setQuickRateValue(parseFloat(e.target.value) || 0)} placeholder="0.0000" />
          </div>
          <div>
            <Input label="Effective From" type="date" value={quickRateEffective} onChange={e => setQuickRateEffective(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={quickRateActive} onChange={e => setQuickRateActive(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <span className="text-sm text-gray-700">Active</span>
          </label>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        title="Delete Client"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleting}>Soft-Delete Client</Button>
          </div>
        }
      >
        <p className="text-gray-600">
          Are you sure you want to delete <strong>{client.company_name}</strong>?
          This will <strong>soft-delete</strong> the client — SMS logs, payments, and invoices will remain active.
        </p>
      </Modal>
    </div>
  );
};
