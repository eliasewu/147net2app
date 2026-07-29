import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Download, MoreVertical, Edit, Trash2, Eye, RefreshCw, Wifi, WifiOff, AlertTriangle, ArrowRight, ToggleLeft, ToggleRight } from 'lucide-react';
import { exportCSV, exportExcel } from '../../services/exportService';
import { api } from '../../services/api';
import { useData } from '../../store/DataContext';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { Badge } from '../../components/UI/Badge';
import { Table, Pagination } from '../../components/UI/Table';
import { Modal } from '../../components/UI/Modal';
import { Supplier } from '../../types';

export const SuppliersList: React.FC = () => {
  const navigate = useNavigate();
  const { suppliers, deleteSupplier, updateSupplier } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteModal, setDeleteModal] = useState<Supplier | null>(null);
  const [actionMenu, setActionMenu] = useState<string | null>(null);

  const itemsPerPage = 10;

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = 
      supplier.company_name.toLowerCase().includes(search.toLowerCase()) ||
      supplier.supplier_code.toLowerCase().includes(search.toLowerCase()) ||
      supplier.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || supplier.status === statusFilter;
    const matchesType = typeFilter === 'all' || supplier.connection_type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);
  const paginatedSuppliers = filteredSuppliers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleDelete = () => {
    if (deleteModal) {
      deleteSupplier(deleteModal.id);
      setDeleteModal(null);
    }
  };

  const getConnectionTypeBadge = (type: string) => {
    const typeMap: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' }> = {
      smpp: { label: 'SMPP', variant: 'info' },
      http: { label: 'HTTP API', variant: 'purple' },
      ott_whatsapp: { label: 'WhatsApp', variant: 'success' },
      ott_telegram: { label: 'Telegram', variant: 'info' },
      voice_otp: { label: 'Voice OTP', variant: 'warning' },
      local_bypass: { label: 'Local Bypass', variant: 'default' },
      rcs: { label: 'RCS', variant: 'purple' },
      email: { label: 'Email', variant: 'info' },
    };
    const config = typeMap[type] || { label: type.toUpperCase(), variant: 'default' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const columns = [
    {
      key: 'supplier_code',
      header: 'Supplier',
      render: (supplier: Supplier) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
            {supplier.company_name.charAt(0)}
          </div>
          <div>
            <p className="font-medium text-gray-800">{supplier.supplier_code}</p>
            <p className="text-xs text-gray-500">{supplier.company_name}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (supplier: Supplier) => (
        <div>
          <p className="text-sm text-gray-800">{supplier.contact_person}</p>
          <p className="text-xs text-gray-500">{supplier.email}</p>
        </div>
      ),
    },
    {
      key: 'connection_type',
      header: 'Type',
      render: (supplier: Supplier) => (
        <div className="flex flex-col gap-1 items-center">
          {getConnectionTypeBadge(supplier.connection_type)}
          {supplier.is_inbound && <Badge variant="warning" size="sm">INBOUND</Badge>}
        </div>
      ),
    },
    {
      key: 'smpp_version',
      header: 'SMPP Ver',
      align: 'center' as const,
      render: (supplier: Supplier) => {
        if (supplier.connection_type !== 'smpp') return <span className="text-xs text-gray-300">—</span>;
        const v = supplier.smpp_version;
        if (!v || v === 'auto') {
          return <Badge variant="success" size="sm">Auto</Badge>;
        }
        return <Badge variant="info" size="sm">v{v}</Badge>;
      },
    },
    {
      key: 'bind_status',
      header: 'Bind Status',
      render: (supplier: Supplier) => (
        <div className="flex items-center gap-2">
          {supplier.bind_status === 'bound' ? (
            <Wifi size={16} className="text-green-500" />
          ) : (
            <WifiOff size={16} className="text-red-500" />
          )}
          <Badge
            variant={supplier.bind_status === 'bound' ? 'success' : supplier.bind_status === 'error' ? 'danger' : 'warning'}
          >
            {supplier.bind_status}
          </Badge>
        </div>
      ),
    },
    {
      key: 'failures',
      header: 'Failures',
      align: 'center' as const,
      render: (supplier: Supplier) => (
        <span className={`font-medium ${supplier.consecutive_failures > 10 ? 'text-red-600' : supplier.consecutive_failures > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
          {supplier.consecutive_failures}
          {supplier.consecutive_failures >= 20 && (
            <span className="ml-1 text-xs text-red-500">(BLOCKED)</span>
          )}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right' as const,
      render: (supplier: Supplier) => (
        <div className="text-right">
          <p className="font-semibold text-gray-800">€{supplier.balance.toLocaleString()}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (supplier: Supplier) => {
        const isActive = supplier.status === 'active';
        const isDeleted = supplier.status === 'deleted';
        const isSuspended = supplier.status === 'suspended';
        const canToggle = !isDeleted && !isSuspended;
        const toggleStatus = async (e: React.MouseEvent) => {
          e.stopPropagation();
          if (!canToggle) return;
          const newStatus = isActive ? 'inactive' : 'active';
          try {
            await updateSupplier(supplier.id, { status: newStatus });
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
            title={isDeleted ? 'Deleted suppliers cannot be toggled' : isSuspended ? 'Suspended suppliers cannot be toggled' : isActive ? 'Click to deactivate' : 'Click to activate'}
          >
            {!canToggle ? null : isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            {supplier.status}
          </button>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (supplier: Supplier) => (
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActionMenu(actionMenu === supplier.id ? null : supplier.id);
            }}
            className="p-1.5 rounded hover:bg-gray-100"
          >
            <MoreVertical size={16} className="text-gray-500" />
          </button>
          {actionMenu === supplier.id && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              <button
                onClick={() => navigate(`/suppliers/${supplier.id}`)}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Eye size={14} />
                View Details
              </button>
              <button
                onClick={() => navigate(`/suppliers/${supplier.id}/edit`)}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Edit size={14} />
                Edit
              </button>
              <hr className="my-1" />
              <button
                onClick={() => {
                  setDeleteModal(supplier);
                  setActionMenu(null);
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} />
                Delete
              </button>
              {supplier.status === 'deleted' && (
                <>
                  <hr className="my-1" />
                  <button onClick={async () => {
  setActionMenu(null);
  try {
    await api.post(`/suppliers/${supplier.id}/restore`);
    window.location.reload();
  } catch (e: any) {
    alert(e?.message || 'Failed to restore supplier');
  }
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
          <h1 className="text-2xl font-bold text-gray-800">Suppliers</h1>
          <p className="text-gray-500 mt-1">Manage vendor connections and gateways</p>
        </div>
        <Link to="/suppliers/add">
          <Button icon={<Plus size={18} />}>Add Supplier</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total Suppliers</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{suppliers.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {suppliers.filter(s => s.status === 'active').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Bound</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {suppliers.filter(s => s.bind_status === 'bound').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">SMPP</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">
            {suppliers.filter(s => s.connection_type === 'smpp').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">OTT</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">
            {suppliers.filter(s => ['ott_whatsapp', 'ott_telegram'].includes(s.connection_type)).length}
          </p>
        </div>
      </div>

      {/* Unbound / Broken warning banner */}
      {(() => {
        const unbound = suppliers.filter(s => s.bind_status !== 'bound' && s.status === 'active');
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
              <Button variant="secondary" size="sm" onClick={() => navigate('/bind-status')} icon={<ArrowRight size={14} />}>View Bind Status</Button>
            </div>
          </div>
        );
      })()}

      {/* Empty state — no suppliers at all */}
      {suppliers.length === 0 && (
        <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border-2 border-dashed border-blue-200 p-12 text-center">
          <WifiOff size={48} className="mx-auto mb-4 text-blue-400" />
          <h3 className="text-xl font-bold text-gray-800 mb-2">No Suppliers Configured</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">Get started by adding your first supplier. Choose from SMPP, HTTP API, RCS, Flash SMS, WhatsApp, Telegram, Voice OTP, or Email.</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button onClick={() => navigate('/suppliers/add')} icon={<Plus size={18} />}>Add Supplier</Button>
            <Button variant="secondary" onClick={() => navigate('/suppliers/api-connectors')}>API Connectors</Button>
            <Button variant="secondary" onClick={() => navigate('/suppliers/social-api')}>Social API</Button>
            <Button variant="secondary" onClick={() => navigate('/suppliers/voice-otp')}>Voice OTP</Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search suppliers..."
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
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="smpp">SMPP</option>
              <option value="http">HTTP API</option>
              <option value="email">Email</option>
              <option value="ott_whatsapp">WhatsApp</option>
              <option value="ott_telegram">Telegram</option>
              <option value="voice_otp">Voice OTP</option>
            </select>
            <Button variant="secondary" icon={<Download size={16} />} onClick={() => exportCSV('suppliers_export.csv', ['Supplier Code','Company','Contact','Email','Type','SMPP Version','Bind Status','Failures','Balance','Status'], filteredSuppliers.map(s => [s.supplier_code, s.company_name, s.contact_person, s.email, s.connection_type, s.smpp_version||'auto', s.bind_status, String(s.consecutive_failures), String(s.balance), s.status]))}>Export CSV</Button>
            <Button variant="secondary" icon={<Download size={16} />} onClick={() => exportExcel('suppliers_export.xlsx', 'Suppliers', ['Supplier Code','Company','Contact','Email','Type','SMPP Version','Bind Status','Failures','Balance','Status'], filteredSuppliers.map(s => [s.supplier_code, s.company_name, s.contact_person, s.email, s.connection_type, s.smpp_version||'auto', s.bind_status, String(s.consecutive_failures), String(s.balance), s.status]))}>Export Excel</Button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card noPadding>
        <Table
          columns={columns}
          data={paginatedSuppliers}
          keyExtractor={(supplier) => supplier.id}
          onRowClick={(supplier) => navigate(`/suppliers/${supplier.id}`)}
        />
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredSuppliers.length}
          itemsPerPage={itemsPerPage}
        />
      </Card>

      {/* Delete Modal */}
      <Modal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Delete Supplier"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteModal(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete Supplier</Button>
          </div>
        }
      >
        <p className="text-gray-600">
          Are you sure you want to delete <strong>{deleteModal?.company_name}</strong>?
          This will <strong>soft-delete</strong> the supplier and auto-unbind if connected. SMS logs, payments, and invoices will remain active.
        </p>
      </Modal>
    </div>
  );
};
