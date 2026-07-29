import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Play, Regex, Phone, Type, Code2, Shield, ArrowRight, Download, Scissors, PlusCircle } from 'lucide-react';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Badge } from '../components/UI/Badge';
import { exportCSV } from '../services/exportService';
import { Table, Pagination } from '../components/UI/Table';
import { Modal } from '../components/UI/Modal';
import { Input, Select, Textarea } from '../components/UI/Input';
import { translationService } from '../services/apiServices';
import { Translation, TranslationType } from '../types';

// ============================================================
// TRANSLATION TYPE LABELS
// ============================================================

const typeLabels: Record<string, { label: string; icon: React.ReactNode; color: 'info' | 'success' | 'warning' | 'purple' | 'default' | 'danger' }> = {
  sender_id: { label: 'Sender ID', icon: <Shield size={14} />, color: 'info' },
  destination: { label: 'Dest Regex', icon: <Regex size={14} />, color: 'purple' },
  destination_strip: { label: 'Strip Digits', icon: <Scissors size={14} />, color: 'warning' },
  destination_prefix: { label: 'Add Prefix', icon: <PlusCircle size={14} />, color: 'success' },
  content: { label: 'Content', icon: <Type size={14} />, color: 'info' },
  content_otp_extract: { label: 'OTP Extract', icon: <Code2 size={14} />, color: 'danger' },
  origination: { label: 'Origination', icon: <Phone size={14} />, color: 'default' },
};

const typeCategoryLabels: Record<string, string> = {
  sender_id: 'Sender ID', destination: 'Destination', destination_strip: 'Destination',
  destination_prefix: 'Destination', content: 'Content', content_otp_extract: 'Content', origination: 'Sender ID',
};

// Helper: apply translation locally for testing
function applyTranslationLocal(input: string, pattern: string, replacement: string, type: string): string {
  if (!input || !pattern) return input;
  try {
    switch (type) {
      case 'destination_strip': {
        const n = parseInt(pattern, 10) || 0;
        return n > 0 ? input.substring(n) : input;
      }
      case 'destination_prefix': {
        return pattern + input;
      }
      case 'content_otp_extract': {
        const re = new RegExp(pattern, 'i');
        const match = input.match(re);
        if (match) {
          const otpValue = match[0];
          const template = replacement || '{otp}';
          return template.replace(/\{otp\}/gi, otpValue);
        }
        return input;
      }
      default: {
        const re = new RegExp(pattern, 'i');
        return input.replace(re, replacement);
      }
    }
  } catch (e) {
    return input;
  }
}

// Get quick templates for each translation type
function getQuickTemplates(type: string): { label: string; match: string; replace: string; desc: string }[] {
  switch (type) {
    case 'destination_strip':
      return [
        { label: 'Strip 2 digits (Bangladesh)', match: '2', replace: '', desc: '8801615069178 → 01615069178' },
        { label: 'Strip 3 digits', match: '3', replace: '', desc: 'Strips leading 3 digits' },
        { label: 'Strip 1 digit', match: '1', replace: '', desc: 'Removes first digit' },
      ];
    case 'destination_prefix':
      return [
        { label: 'Add prefix 11', match: '11', replace: '', desc: '01615069178 → 1101615069178' },
        { label: 'Add prefix 88', match: '88', replace: '', desc: 'Add Bangladesh country code' },
        { label: 'Add 00 for international', match: '00', replace: '', desc: '001615069178' },
      ];
    case 'content_otp_extract':
      return [
        { label: '4-8 Digit OTP', match: '\\d{4,8}', replace: '{otp}', desc: 'Extract numeric OTP, forward only OTP' },
        { label: 'OTP after "is"', match: '(?<=is\\s)\\d{4,8}', replace: '{otp}', desc: 'Extract OTP after "is"' },
        { label: 'Code after colon', match: '(?<=code:\\s?)\\d{4,8}', replace: '{otp}', desc: 'Extract after "code:"' },
      ];
    case 'destination':
      return [
        { label: 'Strip leading 0', match: '^0(?=[1-9])', replace: '', desc: '07900123456 → 7900123456' },
        { label: 'Remove + sign', match: '^\\+', replace: '00', desc: '+1234567890 → 001234567890' },
        { label: 'E.164 Format UK', match: '^(\\+44|0044|44)', replace: '+44', desc: 'Standardize to +44' },
      ];
    case 'sender_id':
      return [
        { label: 'Alpha to Numeric', match: 'COMPANY', replace: '12345', desc: 'Convert alpha SID to numeric' },
        { label: 'Numeric to Alpha', match: '12345', replace: 'BRAND', desc: 'Convert numeric to alpha SID' },
      ];
    default:
      return [];
  }
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export const TranslationsPage: React.FC = () => {
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Translation | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testResult, setTestResult] = useState<{ input: string; output: string } | null>(null);
  const [selectedType, setSelectedType] = useState<string>('destination');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<{
    translation_type: string;
    source_pattern: string;
    target_value: string;
    client_id: string;
    supplier_id: string;
    is_active: boolean;
  }>({
    translation_type: 'destination',
    source_pattern: '',
    target_value: '',
    client_id: '',
    supplier_id: '',
    is_active: true,
  });

  // Load translations from backend
  const loadTranslations = async () => {
    try {
      setLoading(true);
      const res = await translationService.getTranslations({});
      if (res.success) setTranslations(res.data || []);
    } catch (e) { console.error('Failed to load translations:', e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadTranslations(); }, []);

  // Filtering & pagination
  const itemsPerPage = 10;
  const filtered = translations.filter(t => {
    const ms = (t.source_pattern || '').toLowerCase().includes(search.toLowerCase()) ||
               (t.target_value || '').toLowerCase().includes(search.toLowerCase());
    const mt = typeFilter === 'all' || t.translation_type === typeFilter;
    return ms && mt;
  });
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Modal handlers
  const openModal = (t?: Translation) => {
    if (t) {
      setEditing(t);
      setForm({
        translation_type: t.translation_type,
        source_pattern: t.source_pattern,
        target_value: t.target_value,
        client_id: t.client_id || '',
        supplier_id: t.supplier_id || '',
        is_active: t.is_active,
      });
    } else {
      setEditing(null);
      setForm({ translation_type: selectedType, source_pattern: '', target_value: '', client_id: '', supplier_id: '', is_active: true });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await translationService.updateTranslation(editing.id, {
          translation_type: form.translation_type,
          source_pattern: form.source_pattern,
          target_value: form.target_value,
          client_id: form.client_id || undefined,
          supplier_id: form.supplier_id || undefined,
          is_active: form.is_active,
        });
      } else {
        await translationService.createTranslation({
          translation_type: form.translation_type as TranslationType,
          source_pattern: form.source_pattern,
          target_value: form.target_value,
          client_id: form.client_id || undefined,
          supplier_id: form.supplier_id || undefined,
        });
      }
      setShowModal(false);
      loadTranslations();
    } catch (e: any) {
      console.error('Save failed:', e);
      alert('Failed to save: ' + (e?.message || 'Unknown error'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this translation?')) return;
    try {
      await translationService.deleteTranslation(id);
      loadTranslations();
    } catch (e) {
      console.error('Delete failed:', e);
      alert('Failed to delete translation');
    }
  };

  const handleTest = async (t: Translation) => {
    const testInput = prompt('Enter test input:') || '';
    if (!testInput) return;
    try {
      const res = await translationService.testTranslation({
        translation_type: t.translation_type,
        source_pattern: t.source_pattern,
        target_value: t.target_value,
        test_input: testInput,
      });
      if (res.success) {
        setTestResult({ input: testInput, output: res.data?.output || testInput });
        setShowTestModal(true);
      }
    } catch (e) {
      // Local fallback
      const output = applyTranslationLocal(testInput, t.source_pattern, t.target_value, t.translation_type);
      setTestResult({ input: testInput, output });
      setShowTestModal(true);
    }
  };

  const handleTestCurrent = async () => {
    const testInput = prompt('Enter test input to preview:') || '8801615069178';
    if (!testInput) return;
    try {
      const res = await translationService.testTranslation({
        translation_type: form.translation_type,
        source_pattern: form.source_pattern,
        target_value: form.target_value,
        test_input: testInput,
      });
      if (res.success) {
        setTestResult({ input: testInput, output: res.data?.output || testInput });
        setShowTestModal(true);
      }
    } catch (e) {
      const output = applyTranslationLocal(testInput, form.source_pattern, form.target_value, form.translation_type);
      setTestResult({ input: testInput, output });
      setShowTestModal(true);
    }
  };

  // Table columns
  const columns = [
    {
      key: 'type', header: 'Type',
      render: (t: Translation) => (
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${t.is_active ? 'bg-blue-50' : 'bg-gray-50'}`}>
            {typeLabels[t.translation_type]?.icon || <Code2 size={14} />}
          </div>
          <div>
            <p className="font-medium text-gray-800">
              <Badge variant={typeLabels[t.translation_type]?.color || 'default'} size="sm">
                {typeLabels[t.translation_type]?.label || t.translation_type}
              </Badge>
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">{typeCategoryLabels[t.translation_type]}</p>
          </div>
        </div>
      )
    },
    {
      key: 'pattern', header: 'Pattern',
      render: (t: Translation) => (
        <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono max-w-[180px] truncate block">
          {t.source_pattern}
        </code>
      )
    },
    {
      key: 'replace', header: 'Replace',
      render: (t: Translation) => (
        <code className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded font-mono max-w-[140px] truncate block">
          {t.target_value || '(none)'}
        </code>
      )
    },
    {
      key: 'scope', header: 'Scope',
      render: (t: Translation) => {
        const parts: string[] = [];
        if (t.client_id) parts.push('Client #' + t.client_id);
        if (t.supplier_id) parts.push('Supplier #' + t.supplier_id);
        if (t.route_id) parts.push('Route #' + t.route_id);
        return <span className="text-xs text-gray-600">{parts.length ? parts.join(', ') : 'Global'}</span>;
      }
    },
    {
      key: 'active', header: 'Status',
      render: (t: Translation) => (
        <Badge variant={t.is_active ? 'success' : 'danger'} dot>{t.is_active ? 'Active' : 'Inactive'}</Badge>
      )
    },
    {
      key: 'actions', header: '',
      render: (t: Translation) => (
        <div className="flex gap-1">
          <button onClick={() => handleTest(t)} className="p-1.5 rounded hover:bg-gray-100" title="Test">
            <Play size={14} className="text-green-500" />
          </button>
          <button onClick={() => openModal(t)} className="p-1.5 rounded hover:bg-gray-100">
            <Edit size={14} className="text-gray-500" />
          </button>
          <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded hover:bg-gray-100">
            <Trash2 size={14} className="text-red-500" />
          </button>
        </div>
      )
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Translations</h1>
          <p className="text-gray-500 mt-1">Number stripping, prefix adding, OTP extraction, SID masking & content regex replacement</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Download size={16} />}
            onClick={() => exportCSV('translations_export.csv',
              ['Type', 'Pattern', 'Replace', 'Client', 'Supplier', 'Active'],
              filtered.map(t => [typeLabels[t.translation_type]?.label || t.translation_type, t.source_pattern, t.target_value, t.client_id || '', t.supplier_id || '', t.is_active ? 'Yes' : 'No']))}
          >Export CSV</Button>
          <Button icon={<Plus size={18} />} onClick={() => openModal()}>Add Translation</Button>
        </div>
      </div>

      {/* Quick Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: <Scissors size={20} />, title: 'Strip Digits', desc: 'Remove leading digits' },
          { icon: <PlusCircle size={20} />, title: 'Add Prefix', desc: 'Prepend prefix to number' },
          { icon: <Code2 size={20} />, title: 'OTP Extract', desc: 'Extract & forward OTP' },
          { icon: <Regex size={20} />, title: 'Regex Rules', desc: 'Sender, destination, content' },
        ].map((c, i) => (
          <div key={i} className="bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-2">{c.icon}</div>
            <p className="text-sm font-medium text-gray-800">{c.title}</p>
            <p className="text-xs text-gray-500">{c.desc}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search translations..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="all">All Types</option>
            {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card noPadding>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading translations...</div>
        ) : (
          <>
            <Table columns={columns} data={paginated} keyExtractor={t => t.id} />
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filtered.length} itemsPerPage={itemsPerPage} />
          </>
        )}
      </Card>

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Translation' : 'Add Translation'} size="lg"
        footer={
          <div className="flex justify-between gap-3 w-full">
            <Button variant="secondary" icon={<Play size={14} />} onClick={handleTestCurrent}>Test</Button>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleSave}>{editing ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        }>
        <div className="space-y-4">
          <Select label="Type *" value={form.translation_type}
            onChange={e => { setForm(p => ({ ...p, translation_type: e.target.value })); setSelectedType(e.target.value); }}
            options={Object.entries(typeLabels).map(([k, v]) => ({ value: k, label: v.label }))} required />

          <div className="grid grid-cols-2 gap-4">
            <Input label="Client ID (optional)" value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))} placeholder="Leave empty for global" />
            <Input label="Supplier ID (optional)" value={form.supplier_id} onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value }))} placeholder="Leave empty for global" />
          </div>

          {/* Dynamic pattern input based on type */}
          {(form.translation_type === 'destination_strip') && (() => {
            const stripCount = parseInt(form.source_pattern, 10) || 0;
            return (
            <div className="border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2"><Scissors size={14} className="text-orange-500" /><span className="text-sm font-medium">Number of digits to strip</span></div>
              <Input value={form.source_pattern} onChange={e => setForm(p => ({ ...p, source_pattern: e.target.value }))} placeholder="2" type="number" min={1} />
              <p className="text-xs text-gray-500 mt-1">e.g. "2" strips first 2 digits: 8801615069178 → 01615069178</p>
              {stripCount >= 10 && (
                <p className="text-xs text-amber-600 mt-1.5 font-medium">⚠ Strip count ({stripCount}) is very high — typical phone numbers are 10-15 digits. This rule will be skipped if the destination is shorter than the strip count.</p>
              )}
            </div>
            );
          })()}

          {(form.translation_type === 'destination_prefix') && (
            <div className="border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2"><PlusCircle size={14} className="text-green-500" /><span className="text-sm font-medium">Prefix to add</span></div>
              <Input value={form.source_pattern} onChange={e => setForm(p => ({ ...p, source_pattern: e.target.value }))} placeholder="11" />
              <p className="text-xs text-gray-500 mt-1">e.g. "11" prepends: 01615069178 → 1101615069178</p>
            </div>
          )}

          {(!['destination_strip', 'destination_prefix'].includes(form.translation_type)) && (
            <div className="border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2"><Regex size={14} className="text-purple-500" /><span className="text-sm font-medium">Match Pattern (Regex)</span></div>
              <Textarea value={form.source_pattern} onChange={e => setForm(p => ({ ...p, source_pattern: e.target.value }))}
                rows={2} placeholder={form.translation_type === 'content_otp_extract' ? '\\d{4,8}' : '^0(?=[1-9])'} className="font-mono text-sm" />
            </div>
          )}

          {(form.translation_type === 'content_otp_extract') && (
            <div className="border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2"><ArrowRight size={14} className="text-green-500" /><span className="text-sm font-medium">OTP Template (use {'{otp}'} as placeholder)</span></div>
              <Textarea value={form.target_value} onChange={e => setForm(p => ({ ...p, target_value: e.target.value }))}
                rows={2} placeholder="{otp}" className="font-mono text-sm" />
              <p className="text-xs text-gray-500 mt-1">{'{otp}'} will be replaced with the extracted OTP. Leave as {'{otp}'} to forward only the OTP.</p>
            </div>
          )}

          {(form.translation_type !== 'content_otp_extract' && !['destination_strip', 'destination_prefix'].includes(form.translation_type)) && (
            <div className="border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2"><ArrowRight size={14} className="text-green-500" /><span className="text-sm font-medium">Replace Pattern</span></div>
              <Textarea value={form.target_value} onChange={e => setForm(p => ({ ...p, target_value: e.target.value }))}
                rows={2} placeholder="+$1" className="font-mono text-sm" />
              <p className="text-xs text-gray-500 mt-1">Use $1, $2 for captured groups</p>
            </div>
          )}

          {/* Quick Templates */}
          {getQuickTemplates(form.translation_type).length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Quick Templates</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {getQuickTemplates(form.translation_type).map((qt, i) => (
                  <button key={i} type="button"
                    onClick={() => setForm(p => ({ ...p, source_pattern: qt.match, target_value: qt.replace }))}
                    className={`text-left p-2.5 rounded-lg border text-xs transition-all ${form.source_pattern === qt.match ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <p className="font-medium text-gray-700">{qt.label}</p>
                    <code className="text-[10px] text-gray-500 block mt-1">{qt.match} → {qt.replace || '(strip)'}</code>
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <span className="text-sm">Active</span>
          </label>
        </div>
      </Modal>

      {/* Test Result Modal */}
      <Modal isOpen={showTestModal} onClose={() => setShowTestModal(false)} title="Translation Test Result" size="lg">
        {testResult && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 border rounded-lg">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Input</p>
              <code className="text-sm text-gray-800 block">{testResult.input}</code>
            </div>
            <div className="flex justify-center"><ArrowRight size={24} className="text-blue-500" /></div>
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs font-medium text-green-600 uppercase mb-1">Output</p>
              <code className="text-sm text-green-800 font-semibold block">{testResult.output}</code>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Length: {testResult.input.length} → {testResult.output.length} chars</span>
              <span>{testResult.input === testResult.output ? '⚠ No change' : '✅ Translation applied'}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
