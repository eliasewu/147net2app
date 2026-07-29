import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, ShieldBan, AlertTriangle } from 'lucide-react';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { Badge } from '../../components/UI/Badge';
import { Table, Pagination } from '../../components/UI/Table';
import { Modal } from '../../components/UI/Modal';
import { Input } from '../../components/UI/Input';
import { blacklistService } from '../../services/apiServices';
import { NumberBlacklist } from '../../types';

interface FormData {
  prefix: string;
  client_id: string;
  supplier_id: string;
  is_active: boolean;
  notes: string;
}

const emptyForm: FormData = {
  prefix: '',
  client_id: '',
  supplier_id: '',
  is_active: true,
  notes: '',
};

export const NumberBlacklistPage: React.FC = () => {
  const [items, setItems] = useState<NumberBlacklist[]>([]);
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<NumberBlacklist | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm);

  const loadItems = async () => {
    try {
      setLoading(true);
      const res = await blacklistService.getBlacklists({});
      if (res.success) setItems(res.data || []);
    } catch (e) { console.error('Failed to load blacklists:', e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadItems(); }, []);

  const itemsPerPage = 15;
  const filtered = items.filter(item => {
    const ms = (item.prefix || '').toLowerCase().includes(search.toLowerCase()) ||
               (item.notes || '').toLowerCase().includes(search.toLowerCase());
    let scopeMatch = true;
    if (scopeFilter === 'global') scopeMatch = !item.client_id && !item.supplier_id;
    else if (scopeFilter === 'client') scopeMatch = !!item.client_id;
    else if (scopeFilter === 'supplier') scopeMatch = !!item.supplier_id;
    return ms && scopeMatch;
  });
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const openModal = (item?: NumberBlacklist) => {
    if (item) {
      setEditing(item);
      setForm({
        prefix: item.prefix,
        client_id: item.client_id || '',
        supplier_id: item.supplier_id || '',
        is_active: item.is_active,
        notes: item.notes || '',
      });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await blacklistService.updateBlacklist(editing.id, {
          prefix: form.prefix,
          client_id: form.client_id || undefined,
          supplier_id: form.supplier_id || undefined,
          is_active: form.is_active,
          notes: form.notes,
        });
      } else {
        await blacklistService.createBlacklist({
          prefix: form.prefix,
          client_id: form.client_id || undefined,
          supplier_id: form.supplier_id || undefined,
          notes: form.notes,
        });
      }
      setShowModal(false);
      loadItems();
    } catch (e: any) {
      alert('Failed to save: ' + (e?.message || 'Unknown error'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this blacklist entry?')) return;
    try {
      await blacklistService.deleteBlacklist(id);
      loadItems();
    } catch (e) {
      alert('Failed to delete blacklist entry');
    }
  };

  const columns = [
    {
      key: 'prefix', header: 'Prefix',
      render: (item: NumberBlacklist) => (
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-red-50">
            <ShieldBan size={16} className="text-red-500" />
          </div>
          <code className="text-sm font-mono font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded">
            {item.prefix}
          </code>
        </div>
      )
    },
    {
      key: 'scope', header: 'Scope',
      render: (item: NumberBlacklist) => {
        if (item.client_id) return <Badge variant="info">Client #{item.client_id}</Badge>;
        if (item.supplier_id) return <Badge variant="purple">Supplier #{item.supplier_id}</Badge>;
        return <Badge variant="danger">Global</Badge>;
      }
    },
    {
      key: 'notes', header: 'Notes',
      render: (item: NumberBlacklist) => (
        <span className="text-xs text-gray-500 max-w-[200px] truncate block">
          {item.notes || '-'}
        </span>
      )
    },
    {
      key: 'active', header: 'Status',
      render: (item: NumberBlacklist) => (
        <Badge variant={item.is_active ? 'success' : 'default'} dot>
          {item.is_active ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      key: 'actions', header: '',
      render: (item: NumberBlacklist) => (
        <div className="flex gap-1">
          <button onClick={() => openModal(item)} className="p-1.5 rounded hover:bg-gray-100">
            <Edit size={14} className="text-gray-500" />
          </button>
          <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-gray-100">
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
          <h1 className="text-2xl font-bold text-gray-800">Number Blacklist</h1>
          <p className="text-gray-500 mt-1">Block sending to specific number prefixes — scoped globally, per client, or per supplier</p>
        </div>
        <Button icon={<Plus size={18} />} onClick={() => openModal()}>Add Prefix</Button>
      </div>

      {/* Warning card */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle size={20} className="text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">How blacklisting works</p>
          <p className="text-xs text-amber-700 mt-1">
            Messages sent to numbers starting with any blacklisted prefix are rejected <strong>before routing</strong>.
            Blocked messages appear in SMS Logs with status <code className="bg-amber-100 px-1 rounded">blocked</code>,
            are <strong>not billed</strong> to the client, and return an error to the sender. Add both international (880) and
            local (0) format prefixes for complete coverage.
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search prefixes..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <select value={scopeFilter} onChange={e => setScopeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="all">All Scopes</option>
            <option value="global">Global</option>
            <option value="client">Per Client</option>
            <option value="supplier">Per Supplier</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card noPadding>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <>
            <Table columns={columns} data={paginated} keyExtractor={item => item.id} />
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage}
              totalItems={filtered.length} itemsPerPage={itemsPerPage} />
          </>
        )}
      </Card>

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editing ? 'Edit Blacklist Entry' : 'Add Blacklist Prefix'} size="md"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        }>
        <div className="space-y-4">
          <Input label="Number Prefix *" value={form.prefix}
            onChange={e => setForm(p => ({ ...p, prefix: e.target.value }))}
            placeholder="e.g. 88013225" required />
          <p className="text-xs text-gray-500 -mt-2">
            Numbers starting with this prefix will be blocked. Add both international (e.g. 88013225) and
            local (e.g. 013225) formats for full coverage.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Client ID (optional)" value={form.client_id}
              onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}
              placeholder="Leave empty for global" />
            <Input label="Supplier ID (optional)" value={form.supplier_id}
              onChange={e => setForm(p => ({ ...p, supplier_id: e.target.value }))}
              placeholder="Leave empty for global" />
          </div>
          <Input label="Notes (optional)" value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="e.g. Spam number series" />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_active}
              onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-red-600" />
            <span className="text-sm">Active</span>
          </label>
        </div>
      </Modal>
    </div>
  );
};
