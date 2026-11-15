import React, { useEffect, useState } from 'react';
import { Edit2, Plus, QrCode, ScanBarcode, Search, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { Asset, AssetCategory, Department, User } from '../types';
import { AssetScannerModal } from './AssetScannerModal';
import { StatusTag } from './StatusBadge';

const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Needs Maintenance', 'Damaged', 'Retired'] as const;
const STATUSES = ['Operational', 'In Repair', 'Under Maintenance', 'Decommissioned'] as const;

export function AssetsView({ globalSearch }: { globalSearch: string }) {
  const { user } = useAuth();
  const canEdit = user?.role_name === 'Administrator' || user?.role_name === 'ICT Technician';
  const isAdmin = user?.role_name === 'Administrator';

  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerTargetAsset, setScannerTargetAsset] = useState<Asset | null>(null);

  const [assetTag, setAssetTag] = useState('');
  const [assetIdentificationNumber, setAssetIdentificationNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('2026-01-15');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [location, setLocation] = useState('');
  const [condition, setCondition] = useState<Asset['condition']>('Good');
  const [status, setStatus] = useState<Asset['status']>('Operational');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadAssets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const activeSearch = search || globalSearch;
      if (activeSearch) params.set('search', activeSearch);
      if (categoryFilter) params.set('categoryId', categoryFilter);
      if (conditionFilter) params.set('condition', conditionFilter);

      const res = await apiRequest<{ assets: Asset[] }>(`/api/assets?${params.toString()}`);
      setAssets(res.assets);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [search, globalSearch, categoryFilter, conditionFilter]);

  useEffect(() => {
    apiRequest<{ categories: AssetCategory[] }>('/api/assets/categories').then((r) => setCategories(r.categories)).catch(() => {});
    apiRequest<{ departments: Department[] }>('/api/users/departments').then((r) => setDepartments(r.departments)).catch(() => {});
    if (canEdit) {
      apiRequest<{ users: User[] }>('/api/users').then((r) => setUsers(r.users)).catch(() => {});
    }
  }, [canEdit]);

  const openCreate = () => {
    setEditingAsset(null);
    setAssetTag('');
    setAssetIdentificationNumber('');
    setSerialNumber('');
    setName('');
    setCategoryId(categories[0] ? String(categories[0].id) : '');
    setManufacturer('');
    setModel('');
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setWarrantyExpiry('');
    setDepartmentId('');
    setLocation('');
    setCondition('Good');
    setStatus('Operational');
    setAssignedUserId('');
    setNotes('');
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setAssetTag(asset.asset_tag);
    setAssetIdentificationNumber(asset.asset_identification_number || asset.asset_tag);
    setSerialNumber(asset.serial_number);
    setName(asset.name);
    setCategoryId(String(asset.category_id));
    setManufacturer(asset.manufacturer);
    setModel(asset.model || '');
    setPurchaseDate(asset.purchase_date);
    setWarrantyExpiry(asset.warranty_expiry || '');
    setDepartmentId(asset.department_id ? String(asset.department_id) : '');
    setLocation(asset.location);
    setCondition(asset.condition);
    setStatus(asset.status);
    setAssignedUserId(asset.assigned_user_id ? String(asset.assigned_user_id) : '');
    setNotes(asset.notes || '');
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const payload = {
        assetTag,
        assetIdentificationNumber: assetIdentificationNumber || assetTag,
        serialNumber,
        name,
        categoryId: Number(categoryId),
        manufacturer,
        model: model || undefined,
        purchaseDate,
        warrantyExpiry: warrantyExpiry || undefined,
        departmentId: departmentId ? Number(departmentId) : null,
        location,
        condition,
        status,
        assignedUserId: assignedUserId ? Number(assignedUserId) : null,
        notes: notes || undefined,
      };

      if (editingAsset) {
        await apiRequest(`/api/assets/${editingAsset.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/assets', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await loadAssets();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save asset');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (asset: Asset) => {
    try {
      await apiRequest(`/api/assets/${asset.id}`, { method: 'DELETE' });
      await loadAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete asset');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">ICT Asset Management</h1>
          <p className="mt-1 text-sm text-slate-600">
            Track equipment tags, barcode/QR identifiers, serial numbers, custodians, and hardware conditions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setScannerTargetAsset(null);
              setScannerOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ScanBarcode className="h-4 w-4 text-blue-600" />
            <span>Scan Barcode / QR</span>
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>Register Asset</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tag, ID#, serial, name, custodian, location..."
            className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-1.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by equipment category"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            aria-label="Filter by condition"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
          >
            <option value="">All Conditions</option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Assets Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Asset ID / Serial</th>
                <th className="py-3 px-4">Equipment</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Department &amp; Location</th>
                <th className="py-3 px-4">Assigned Custodian</th>
                <th className="py-3 px-4">Condition</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">Loading ICT assets...</td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">No ICT assets found.</td>
                </tr>
              ) : (
                assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono text-xs font-semibold text-blue-700">
                        {asset.asset_identification_number || asset.asset_tag}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">{asset.serial_number}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{asset.name}</div>
                      <div className="text-xs text-slate-500">
                        {asset.manufacturer} {asset.model || ''} · Purchased {asset.purchase_date}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">{asset.category_name}</td>
                    <td className="py-3 px-4">
                      <div className="text-xs font-medium text-slate-800">{asset.department_name || 'Central ICT'}</div>
                      <div className="text-xs text-slate-500">{asset.location}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">
                      {asset.assigned_user_name ? (
                        <div>
                          <div className="font-medium text-slate-900">{asset.assigned_user_name}</div>
                          <div className="text-[11px] text-slate-500">
                            {asset.assigned_user_staff_id || asset.assigned_user_role || ''}
                            {asset.assigned_user_phone ? ` · ${asset.assigned_user_phone}` : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4"><StatusTag value={asset.condition} /></td>
                    <td className="py-3 px-4"><StatusTag value={asset.status} /></td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setScannerTargetAsset(asset);
                            setScannerOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-blue-600 rounded-md hover:bg-blue-50 cursor-pointer"
                          title="QR Tag & Full Custodian Details"
                        >
                          <QrCode className="h-4 w-4" />
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openEdit(asset)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 rounded-md hover:bg-blue-50 cursor-pointer"
                            title="Edit asset"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDelete(asset)}
                            className="p-1.5 text-slate-500 hover:text-red-600 rounded-md hover:bg-red-50 cursor-pointer"
                            title="Delete asset"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Asset Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editingAsset ? `Edit Asset: ${editingAsset.asset_tag}` : 'Register New ICT Equipment'}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">{formError}</div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Asset Tag</label>
                  <input
                    type="text"
                    required
                    value={assetTag}
                    onChange={(e) => {
                      setAssetTag(e.target.value);
                      if (!editingAsset) setAssetIdentificationNumber(e.target.value);
                    }}
                    placeholder="ICT-LPT-2015"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Asset Identification Number</label>
                  <input
                    type="text"
                    value={assetIdentificationNumber}
                    onChange={(e) => setAssetIdentificationNumber(e.target.value)}
                    placeholder="Barcode / QR value"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Serial Number</label>
                  <input
                    type="text"
                    required
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="SN-HP-994021"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Equipment Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="HP ProBook 450 G10"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                  <select
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Manufacturer</label>
                  <input
                    type="text"
                    required
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    placeholder="Dell, HP, Cisco, Lenovo..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Model</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="OptiPlex 7010 / Catalyst 9200"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Purchase Date</label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Warranty Expiry (Optional)</label>
                  <input
                    type="date"
                    value={warrantyExpiry}
                    onChange={(e) => setWarrantyExpiry(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Central ICT Pool</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Physical Location</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Science Wing, Lab 2"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Condition</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as Asset['condition'])}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Operational Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Asset['status'])}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Assigned User</label>
                  <select
                    value={assignedUserId}
                    onChange={(e) => setAssignedUserId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name} ({u.role_name})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Technical Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Saving...' : editingAsset ? 'Update Asset' : 'Register Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {scannerOpen && (
        <AssetScannerModal
          initialAsset={scannerTargetAsset}
          users={users}
          departments={departments}
          canEdit={canEdit}
          onClose={() => {
            setScannerOpen(false);
            setScannerTargetAsset(null);
          }}
          onAssetUpdated={() => void loadAssets()}
        />
      )}
    </div>
  );
}
