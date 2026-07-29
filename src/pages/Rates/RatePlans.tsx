import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, DollarSign, Star, StarOff, ChevronDown, ChevronRight, RefreshCw, TrendingUp, TrendingDown, Copy, Upload, FileText } from 'lucide-react';
import { useData } from '../../store/DataContext';
import { api } from '../../services/api';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Modal } from '../../components/UI/Modal';
import { Badge } from '../../components/UI/Badge';
import { RatePlan } from '../../types';

export const RatePlans: React.FC = () => {
  const { ratePlans, isLoading, clients, suppliers, mccmnc, addRatePlan, updateRatePlan, deleteRatePlan } = useData();

  // Compute which plans have active clients and suppliers assigned
  const planUsageCount = React.useMemo(() => {
    const map: Record<string, { count: number; names: string[] }> = {};
    for (const c of clients) {
      if (c.status !== 'deleted' && c.rate_plan_id) {
        if (!map[c.rate_plan_id]) map[c.rate_plan_id] = { count: 0, names: [] };
        map[c.rate_plan_id].count++;
        map[c.rate_plan_id].names.push(`${c.client_code} (${c.company_name})`);
      }
    }
    for (const s of suppliers) {
      if (s.status !== 'deleted' && s.rate_plan_id) {
        if (!map[s.rate_plan_id]) map[s.rate_plan_id] = { count: 0, names: [] };
        map[s.rate_plan_id].count++;
        map[s.rate_plan_id].names.push(`${s.supplier_code} (${s.company_name})`);
      }
    }
    return map;
  }, [clients, suppliers]);

  // ─── Plan modal state ───────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editPlan, setEditPlan] = useState<RatePlan | null>(null);
  const [deletePlan, setDeletePlan] = useState<RatePlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ plan_name: '', description: '', is_default: false });

  // ─── Bulk active/inactive management ───────────────
  const [selectedRates, setSelectedRates] = useState<Record<string, Set<string>>>({});
  const [bulkSaving, setBulkSaving] = useState(false);

  const toggleRateSelect = (planId: string, rateId: string) => {
    setSelectedRates(prev => {
      const s = new Set(prev[planId] || []);
      if (s.has(rateId)) s.delete(rateId); else s.add(rateId);
      return { ...prev, [planId]: s };
    });
  };
  const selectAllRates = (planId: string, rates: any[]) => {
    setSelectedRates(prev => ({ ...prev, [planId]: new Set(rates.map(r => r.id)) }));
  };
  const deselectAllRates = (planId: string) => {
    setSelectedRates(prev => ({ ...prev, [planId]: new Set() }));
  };
  const bulkSetActive = async (planId: string, active: boolean) => {
    const ids = selectedRates[planId];
    if (!ids || ids.size === 0) return;
    setBulkSaving(true);
    try {
      for (const rid of Array.from(ids)) {
        await api.put(`/rates/${rid}`, { is_active: active }).catch(() => {});
      }
      deselectAllRates(planId);
      fetchPlanRates(planId);
    } finally { setBulkSaving(false); }
  };

  // ─── Expanded plans & rates state ──────────────────────
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());
  const [planRates, setPlanRates] = useState<Record<string, any[]>>({});
  const [loadingRates, setLoadingRates] = useState<Record<string, boolean>>({});
  const [rateCounts, setRateCounts] = useState<Record<string, number>>({});

  // Fetch rate counts for all plans on mount (lightweight, no rate data)
  useEffect(() => {
    api.get('/rates').then((res: any) => {
      if (res?.success && Array.isArray(res.data)) {
        const counts: Record<string, number> = {};
        for (const r of res.data) {
          const id = String(r.entity_id);
          counts[id] = (counts[id] || 0) + 1;
        }
        setRateCounts(counts);
      }
    }).catch(() => {});
  }, []);

  // Clean up rate change timers on unmount
  useEffect(() => {
    const timers = rateChangeTimers.current;
    return () => { Object.values(timers).forEach(clearTimeout); };
  }, []);

  // ─── Inline rate editing ───────────────────────────────
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [editingRateValue, setEditingRateValue] = useState<number>(0);
  const [editingRateSaving, setEditingRateSaving] = useState<string | null>(null);
  const [rateChangeMap, setRateChangeMap] = useState<Record<string, { oldRate: number; newRate: number }>>({});
  const rateChangeTimers = useRef<Record<string, NodeJS.Timeout>>({});

  // ─── Quick add rate (bulk by country) ───────────────
  const [showQuickAdd, setShowQuickAdd] = useState<string | null>(null); // plan_id
  const [quickCountry, setQuickCountry] = useState('');
  const [quickCountryMcc, setQuickCountryMcc] = useState('');
  const [quickOperators, setQuickOperators] = useState<{ mcc: string; mnc: string; country: string; operator: string; selected: boolean; existingRate?: number }[]>([]);
  const [quickRateValue, setQuickRateValue] = useState('');
  const [quickRateError, setQuickRateError] = useState('');
  const [quickRateSubmitting, setQuickRateSubmitting] = useState(false);
  const [quickRateNotify, setQuickRateNotify] = useState(true);

  // ─── Clone rate ──────────────────────────────────────
  const [showClone, setShowClone] = useState<{ rate: any; sourcePlanId: string } | null>(null);
  const [cloneTargetPlanId, setCloneTargetPlanId] = useState('');
  const [cloneSubmitting, setCloneSubmitting] = useState(false);
  const [cloneError, setCloneError] = useState('');

  // ─── Bulk CSV upload ─────────────────────────────────
  const [showCSV, setShowCSV] = useState<{ planId: string; planName: string } | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvError, setCsvError] = useState('');
  const [csvSubmitting, setCsvSubmitting] = useState(false);

  // Expanded country list for quick add
  const countryList = React.useMemo(() => {
    const seen = new Set<string>();
    return mccmnc.filter(m => {
      const key = m.country;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [mccmnc]);

  const fetchPlanRates = async (planId: string) => {
    setLoadingRates(prev => ({ ...prev, [planId]: true }));
    try {
      const res = await api.get(`/rate-plans/${planId}/rates`);
      const data = (res?.success && Array.isArray(res.data))
        ? res.data.map((r: any) => ({ ...r, rate: Number(r.rate) || 0 }))
        : [];
      setPlanRates(prev => ({ ...prev, [planId]: data }));
      setRateCounts(prev => ({ ...prev, [planId]: data.length }));
      setSelectedRates(prev => ({ ...prev, [planId]: new Set() })); // Clear stale selections
    } catch {
      setPlanRates(prev => ({ ...prev, [planId]: [] }));
    } finally {
      setLoadingRates(prev => ({ ...prev, [planId]: false }));
    }
  };

  const toggleExpand = (planId: string) => {
    setExpandedPlans(prev => {
      const next = new Set(prev);
      if (next.has(planId)) {
        next.delete(planId);
        // Clear selections when collapsing
        setSelectedRates(p => ({ ...p, [planId]: new Set() }));
      } else {
        next.add(planId);
        if (!planRates[planId]) fetchPlanRates(planId);
      }
      return next;
    });
  };

  const markRateChange = (rateId: string, oldRate: number, newRate: number) => {
    if (rateChangeTimers.current[rateId]) clearTimeout(rateChangeTimers.current[rateId]);
    setRateChangeMap(prev => ({ ...prev, [rateId]: { oldRate, newRate } }));
    rateChangeTimers.current[rateId] = setTimeout(() => {
      setRateChangeMap(prev => { const next = { ...prev }; delete next[rateId]; return next; });
    }, 4000);
  };

  // Shared helper: fan out rate change notifications to all assigned clients/suppliers
  const notifyPlanAssignees = (planId: string, rateIds: string[], dest: string, oldRate: number, newRate: number, changePct: string) => {
    const usage = planUsageCount[planId];
    if (!usage || usage.count === 0) return;
    for (const name of usage.names) {
      const isClient = name.includes(' (') && clients.some(c => `${c.client_code} (${c.company_name})` === name);
      const isSupplier = !isClient && suppliers.some(s => `${s.supplier_code} (${s.company_name})` === name);
      if (isClient || isSupplier) {
        const entity = isClient
          ? clients.find(c => `${c.client_code} (${c.company_name})` === name)
          : suppliers.find(s => `${s.supplier_code} (${s.company_name})` === name);
        if (entity) {
          api.post('/rates/notify', {
            entity_type: isClient ? 'client' : 'supplier',
            entity_id: parseInt(entity.id),
            rate_ids: rateIds,
            destination: dest,
            old_rate: oldRate,
            new_rate: newRate,
            change_pct: changePct,
          }).catch(() => {});
        }
      }
    }
  };

  const startEditRate = (r: any) => {
    setEditingRateId(r.id);
    setEditingRateValue(Number(r.rate));
  };
  const cancelEditRate = () => { setEditingRateId(null); };

  const saveEditRate = async (r: any, planId: string) => {
    if (editingRateSaving === r.id || editingRateId !== r.id) return;
    if (editingRateValue === r.rate) { cancelEditRate(); return; }
    setEditingRateId(null);
    setEditingRateSaving(r.id);
    try {
      const oldRate = Number(r.rate);
      await api.post('/rates', {
        entity_type: 'rate_plan',
        entity_id: planId,
        mcc: r.mcc,
        mnc: r.mnc,
        country: r.country,
        operator: r.operator,
        rate: editingRateValue,
      });
      {
        // notification and fetch use same scope
        markRateChange(r.id, oldRate, editingRateValue);
        fetchPlanRates(planId);
        // Notify all assigned clients and suppliers about rate change
        try {
          const pct = oldRate > 0 ? ((editingRateValue - oldRate) / oldRate * 100) : 0;
          const pctStr = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
          const dest = `${r.country} ${r.mcc}${r.mnc !== '*' ? r.mnc : ''}`;
          notifyPlanAssignees(planId, [r.id], dest, oldRate, editingRateValue, pctStr);
        } catch {}
      }
    } catch {
      setEditingRateId(r.id);
    } finally {
      setEditingRateSaving(null);
    }
  };

  const toggleRateActive = async (r: any, planId: string) => {
    if (editingRateSaving === r.id) return;
    setEditingRateSaving(r.id);
    try {
      await api.put(`/rates/${r.id}`, { is_active: !r.is_active });
      fetchPlanRates(planId);
    } finally {
      setEditingRateSaving(null);
    }
  };

  const saveEffectiveDate = async (r: any, date: string, planId: string) => {
    if (!date || date === r.effective_from || editingRateSaving === r.id) return;
    setEditingRateSaving(r.id);
    try {
      await api.put(`/rates/${r.id}`, { effective_from: date });
      fetchPlanRates(planId);
    } finally {
      setEditingRateSaving(null);
    }
  };

  const handleCloneRate = async () => {
    if (!showClone || !cloneTargetPlanId || cloneTargetPlanId === showClone.sourcePlanId) return;
    setCloneSubmitting(true);
    setCloneError('');
    try {
      await api.post('/rates', {
        entity_type: 'rate_plan',
        entity_id: cloneTargetPlanId,
        mcc: showClone.rate.mcc,
        mnc: showClone.rate.mnc,
        country: showClone.rate.country,
        operator: showClone.rate.operator,
        rate: showClone.rate.rate,
      });
      setShowClone(null);
      setCloneTargetPlanId('');
      setRateCounts(prev => ({ ...prev, [cloneTargetPlanId]: (prev[cloneTargetPlanId] || 0) + 1 }));
      if (planRates[cloneTargetPlanId]) fetchPlanRates(cloneTargetPlanId);
    } catch {
      setCloneError('Failed to clone rate');
    } finally {
      setCloneSubmitting(false);
    }
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError('');
    setCsvPreview([]);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = (ev.target?.result as string) || '';
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { setCsvError('CSV must have a header row and at least one data row'); return; }
        const headers = lines[0].toLowerCase().replace(/\s+/g, '_').split(',');
        const mccIdx = headers.findIndex((h: string) => h === 'mcc');
        const mncIdx = headers.findIndex((h: string) => h === 'mnc');
        const countryIdx = headers.findIndex((h: string) => h === 'country');
        const operatorIdx = headers.findIndex((h: string) => h === 'operator');
        const rateIdx = headers.findIndex((h: string) => h === 'rate');
        if (mccIdx < 0 || rateIdx < 0) { setCsvError('CSV must have at least "mcc" and "rate" columns'); return; }
        const rows: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',');
          const mcc = (cols[mccIdx] || '').trim();
          const rate = parseFloat((cols[rateIdx] || '').trim());
          if (!mcc || isNaN(rate)) continue;
          rows.push({
            mcc,
            mnc: mncIdx >= 0 ? (cols[mncIdx] || '*').trim() || '*' : '*',
            country: countryIdx >= 0 ? (cols[countryIdx] || '').trim() : mcc,
            operator: operatorIdx >= 0 ? (cols[operatorIdx] || 'All').trim() || 'All' : 'All',
            rate,
          });
        }
        if (rows.length === 0) { setCsvError('No valid data rows found'); return; }
        setCsvPreview(rows);
      } catch { setCsvError('Failed to parse CSV file'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleBulkSubmit = async () => {
    if (!showCSV || csvPreview.length === 0) return;
    setCsvSubmitting(true);
    setCsvError('');
    try {
      await api.post('/rates/bulk', {
        rates: csvPreview.map(r => ({
          entity_type: 'rate_plan',
          entity_id: showCSV.planId,
          mcc: r.mcc,
          mnc: r.mnc,
          country: r.country,
          operator: r.operator,
          rate: r.rate,
          effective_from: new Date().toISOString().split('T')[0],
        })),
      });
      setShowCSV(null);
      setCsvPreview([]);
      setRateCounts(prev => ({ ...prev, [showCSV.planId]: (prev[showCSV.planId] || 0) + csvPreview.length }));
      fetchPlanRates(showCSV.planId);
    } catch {
      setCsvError('Failed to bulk upload rates');
    } finally {
      setCsvSubmitting(false);
    }
  };

  const handleQuickAddRate = async () => {
    if (!showQuickAdd || !quickCountryMcc || !quickRateValue) return;
    const selected = quickOperators.filter(o => o.selected);
    if (selected.length === 0) { setQuickRateError('Select at least one operator'); return; }
    setQuickRateSubmitting(true);
    setQuickRateError('');
    const planId = showQuickAdd;
    const rate = parseFloat(quickRateValue);
    let ok = 0, fail = 0;
    const createdIds: string[] = [];
    try {
      // Create rates for each selected operator in sequence
      for (const op of selected) {
        try {
          const res = await api.post('/rates', {
            entity_type: 'rate_plan',
            entity_id: planId,
            mcc: op.mcc,
            mnc: op.mnc,
            country: op.country,
            operator: op.operator,
            rate,
          });
          if (res?.data?.id) createdIds.push(String(res.data.id));
          ok++;
        } catch { fail++; }
      }
      setShowQuickAdd(null);
      setQuickCountry(''); setQuickCountryMcc(''); setQuickOperators([]); setQuickRateValue('');
      setRateCounts(prev => ({ ...prev, [planId]: (prev[planId] || 0) + ok }));
      fetchPlanRates(planId);
      // Notify all assigned clients and suppliers about new rates
      try {
        if (createdIds.length > 0 && quickRateNotify) {
          const dest = `${quickCountry} ${quickCountryMcc} (${ok} operators)`;
          notifyPlanAssignees(planId, createdIds, dest, 0, rate, 'New');
        }
      } catch {}
    } catch (e: any) {
      setQuickRateError(e?.message || `Failed: ${ok} ok / ${fail} failed`);
    } finally {
      setQuickRateSubmitting(false);
    }
  };

  // ─── Plan CRUD ──────────────────────────────────────
  const openAdd = () => {
    setEditPlan(null);
    setError('');
    setForm({ plan_name: '', description: '', is_default: false });
    setShowModal(true);
  };

  const openEdit = (plan: RatePlan) => {
    setEditPlan(plan);
    setError('');
    setForm({ plan_name: plan.plan_name, description: plan.description || '', is_default: plan.is_default });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.plan_name.trim()) return;
    setSaving(true);
    try {
      if (editPlan) {
        await updateRatePlan(editPlan.id, form);
      } else {
        await addRatePlan(form);
      }
      setShowModal(false);
      setEditPlan(null);
    } catch {
      setError('Failed to save rate plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletePlan) return;
    setError('');
    try {
      await deleteRatePlan(deletePlan.id);
      setDeletePlan(null);
    } catch {
      setError('Failed to delete rate plan');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Rate Plans</h1>
          <p className="text-gray-500 mt-1">Manage pricing rate plans with MCCMNC rates for clients and suppliers</p>
        </div>
        <Button icon={<Plus size={18} />} onClick={openAdd}>Add Rate Plan</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total Plans</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{ratePlans.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Default Plan</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {ratePlans.find(p => p.is_default)?.plan_name || 'None'}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total Assigned</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {Object.values(planUsageCount).reduce((sum, u) => sum + u.count, 0)}
          </p>
        </div>
      </div>

      {/* Rate Plans Table with expandable rates */}
      <Card noPadding>
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          </div>
        ) : ratePlans.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <DollarSign size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No rate plans configured</p>
            <p className="text-xs text-gray-400 mt-1">Create your first rate plan to assign pricing</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-10">Default</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rates</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">In Use</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ratePlans.map(plan => {
                const isExpanded = expandedPlans.has(plan.id);
                const rates = planRates[plan.id] || [];
                const ratesLoading = loadingRates[plan.id] || false;
                return (
                  <React.Fragment key={plan.id}>
                    {/* Plan row */}
                    <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-blue-50/30' : ''}`}>
                      <td className="px-2 py-3">
                        <button onClick={() => toggleExpand(plan.id)} className="p-1 rounded hover:bg-gray-200">
                          {isExpanded ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-400" />}
                        </button>
                      </td>
                      <td className="px-2 py-3">
                        {plan.is_default ? <Star size={16} className="text-amber-500 fill-amber-500" /> : <StarOff size={16} className="text-gray-300" />}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <DollarSign size={14} className="text-blue-500" />
                          <span className="font-medium text-gray-800">{plan.plan_name}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-gray-600 max-w-xs truncate">{plan.description || '—'}</td>
                      <td className="px-2 py-3 text-center">
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {rateCounts[plan.id] !== undefined ? `${rateCounts[plan.id]} rates` : '…'}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-center">
                        {planUsageCount[plan.id] ? (
                          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            {planUsageCount[plan.id].count} assigned
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => openEdit(plan)} className="p-1.5 rounded hover:bg-gray-100" title="Edit rate plan">
                            <Edit size={14} className="text-gray-500" />
                          </button>
                          {!plan.is_default && (
                            <button
                              onClick={() => !planUsageCount[plan.id] && setDeletePlan(plan)}
                              className="p-1.5 rounded hover:bg-red-50"
                              title={planUsageCount[plan.id] ? `Cannot delete: ${planUsageCount[plan.id].count} assigned` : 'Delete rate plan'}
                            >
                              <Trash2 size={14} className={planUsageCount[plan.id] ? 'text-gray-300 cursor-not-allowed' : 'text-red-500'} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Expanded rates sub-table */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="bg-gray-50/50 border-b px-4 py-3">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                MCCMNC Rates — {plan.plan_name}
                              </span>
                              <span className="text-[10px] text-gray-500">
                                <span className="text-green-600 font-medium">{rates.filter((r:any) => r.is_active).length} active</span>
                                {' / '}
                                <span className="text-red-500 font-medium">{rates.filter((r:any) => !r.is_active).length} inactive</span>
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="primary" size="sm" icon={<Plus size={14} />}
                                onClick={() => { setShowQuickAdd(plan.id); setQuickRateError(''); setQuickRateNotify(true); }}>
                                Quick Add Rate
                              </Button>
                              <Button variant="secondary" size="sm" icon={<Upload size={14} />}
                                onClick={() => { setShowCSV({ planId: plan.id, planName: plan.plan_name }); setCsvPreview([]); setCsvError(''); }}>
                                Bulk CSV
                              </Button>
                              <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />}
                                onClick={() => fetchPlanRates(plan.id)} loading={ratesLoading}>
                                Refresh
                              </Button>
                              {(selectedRates[plan.id]?.size || 0) > 0 && (
                                <>
                                  <Button variant="success" size="sm" onClick={() => bulkSetActive(plan.id, true)} loading={bulkSaving}>
                                    Activate ({selectedRates[plan.id].size})
                                  </Button>
                                  <Button variant="danger" size="sm" onClick={() => bulkSetActive(plan.id, false)} loading={bulkSaving}>
                                    Deactivate ({selectedRates[plan.id].size})
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          {ratesLoading ? (
                            <p className="text-xs text-gray-400 py-4 text-center">Loading rates...</p>
                          ) : rates.length === 0 ? (
                            <div className="text-center py-6">
                              <DollarSign size={28} className="mx-auto mb-2 text-gray-300" />
                              <p className="text-sm text-gray-500">No rates configured for this plan</p>
                              <p className="text-xs text-gray-400 mt-1">Click "Quick Add Rate" to add MCCMNC pricing</p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <div className="flex items-center gap-3 mb-2">
                                <button onClick={() => selectAllRates(plan.id, rates)} className="text-[10px] text-blue-600 hover:text-blue-800">Select All</button>
                                <button onClick={() => deselectAllRates(plan.id)} className="text-[10px] text-gray-500 hover:text-gray-700">Deselect All</button>
                              </div>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-white border-b">
                                    <th className="px-1 py-1.5 w-6"></th>
                                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Country</th>
                                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Operator</th>
                                    <th className="px-2 py-1.5 text-center text-[10px] font-medium text-gray-500 uppercase">MCC/MNC</th>
                                    <th className="px-2 py-1.5 text-right text-[10px] font-medium text-gray-500 uppercase">Rate (EUR)</th>
                                    <th className="px-2 py-1.5 text-center text-[10px] font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Effective</th>
                                    <th className="px-2 py-1.5 w-8"></th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {rates.map((r: any) => (
                                    <tr key={r.id} className={`hover:bg-white ${(selectedRates[plan.id]?.has(r.id)) ? 'bg-blue-50/30' : ''}`}>
                                      <td className="px-1 py-1.5">
                                        <input type="checkbox" checked={selectedRates[plan.id]?.has(r.id) || false}
                                          onChange={() => toggleRateSelect(plan.id, r.id)}
                                          className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600" />
                                      </td>
                                      <td className="px-2 py-1.5 font-medium">{r.country}</td>
                                      <td className="px-2 py-1.5 text-gray-600">{r.operator}</td>
                                      <td className="px-2 py-1.5 text-center">
                                        <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-[10px]">{r.mcc}{r.mnc !== '*' ? r.mnc : ''}</span>
                                      </td>
                                      <td className="px-2 py-1.5 text-right">
                                        {editingRateId === r.id ? (
                                          <div className="flex items-center justify-end gap-1">
                                            <input type="number" step="0.0001" value={editingRateValue}
                                              onChange={e => setEditingRateValue(parseFloat(e.target.value) || 0)}
                                              onKeyDown={e => { if (e.key === 'Enter') saveEditRate(r, plan.id); if (e.key === 'Escape') cancelEditRate(); }}
                                              onBlur={() => saveEditRate(r, plan.id)}
                                              className="w-20 px-1.5 py-0.5 text-right border border-blue-400 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                                              autoFocus />
                                            <span className="text-[10px] text-gray-400">EUR</span>
                                          </div>
                                        ) : (
                                          <button onClick={() => startEditRate(r)}
                                            className="font-semibold text-xs cursor-pointer hover:text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors group relative"
                                            title="Click to edit rate">
                                            {editingRateSaving === r.id ? (
                                              <span className="text-gray-400 italic">saving…</span>
                                            ) : (
                                              <span className="flex items-center gap-1">
                                                {`€${Number(r.rate).toFixed(4)}`}
                                                {rateChangeMap[r.id] && (() => {
                                                  const old = rateChangeMap[r.id].oldRate;
                                                  const pct = old > 0 ? ((rateChangeMap[r.id].newRate - old) / old * 100) : 0;
                                                  const pctStr = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
                                                  return rateChangeMap[r.id].newRate > rateChangeMap[r.id].oldRate
                                                    ? <span className="flex items-center gap-0.5 text-green-600" title={`Increased from €${rateChangeMap[r.id].oldRate.toFixed(4)} (${pctStr})`}><TrendingUp size={10} className="text-green-500"/><span className="text-[9px] font-medium">{pctStr}</span></span>
                                                    : <span className="flex items-center gap-0.5 text-red-600" title={`Decreased from €${rateChangeMap[r.id].oldRate.toFixed(4)} (${pctStr})`}><TrendingDown size={10} className="text-red-500"/><span className="text-[9px] font-medium">{pctStr}</span></span>;
                                                })()}
                                                <Edit size={9} className="inline ml-0.5 opacity-0 group-hover:opacity-100 text-gray-400 -mt-0.5" />
                                              </span>
                                            )}
                                          </button>
                                        )}
                                      </td>
                                      <td className="px-2 py-1.5 text-center">
                                        <button onClick={() => toggleRateActive(r, plan.id)} className="cursor-pointer"
                                          title={`Click to ${r.is_active ? 'deactivate' : 'activate'} rate`}>
                                          {editingRateSaving === r.id ? (
                                            <span className="text-gray-400 italic text-[10px]">…</span>
                                          ) : (
                                            <Badge variant={r.is_active ? 'success' : 'danger'} size="sm">
                                              {r.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                          )}
                                        </button>
                                      </td>
                                      <td className="px-2 py-1.5">
                                        <input type="date"
                                          value={r.effective_from ? r.effective_from.split('T')[0] : ''}
                                          onChange={e => saveEffectiveDate(r, e.target.value, plan.id)}
                                          className="bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 text-[10px] cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-300 w-[110px]" />
                                      </td>
                                      <td className="px-2 py-1.5">
                                        <div className="flex gap-0.5">
                                          <button
                                            onClick={() => { setShowClone({ rate: r, sourcePlanId: plan.id }); setCloneTargetPlanId(''); setCloneError(''); }}
                                            className="text-blue-400 hover:text-blue-600 p-0.5" title={`Clone rate to another plan`}>
                                            <Copy size={11} />
                                          </button>
                                          <button
                                            onClick={async () => {
                                              try {
                                                await api.delete(`/rates/${r.id}`);
                                                setRateCounts(prev => ({ ...prev, [plan.id]: Math.max(0, (prev[plan.id] || 1) - 1) }));
                                                fetchPlanRates(plan.id);
                                              } catch {}
                                            }}
                                            className="text-red-400 hover:text-red-600 p-0.5" title="Delete rate">
                                            <Trash2 size={11} />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* ─── Add/Edit Plan Modal ─────────────────────────── */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditPlan(null); }}
        title={editPlan ? 'Edit Rate Plan' : 'Add Rate Plan'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setShowModal(false); setEditPlan(null); }}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.plan_name.trim()}>
              {editPlan ? 'Update' : 'Create'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
          <Input label="Plan Name" value={form.plan_name}
            onChange={(e) => setForm(prev => ({ ...prev, plan_name: e.target.value }))}
            placeholder="e.g. Standard EU Rates" required />
          <Input label="Description" value={form.description}
            onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Brief description of this rate plan..." />
          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
            <input type="checkbox" checked={form.is_default}
              onChange={(e) => setForm(prev => ({ ...prev, is_default: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <div>
              <span className="text-sm font-medium text-gray-700">Set as default plan</span>
              <p className="text-xs text-gray-500">New clients/suppliers without an explicit plan will use the default</p>
            </div>
          </label>
        </div>
      </Modal>

      {/* ─── Delete Confirmation Modal ────────────────────── */}
      <Modal
        isOpen={!!deletePlan}
        onClose={() => setDeletePlan(null)}
        title="Delete Rate Plan"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeletePlan(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}
              disabled={!!(deletePlan && planUsageCount[deletePlan.id])}>Delete</Button>
          </div>
        }
      >
        {deletePlan && planUsageCount[deletePlan.id] ? (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">Cannot delete this rate plan</p>
              <p className="text-sm text-amber-700">
                <strong>{planUsageCount[deletePlan.id].count} {planUsageCount[deletePlan.id].count === 1 ? 'entity' : 'entities'}</strong> currently assigned:
              </p>
              <ul className="mt-2 text-xs text-amber-600 list-disc list-inside space-y-0.5">
                {planUsageCount[deletePlan.id].names.map(name => <li key={name}>{name}</li>)}
              </ul>
              <p className="mt-3 text-xs text-amber-600">Reassign these to a different plan before deleting.</p>
            </div>
          </div>
        ) : (
          <p className="text-gray-600">
            Are you sure you want to delete <strong>{deletePlan?.plan_name}</strong>? This will also delete all its rates.
          </p>
        )}
      </Modal>

      {/* ─── Clone Rate Modal ───────────────────────────── */}
      <Modal
        isOpen={!!showClone}
        onClose={() => setShowClone(null)}
        title="Clone Rate to Another Plan"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowClone(null)}>Cancel</Button>
            <Button onClick={handleCloneRate} loading={cloneSubmitting}
              disabled={!cloneTargetPlanId || cloneTargetPlanId === showClone?.sourcePlanId}>
              Clone Rate
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {cloneError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{cloneError}</div>}
          {showClone && (
            <>
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                <p className="text-gray-600">Cloning rate:</p>
                <p className="font-mono text-xs mt-1">
                  <strong>{showClone.rate.country}</strong> — {showClone.rate.mcc}{showClone.rate.mnc !== '*' ? showClone.rate.mnc : ''} — €{Number(showClone.rate.rate).toFixed(4)}
                </p>
                <p className="text-xs text-gray-400 mt-1">From: {ratePlans.find(p => String(p.id) === showClone.sourcePlanId)?.plan_name || 'Unknown'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Rate Plan</label>
                <select value={cloneTargetPlanId} onChange={e => setCloneTargetPlanId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select target plan...</option>
                  {ratePlans.filter(p => {
                    if (p.id === showClone.sourcePlanId) return false;
                    // Same-type enforcement: client plans only clone to client plans, supplier to supplier
                    const srcIsClient = showClone.sourcePlanId && planUsageCount[showClone.sourcePlanId]
                      ? planUsageCount[showClone.sourcePlanId].names.some(n => n.includes('(') && clients.some(c => `${c.client_code} (${c.company_name})` === n))
                      : true;
                    const tgtIsClient = planUsageCount[p.id]
                      ? planUsageCount[p.id].names.some(n => n.includes('(') && clients.some(c => `${c.client_code} (${c.company_name})` === n))
                      : true;
                    if (!planUsageCount[showClone.sourcePlanId] || !planUsageCount[p.id]) return true; // unassigned plans can clone anywhere
                    return srcIsClient === tgtIsClient;
                  }).map(p => (
                    <option key={p.id} value={p.id}>{p.plan_name}{p.is_default ? ' (default)' : ''}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ─── Bulk CSV Upload Modal ───────────────────────── */}
      <Modal
        isOpen={!!showCSV}
        onClose={() => { setShowCSV(null); setCsvPreview([]); setCsvError(''); }}
        title={`Bulk CSV Upload — ${showCSV?.planName || ''}`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setShowCSV(null); setCsvPreview([]); setCsvError(''); }}>Cancel</Button>
            <Button onClick={handleBulkSubmit} loading={csvSubmitting} disabled={csvPreview.length === 0}>
              Upload {csvPreview.length > 0 ? `${csvPreview.length} rates` : ''}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {csvError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{csvError}</div>}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-800 mb-2">CSV Format</p>
            <p className="text-xs text-blue-700">Columns: <strong className="font-mono">mcc, mnc, country, operator, rate</strong></p>
            <p className="text-xs text-blue-600 mt-1">Only <strong>mcc</strong> and <strong>rate</strong> are required. Other columns will use defaults (* for mnc, country name for country, "All" for operator).</p>
          </div>
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
            <FileText size={32} className="mx-auto text-gray-400 mb-3" />
            <p className="text-sm text-gray-600 mb-2">Drop a CSV file or click to browse</p>
            <label className="inline-block cursor-pointer">
              <input type="file" accept=".csv" onChange={handleCSVUpload} className="sr-only" />
              <span className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                Choose CSV File
              </span>
            </label>
          </div>
          {csvPreview.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Preview ({csvPreview.length} rates)</p>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-2 py-1.5 text-left">MCC</th>
                      <th className="px-2 py-1.5 text-left">MNC</th>
                      <th className="px-2 py-1.5 text-left">Country</th>
                      <th className="px-2 py-1.5 text-left">Operator</th>
                      <th className="px-2 py-1.5 text-right">Rate (EUR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {csvPreview.slice(0, 20).map((r, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1 font-mono">{r.mcc}</td>
                        <td className="px-2 py-1 font-mono">{r.mnc}</td>
                        <td className="px-2 py-1">{r.country}</td>
                        <td className="px-2 py-1">{r.operator}</td>
                        <td className="px-2 py-1 text-right font-semibold">€{r.rate.toFixed(4)}</td>
                      </tr>
                    ))}
                    {csvPreview.length > 20 && (
                      <tr><td colSpan={5} className="px-2 py-1 text-center text-gray-400">...and {csvPreview.length - 20} more</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ─── Quick Add Rate Modal ─────────────────────────── */}
      <Modal
        isOpen={!!showQuickAdd}
        onClose={() => { setShowQuickAdd(null); setQuickCountry(''); setQuickCountryMcc(''); setQuickOperators([]); setQuickRateValue(''); }}
        title="Quick Add Rates — Bulk by Country"
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setShowQuickAdd(null); setQuickCountry(''); setQuickCountryMcc(''); setQuickOperators([]); setQuickRateValue(''); }}>Cancel</Button>
            <Button onClick={handleQuickAddRate} loading={quickRateSubmitting}
              disabled={!quickCountryMcc || !quickRateValue || quickOperators.filter(o => o.selected).length === 0}>
              Add {quickOperators.filter(o => o.selected).length} Rates
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {quickRateError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{quickRateError}</div>}
          <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
            Plan: <strong>{ratePlans.find(p => String(p.id) === showQuickAdd)?.plan_name || 'Unknown'}</strong>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <select value={quickCountry} onChange={e => {
              const c = e.target.value;
              setQuickCountry(c);
              if (!c) { setQuickCountryMcc(''); setQuickOperators([]); return; }
              const entries = mccmnc.filter(m => m.country === c);
              if (entries.length > 0) {
                setQuickCountryMcc(entries[0].mcc);
                const existingRates = planRates[showQuickAdd!] || [];
                setQuickOperators(entries.map(m => {
                  const existing = existingRates.find((er: any) => er.mcc === m.mcc && er.mnc === m.mnc && er.is_active);
                  return {
                    mcc: m.mcc, mnc: m.mnc, country: m.country, operator: m.operator || 'All',
                    selected: !existing,
                    existingRate: existing ? Number(existing.rate) : undefined,

                  };
                }));
              } else {
                setQuickCountryMcc('');
                setQuickOperators([]);
              }
            }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select country...</option>
              {countryList.map(c => (
                <option key={`${c.mcc}-${c.country}`} value={c.country}>{c.country} ({c.mcc})</option>
              ))}
            </select>
          </div>
          {quickOperators.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">
                  Operators ({quickOperators.filter(o => o.selected).length} / {quickOperators.length} selected)
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setQuickOperators(prev => prev.map(o => ({ ...o, selected: true })))} className="text-xs text-blue-600 hover:text-blue-800">Select All</button>
                  <button onClick={() => setQuickOperators(prev => prev.map(o => ({ ...o, selected: false })))} className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                {quickOperators.map((op, i) => (
                  <label key={i} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 ${op.selected ? 'bg-blue-50/50' : op.existingRate ? 'bg-amber-50/30' : ''}`}>
                    <input type="checkbox" checked={op.selected} onChange={() => setQuickOperators(prev => prev.map((o, j) => j === i ? { ...o, selected: !o.selected } : o))} className="w-4 h-4 rounded border-gray-300 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{op.operator}</p>
                      <p className="text-xs text-gray-500 font-mono">{op.mcc}/{op.mnc !== '*' ? op.mnc : '*'}{op.existingRate !== undefined ? <span className="ml-1 text-amber-600 font-medium">— €{op.existingRate.toFixed(4)} exists</span> : ''}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
          {quickCountry && quickOperators.length === 0 && (
            <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">No operators found for this country in the MCCMNC database.</p>
          )}
          <Input label="Rate (EUR) — applies to all selected operators" value={quickRateValue} onChange={(e) => setQuickRateValue(e.target.value)} placeholder="0.0250" type="number" step="0.0001" />
          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
            <input type="checkbox" checked={quickRateNotify}
              onChange={(e) => setQuickRateNotify(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <div>
              <span className="text-sm font-medium text-gray-700">Send email notification</span>
              <p className="text-xs text-gray-500">Notify assigned clients/suppliers about these new rates via email</p>
            </div>
          </label>
          {quickRateValue && quickOperators.filter(o => o.selected).length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
              Will create <strong>{quickOperators.filter(o => o.selected).length} rates</strong> at <strong>€{parseFloat(quickRateValue).toFixed(4)}</strong> for <strong>{quickCountry}</strong>.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
