import React, { useEffect, useState } from 'react';
import { BellRing, Plus, Wrench, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { Asset, MaintenanceRecord, Technician } from '../types';
import { StatusTag } from './StatusBadge';

const TYPES = ['Preventive', 'Corrective Repair', 'Hardware Upgrade', 'Inspection'] as const;
const STATUSES = ['Scheduled', 'In Progress', 'Completed', 'Cancelled'] as const;

export function MaintenanceView({ globalSearch }: { globalSearch: string }) {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);

  // Create form
  const [assetId, setAssetId] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [maintenanceType, setMaintenanceType] = useState<MaintenanceRecord['maintenance_type']>('Preventive');
  const [issueSummary, setIssueSummary] = useState('');
  const [partsReplaced, setPartsReplaced] = useState('');
  const [cost, setCost] = useState('0');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [nextMaintenanceDate, setNextMaintenanceDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Update form
  const [updStatus, setUpdStatus] = useState<MaintenanceRecord['status']>('In Progress');
  const [updWork, setUpdWork] = useState('');
  const [updParts, setUpdParts] = useState('');
  const [updCost, setUpdCost] = useState('0');
  const [updAssetCondition, setUpdAssetCondition] = useState<Asset['condition']>('Good');

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await apiRequest<{ records: MaintenanceRecord[] }>(`/api/maintenance?${params.toString()}`);
      setRecords(res.records);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load maintenance records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  useEffect(() => {
    apiRequest<{ assets: Asset[] }>('/api/assets').then((r) => setAssets(r.assets)).catch(() => {});
    apiRequest<{ technicians: Technician[] }>('/api/users/technicians').then((r) => setTechnicians(r.technicians)).catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/api/maintenance', {
        method: 'POST',
        body: JSON.stringify({
          assetId: Number(assetId),
          technicianId: technicianId ? Number(technicianId) : null,
          maintenanceType,
          issueSummary,
          partsReplaced: partsReplaced || undefined,
          cost: Number(cost) || 0,
          scheduledDate,
          nextMaintenanceDate: nextMaintenanceDate || undefined,
          status: 'Scheduled',
        }),
      });
      setShowCreate(false);
      setIssueSummary('');
      setPartsReplaced('');
      setCost('0');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule maintenance');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (rec: MaintenanceRecord) => {
    setEditingRecord(rec);
    setUpdStatus(rec.status);
    setUpdWork(rec.work_performed || '');
    setUpdParts(rec.parts_replaced || '');
    setUpdCost(String(rec.cost || 0));
    setUpdAssetCondition('Good');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setSaving(true);
    try {
      await apiRequest(`/api/maintenance/${editingRecord.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: updStatus,
          workPerformed: updWork,
          partsReplaced: updParts,
          cost: Number(updCost) || 0,
          assetConditionAfter: updStatus === 'Completed' ? updAssetCondition : undefined,
        }),
      });
      setEditingRecord(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update maintenance record');
    } finally {
      setSaving(false);
    }
  };

  const triggerReminders = async () => {
    setNotice('');
    try {
      const res = await apiRequest<{ remindersTriggered: number }>('/api/notifications/dispatch-maintenance-reminders', {
        method: 'POST',
      });
      setNotice(`Dispatched Email & SMS reminders for ${res.remindersTriggered} upcoming maintenance tasks.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dispatch maintenance reminders');
    }
  };

  const filteredRecords = records.filter((r) => {
    if (!globalSearch) return true;
    const q = globalSearch.toLowerCase();
    return (
      r.asset_tag.toLowerCase().includes(q) ||
      r.asset_name.toLowerCase().includes(q) ||
      r.issue_summary.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Maintenance &amp; Repair Logs</h1>
          <p className="mt-1 text-sm text-slate-600">
            Schedule preventive servicing, track equipment repairs, and dispatch Email/SMS maintenance alerts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={triggerReminders}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            <BellRing className="h-4 w-4 text-blue-600" />
            <span>Send Upcoming Reminders</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!assetId && assets[0]) setAssetId(String(assets[0].id));
              setShowCreate(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Schedule Maintenance</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center gap-1">
        {['', ...STATUSES].map((st) => (
          <button
            key={st || 'All'}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              statusFilter === st ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {st || 'All Maintenance'}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Asset</th>
                <th className="py-3 px-4">Type &amp; Issue Summary</th>
                <th className="py-3 px-4">Technician</th>
                <th className="py-3 px-4">Scheduled</th>
                <th className="py-3 px-4 text-right">Cost ($)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr><td colSpan={7} className="py-10 text-center text-slate-500">Loading maintenance records...</td></tr>
              ) : filteredRecords.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-500">No maintenance records found.</td></tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs font-semibold text-blue-700">{rec.asset_tag}</div>
                      <div className="text-xs font-medium text-slate-900">{rec.asset_name}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs font-semibold text-slate-800">{rec.maintenance_type}</div>
                      <div className="text-xs text-slate-600 line-clamp-1">{rec.issue_summary}</div>
                      {rec.parts_replaced && (
                        <div className="text-[11px] text-slate-500">Parts: {rec.parts_replaced}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">{rec.technician_name || 'Unassigned'}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {rec.scheduled_date}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-slate-900 tabular-nums">
                      ${Number(rec.cost || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4"><StatusTag value={rec.status} /></td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(rec)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        <Wrench className="h-3.5 w-3.5" />
                        <span>Update</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Maintenance Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">Schedule Equipment Maintenance</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Equipment Asset</label>
                <select
                  required
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select asset...</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.asset_tag} — {a.name} ({a.condition})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Maintenance Type</label>
                  <select
                    value={maintenanceType}
                    onChange={(e) => setMaintenanceType(e.target.value as MaintenanceRecord['maintenance_type'])}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Assign Technician</label>
                  <select
                    value={technicianId}
                    onChange={(e) => setTechnicianId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>{t.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Issue / Service Scope</label>
                <textarea
                  required
                  rows={3}
                  value={issueSummary}
                  onChange={(e) => setIssueSummary(e.target.value)}
                  placeholder="Describe repair work or preventive checklist..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Scheduled Date</label>
                  <input
                    type="date"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Next Cycle Date</label>
                  <input
                    type="date"
                    value={nextMaintenanceDate}
                    onChange={(e) => setNextMaintenanceDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Est. Cost ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Parts Required / Replaced</label>
                <input
                  type="text"
                  value={partsReplaced}
                  onChange={(e) => setPartsReplaced(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer">
                  {saving ? 'Scheduling...' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Maintenance Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Update Repair: {editingRecord.asset_tag}
              </h2>
              <button type="button" onClick={() => setEditingRecord(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Repair Status</label>
                  <select
                    value={updStatus}
                    onChange={(e) => setUpdStatus(e.target.value as MaintenanceRecord['status'])}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Total Cost ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={updCost}
                    onChange={(e) => setUpdCost(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              {updStatus === 'Completed' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Post-Repair Asset Condition</label>
                  <select
                    value={updAssetCondition}
                    onChange={(e) => setUpdAssetCondition(e.target.value as Asset['condition'])}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Damaged">Damaged</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Work Performed</label>
                <textarea
                  rows={3}
                  value={updWork}
                  onChange={(e) => setUpdWork(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Parts Replaced</label>
                <input
                  type="text"
                  value={updParts}
                  onChange={(e) => setUpdParts(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button type="button" onClick={() => setEditingRecord(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer">
                  {saving ? 'Updating...' : 'Save Maintenance Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
