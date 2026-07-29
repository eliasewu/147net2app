import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Download, MoreVertical, Edit, Trash2, Eye, RefreshCw, Radio, Phone, Globe, Shield, X } from 'lucide-react';
import { exportCSV, exportExcel } from '../../services/exportService';
import { api } from '../../services/api';
import { useData } from '../../store/DataContext';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { Badge } from '../../components/UI/Badge';
import { Table, Pagination } from '../../components/UI/Table';
import { Modal } from '../../components/UI/Modal';
import { Client } from '../../types';
import { ToggleLeft, ToggleRight } from 'lucide-react';

// ─── Standalone IP management cell ────────────────────────────
const IPCell: React.FC<{ clientId: string; count: number; isOpen: boolean; onToggle: () => void; onIPChange: (delta: number) => void }> = ({ clientId, count, isOpen, onToggle, onIPChange }) => {
  const [ips, setIps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newIP, setNewIP] = useState('');
  const [newIPLabel, setNewIPLabel] = useState('');
  const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const toggleRef = useRef(onToggle);
  toggleRef.current = onToggle;

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.get(`/clients/${clientId}/ips`).then((r: any) => {
        if (r?.success && Array.isArray(r.data)) setIps(r.data);
      }).catch(() => { setError('Failed to load IPs'); }).finally(() => setLoading(false));
    }
  }, [isOpen, clientId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) toggleRef.current(); };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const addIP = async () => {
    if (!newIP) return;
    setError('');
    try {
      const r = await api.post(`/clients/${clientId}/ips`, { ip_address: newIP, label: newIPLabel });
      if (r.success && r.data) {
        setIps(prev => [...prev, r.data]);
        setNewIP(''); setNewIPLabel('');
        onIPChange(1);
      }
    } catch { setError('Failed to add IP'); }
  };

  const removeIP = async (ipId: string) => {
    setError('');
    try {
      await api.delete(`/clients/${clientId}/ips/${ipId}`);
      setIps(prev => prev.filter(ip => ip.id !== ipId));
      onIPChange(-1);
    } catch { setError('Failed to remove IP'); }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
          count > 0 ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
        }`}
      >
        <Shield size={12} />
        {count > 0 ? count : '0'}
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-20 p-3" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">IP Whitelist</span>
            <button onClick={onToggle} className="p-0.5 rounded hover:bg-gray-100"><X size={14} className="text-gray-400" /></button>
          </div>
          {error && <div className="text-xs text-red-500 mb-2">{error}</div>}
          {loading ? (
            <p className="text-xs text-gray-400 py-2 text-center">Loading...</p>
          ) : ips.length === 0 ? (
            <p className="text-xs text-gray-400 py-2 text-center">No IPs configured</p>
          ) : (
            <div className="space-y-1.5 mb-3 max-h-36 overflow-y-auto">
              {ips.map(ip => (
                <div key={ip.id} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <Shield size={10} className="text-green-500" />
                    <span className="text-xs font-mono">{ip.ip_address}</span>
                    {ip.label && <span className="text-[10px] text-gray-400">({ip.label})</span>}
                  </div>
                  <button onClick={() => removeIP(ip.id)} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            <input type="text" value={newIP} onChange={e => setNewIP(e.target.value)} placeholder="IP address" className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-300" />
            <input type="text" value={newIPLabel} onChange={e => setNewIPLabel(e.target.value)} placeholder="Label" className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-300" />
            <button onClick={addIP} disabled={!newIP} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50">Add</button>
          </div>
        </div>
      )}
    </div>
  );
};

export const ClientsList: React.FC = () => {
  const navigate = useNavigate();
  const { clients, deleteClient, updateClient, routePlans } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteModal, setDeleteModal] = useState<Client | null>(null);
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [ipMenu, setIpMenu] = useState<string | null>(null);
  const [ipCounts, setIpCounts] = useState<Record<string, number>>({});

  // Fetch IP counts on mount
  useEffect(() => {
    api.get('/clients/ips/counts').then((r: any) => {
      if (r?.success && r.data) setIpCounts(r.data);
    }).catch(() => {});
  }, []);

  const itemsPerPage = 10;

  const filteredClients = clients.filter(client => {
    const matchesSearch = 
      client.company_name.toLowerCase().includes(search.toLowerCase()) ||
      client.client_code.toLowerCase().includes(search.toLowerCase()) ||
      client.email.toLowerCase().includes(search.toLowerCase()) ||
      (client.phone || '').toLowerCase().includes(search.toLowerCase()) ||
      (client.country || '').toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || client.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getPlanName = (id: string | null) => {
    if (!id) return 'None';
    const plan = routePlans.find(p => p.id === id);
    return plan?.plan_name || 'Unknown';
  };

  const handleDelete = () => {
    if (deleteModal) {
      deleteClient(deleteModal.id);
      setDeleteModal(null);
    }
  };

  const columns = [
    {
      key: 'client_code',
      header: 'Client Code',
      render: (client: Client) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
            {client.company_name.charAt(0)}
          </div>
          <div>
            <p className="font-medium text-gray-800">{client.client_code}</p>
            <p className="text-xs text-gray-500">{client.company_name}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (client: Client) => (
        <div>
          <p className="text-sm text-gray-800">{client.contact_person}</p>
          <p className="text-xs text-gray-500">{client.email}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Phone size={10} className="text-gray-400" />
            <span className="text-xs text-gray-400">{client.phone || '—'}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Country',
      render: (client: Client) => (
        <div className="flex items-center gap-1.5">
          <Globe size={14} className="text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-700">{client.country || '—'}</span>
        </div>
      ),
    },
    {
      key: 'ip_count',
      header: 'Allowed IPs',
      render: (client: Client) => {
        const count = ipCounts[client.id] || 0;
        return <IPCell clientId={client.id} count={count} isOpen={ipMenu === client.id} onToggle={() => setIpMenu(ipMenu === client.id ? null : client.id)} onIPChange={(delta: number) => setIpCounts(prev => ({ ...prev, [client.id]: Math.max(0, (prev[client.id] || 0) + delta) }))} />;
      },
    },
    {
      key: 'smpp_username',
      header: 'SMPP Username',
      render: (client: Client) => (
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-gray-400" />
          <span className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded">{client.smpp_username}</span>
        </div>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right' as const,
      render: (client: Client) => (
        <div className="text-right">
          <p className="font-semibold text-gray-800">€{client.balance.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Limit: €{client.credit_limit.toLocaleString()}</p>
        </div>
      ),
    },
    {
      key: 'routing_plan',
      header: 'Route Plan',
      render: (client: Client) => (
        <Badge variant="info" size="sm">{getPlanName(client.routing_plan_id)}</Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (client: Client) => {
        const isActive = client.status === 'active';
        const isDeleted = client.status === 'deleted';
        const isSuspended = client.status === 'suspended';
        const canToggle = !isDeleted && !isSuspended;
        const toggleStatus = async (e: React.MouseEvent) => {
          e.stopPropagation();
          if (!canToggle) return;
          const newStatus = isActive ? 'inactive' : 'active';
          try {
            await updateClient(client.id, { status: newStatus });
          } catch (err: any) {
            alert('Failed to update status: ' + (err?.message || 'Unknown error'));
          }
        };
        return (
          <button
            onClick={toggleStatus}
            disabled={!canToggle}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
              !canToggle
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : isActive
                  ? 'bg-green-100 text-green-700 hover:bg-red-50 hover:text-red-600 cursor-pointer'
                  : 'bg-red-100 text-red-700 hover:bg-green-50 hover:text-green-600 cursor-pointer'
            }`}
            title={isDeleted ? 'Deleted clients cannot be toggled' : isSuspended ? 'Suspended clients cannot be toggled' : isActive ? 'Click to deactivate' : 'Click to activate'}
          >
            {!canToggle ? null : isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            {client.status}
          </button>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (client: Client) => (
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActionMenu(actionMenu === client.id ? null : client.id);
            }}
            className="p-1.5 rounded hover:bg-gray-100"
          >
            <MoreVertical size={16} className="text-gray-500" />
          </button>
          {actionMenu === client.id && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              <button
                onClick={() => navigate(`/clients/${client.id}`)}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Eye size={14} />
                View Details
              </button>
              <button
                onClick={() => navigate(`/clients/${client.id}/edit`)}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Edit size={14} />
                Edit
              </button>
              <hr className="my-1" />
              <button
                onClick={() => {
                  setDeleteModal(client);
                  setActionMenu(null);
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} />
                Delete
              </button>
              {client.status === 'deleted' && (
                <>
                  <hr className="my-1" />
                  <button
                    onClick={async () => {
                      setActionMenu(null);
                      try {
                        await api.post(`/clients/${client.id}/restore`);
                      } catch (e: any) {
                        alert('Restore failed: ' + (e.message || 'Unknown error'));
                        return;
                      }
                      window.location.reload();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-green-50"
                  >
                    <RefreshCw size={14} />
                    Restore
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Clients</h1>
          <p className="text-gray-500 mt-1">Manage your client accounts and SMPP connections</p>
        </div>
        <Link to="/clients/add">
          <Button icon={<Plus size={18} />}>Add Client</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total Clients</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{clients.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {clients.filter(c => c.status === 'active').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Suspended</p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            {clients.filter(c => c.status === 'suspended').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total Balance</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            €{clients.reduce((sum, c) => sum + c.balance, 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="deleted">Deleted</option>
            </select>
            <Button variant="secondary" icon={<Filter size={16} />}>Filters</Button>
            <Button variant="secondary" icon={<Download size={16} />} onClick={() => exportCSV('clients_export.csv', ['Client Code','Company','Contact','Email','Phone','Country','IP Count','SMPP Username','Balance','Credit Limit','Status','Route Plan'], filteredClients.map(c => [c.client_code, c.company_name, c.contact_person, c.email, c.phone || '', c.country || '', String(ipCounts[c.id] || 0), c.smpp_username, String(c.balance), String(c.credit_limit), c.status, getPlanName(c.routing_plan_id)]))}>Export CSV</Button>
            <Button variant="secondary" icon={<Download size={16} />} onClick={() => exportExcel('clients_export.xlsx', 'Clients', ['Client Code','Company','Contact','Email','Phone','Country','IP Count','SMPP Username','Balance','Credit Limit','Status','Route Plan'], filteredClients.map(c => [c.client_code, c.company_name, c.contact_person, c.email, c.phone || '', c.country || '', String(ipCounts[c.id] || 0), c.smpp_username, String(c.balance), String(c.credit_limit), c.status, getPlanName(c.routing_plan_id)]))}>Export Excel</Button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card noPadding>
        <Table
          columns={columns}
          data={paginatedClients}
          keyExtractor={(client) => client.id}
          onRowClick={(client) => navigate(`/clients/${client.id}`)}
        />
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredClients.length}
          itemsPerPage={itemsPerPage}
        />
      </Card>

      {/* Delete Modal */}
      <Modal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Delete Client"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteModal(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete Client</Button>
          </div>
        }
      >
        <p className="text-gray-600">
          Are you sure you want to delete <strong>{deleteModal?.company_name}</strong>?
          This will <strong>soft-delete</strong> the client — SMS logs, payments, and invoices will remain active.
        </p>
      </Modal>
    </div>
  );
};
