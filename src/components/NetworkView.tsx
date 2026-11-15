import React, { useEffect, useState } from 'react';
import { Activity, Edit2, Plus, Search, Wrench, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { Department, NetworkDevice, TroubleshootingEntry } from '../types';
import { StatusTag } from './StatusBadge';

const DEVICE_TYPES = ['Core Router', 'Distribution Switch', 'Access Switch', 'Wireless AP', 'Firewall', 'Gateway', 'Server NIC'] as const;
const NET_STATUSES = ['Online', 'Degraded', 'Offline', 'Maintenance'] as const;

export function NetworkView({ globalSearch }: { globalSearch: string }) {
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Device form modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<NetworkDevice | null>(null);
  const [hostname, setHostname] = useState('');
  const [deviceType, setDeviceType] = useState<NetworkDevice['device_type']>('Access Switch');
  const [ipAddress, setIpAddress] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [subnetMask, setSubnetMask] = useState('255.255.255.0');
  const [vlan, setVlan] = useState('');
  const [location, setLocation] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [status, setStatus] = useState<NetworkDevice['status']>('Online');
  const [issueNotes, setIssueNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Troubleshooting drawer
  const [selectedDevice, setSelectedDevice] = useState<NetworkDevice | null>(null);
  const [tsAction, setTsAction] = useState('');
  const [tsOutcome, setTsOutcome] = useState('');
  const [tsNewStatus, setTsNewStatus] = useState<NetworkDevice['status']>('Online');

  const loadDevices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const q = search || globalSearch;
      if (q) params.set('search', q);
      if (statusFilter) params.set('status', statusFilter);
      const res = await apiRequest<{ devices: NetworkDevice[] }>(`/api/network-devices?${params.toString()}`);
      setDevices(res.devices);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load network devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, [search, globalSearch, statusFilter]);

  useEffect(() => {
    apiRequest<{ departments: Department[] }>('/api/users/departments').then((r) => setDepartments(r.departments)).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setHostname('');
    setDeviceType('Access Switch');
    setIpAddress('10.10.');
    setMacAddress('');
    setSubnetMask('255.255.255.0');
    setVlan('');
    setLocation('');
    setDepartmentId('');
    setManufacturer('Cisco');
    setModel('');
    setStatus('Online');
    setIssueNotes('');
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (dev: NetworkDevice) => {
    setEditing(dev);
    setHostname(dev.hostname);
    setDeviceType(dev.device_type);
    setIpAddress(dev.ip_address);
    setMacAddress(dev.mac_address);
    setSubnetMask(dev.subnet_mask);
    setVlan(dev.vlan || '');
    setLocation(dev.location);
    setDepartmentId(dev.department_id ? String(dev.department_id) : '');
    setManufacturer(dev.manufacturer);
    setModel(dev.model || '');
    setStatus(dev.status);
    setIssueNotes(dev.issue_notes || '');
    setFormError('');
    setModalOpen(true);
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const payload = {
        hostname,
        deviceType,
        ipAddress,
        macAddress,
        subnetMask,
        vlan: vlan || undefined,
        location,
        departmentId: departmentId ? Number(departmentId) : null,
        manufacturer,
        model: model || undefined,
        status,
        issueNotes: issueNotes || undefined,
      };
      if (editing) {
        await apiRequest(`/api/network-devices/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/network-devices', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await loadDevices();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save network device');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTroubleshooting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;
    setSaving(true);
    try {
      const res = await apiRequest<{ device: NetworkDevice }>(`/api/network-devices/${selectedDevice.id}/troubleshoot`, {
        method: 'POST',
        body: JSON.stringify({
          action: tsAction,
          outcome: tsOutcome,
          newStatus: tsNewStatus,
        }),
      });
      setSelectedDevice(res.device);
      setTsAction('');
      setTsOutcome('');
      await loadDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log troubleshooting entry');
    } finally {
      setSaving(false);
    }
  };

  const parseHistory = (raw: string): TroubleshootingEntry[] => {
    try {
      return JSON.parse(raw || '[]');
    } catch {
      return [];
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Network Infrastructure &amp; Diagnostics</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage campus routers, switches, firewalls, IPv4 addressing, connectivity issues, and troubleshooting history.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Register Network Device</span>
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100">
          {['', ...NET_STATUSES].map((st) => (
            <button
              key={st || 'All'}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                statusFilter === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st || 'All Nodes'}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hostname, IP, location..."
            className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-1.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Hostname &amp; Model</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">IP / MAC / VLAN</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Connectivity Notes</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr><td colSpan={7} className="py-10 text-center text-slate-500">Loading network devices...</td></tr>
              ) : devices.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-500">No network devices match the filter.</td></tr>
              ) : (
                devices.map((dev) => (
                  <tr key={dev.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs font-semibold text-slate-900">{dev.hostname}</div>
                      <div className="text-xs text-slate-500">{dev.manufacturer} {dev.model || ''}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">{dev.device_type}</td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-xs font-semibold text-blue-700">{dev.ip_address}</div>
                      <div className="font-mono text-[11px] text-slate-500">{dev.mac_address} · {dev.vlan || 'Default'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs font-medium text-slate-800">{dev.location}</div>
                      <div className="text-[11px] text-slate-500">{dev.department_name || 'Core Infrastructure'}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-xs">
                      <span className="line-clamp-2">{dev.issue_notes || 'No active alerts'}</span>
                    </td>
                    <td className="py-3 px-4"><StatusTag value={dev.status} /></td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDevice(dev);
                            setTsNewStatus(dev.status);
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <Wrench className="h-3.5 w-3.5" />
                          <span>Diagnose</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(dev)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 rounded-md hover:bg-blue-50 cursor-pointer"
                          title="Edit device"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Network Device Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editing ? `Edit Device: ${editing.hostname}` : 'Register Network Device'}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveDevice} className="p-6 space-y-4 overflow-y-auto">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">{formError}</div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Hostname</label>
                  <input type="text" required value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="SW-ENG-FL1.campus.edu" className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Device Type</label>
                  <select value={deviceType} onChange={(e) => setDeviceType(e.target.value as NetworkDevice['device_type'])} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    {DEVICE_TYPES.map((dt) => <option key={dt} value={dt}>{dt}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">IPv4 Address</label>
                  <input type="text" required value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} placeholder="10.10.25.10" className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Subnet Mask</label>
                  <input type="text" required value={subnetMask} onChange={(e) => setSubnetMask(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">VLAN</label>
                  <input type="text" value={vlan} onChange={(e) => setVlan(e.target.value)} placeholder="VLAN 25" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">MAC Address</label>
                  <input type="text" required value={macAddress} onChange={(e) => setMacAddress(e.target.value)} placeholder="00:1A:2B:3C:4D:99" className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as NetworkDevice['status'])} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    {NET_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Manufacturer</label>
                  <input type="text" required value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Model</label>
                  <input type="text" value={model} onChange={(e) => setModel(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                  <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="">Core Infrastructure</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Physical Location</label>
                  <input type="text" required value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Rack R2-U12" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Connectivity / Issue Notes</label>
                <textarea rows={2} value={issueNotes} onChange={(e) => setIssueNotes(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer">
                  {saving ? 'Saving...' : 'Save Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Troubleshooting History Drawer */}
      {selectedDevice && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-start justify-between">
              <div>
                <div className="font-mono text-xs text-blue-300">{selectedDevice.ip_address} · {selectedDevice.mac_address}</div>
                <h2 className="font-display text-lg font-bold mt-0.5">{selectedDevice.hostname}</h2>
                <div className="text-xs text-slate-300 mt-0.5">{selectedDevice.device_type} · {selectedDevice.location}</div>
              </div>
              <button type="button" onClick={() => setSelectedDevice(null)} className="text-slate-300 hover:text-white p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex items-center justify-between">
                <StatusTag value={selectedDevice.status} />
                <span className="text-xs text-slate-500 font-mono">
                  Last checked: {new Date(selectedDevice.last_checked_at).toLocaleString()}
                </span>
              </div>

              <form onSubmit={handleAddTroubleshooting} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                  <Activity className="h-4 w-4 text-blue-600" />
                  <span>Log Network Troubleshooting Action</span>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Diagnostic Action Taken</label>
                  <input
                    type="text"
                    required
                    value={tsAction}
                    onChange={(e) => setTsAction(e.target.value)}
                    placeholder="e.g., Replaced CAT6 patch cable and verified PoE link"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">Observed Outcome</label>
                    <input
                      type="text"
                      required
                      value={tsOutcome}
                      onChange={(e) => setTsOutcome(e.target.value)}
                      placeholder="0% packet loss over 100 pings"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">Updated Device Status</label>
                    <select
                      value={tsNewStatus}
                      onChange={(e) => setTsNewStatus(e.target.value as NetworkDevice['status'])}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                    >
                      {NET_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer">
                    {saving ? 'Logging...' : 'Record Diagnostic Log'}
                  </button>
                </div>
              </form>

              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Troubleshooting History
                </h3>
                <div className="space-y-3">
                  {parseHistory(selectedDevice.troubleshooting_history).length === 0 ? (
                    <div className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-200 rounded-lg">
                      No troubleshooting entries recorded yet.
                    </div>
                  ) : (
                    parseHistory(selectedDevice.troubleshooting_history).map((entry, idx) => (
                      <div key={idx} className="rounded-lg border border-slate-200 p-3.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-900">{entry.technician}</span>
                          <span className="font-mono text-[11px] text-slate-500">{entry.date}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-800">{entry.action}</div>
                        <div className="mt-1 text-xs text-emerald-700 font-medium">Outcome: {entry.outcome}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
