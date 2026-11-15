import React, { useEffect, useState } from 'react';
import {
  FileText,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Send,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { Asset, Department, SupportTicket, Technician, TicketComment } from '../types';
import { StatusTag } from './StatusBadge';

const TICKET_CATEGORIES = [
  'Computer Problem',
  'Printer Problem',
  'Network Failure',
  'Software Error',
  'Password & Account Assistance',
  'Other ICT Issue',
] as const;

const TICKET_STATUSES = ['Pending', 'Assigned', 'In Progress', 'Resolved', 'Closed'] as const;
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;

interface HelpdeskViewProps {
  globalSearch: string;
  openCreateModalTrigger: number;
}

export function HelpdeskView({ globalSearch, openCreateModalTrigger }: HelpdeskViewProps) {
  const { user } = useAuth();
  const isPrivileged = user?.role_name === 'Administrator' || user?.role_name === 'ICT Technician';

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // New Ticket Modal
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('Computer Problem');
  const [priority, setPriority] = useState<string>('Medium');
  const [assetId, setAssetId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Ticket Detail Drawer
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editTechId, setEditTechId] = useState('');
  const [editResolution, setEditResolution] = useState('');
  const [savingUpdate, setSavingUpdate] = useState(false);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const activeSearch = search || globalSearch;
      if (activeSearch) params.set('search', activeSearch);
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);

      const res = await apiRequest<{ tickets: SupportTicket[] }>(`/api/tickets?${params.toString()}`);
      setTickets(res.tickets);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [search, globalSearch, statusFilter, priorityFilter]);

  useEffect(() => {
    if (openCreateModalTrigger > 0) {
      setShowCreate(true);
    }
  }, [openCreateModalTrigger]);

  useEffect(() => {
    apiRequest<{ departments: Department[] }>('/api/users/departments')
      .then((d) => setDepartments(d.departments))
      .catch(() => {});
    apiRequest<{ assets: Asset[] }>('/api/assets')
      .then((a) => setAssets(a.assets))
      .catch(() => {});
    if (isPrivileged) {
      apiRequest<{ technicians: Technician[] }>('/api/users/technicians')
        .then((t) => setTechnicians(t.technicians))
        .catch(() => {});
    }
  }, [isPrivileged]);

  const openTicketDetail = async (ticketId: number) => {
    try {
      const data = await apiRequest<{ ticket: SupportTicket; comments: TicketComment[] }>(`/api/tickets/${ticketId}`);
      setSelectedTicket(data.ticket);
      setComments(data.comments);
      setEditStatus(data.ticket.status);
      setEditPriority(data.ticket.priority);
      setEditTechId(data.ticket.assigned_technician_id ? String(data.ticket.assigned_technician_id) : '');
      setEditResolution(data.ticket.resolution_details || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load ticket details');
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('category', category);
      fd.append('priority', priority);
      fd.append('description', description);
      if (assetId) fd.append('assetId', assetId);
      if (departmentId) fd.append('departmentId', departmentId);
      if (location) fd.append('location', location);
      if (attachment) fd.append('attachment', attachment);

      await apiRequest('/api/tickets', {
        method: 'POST',
        body: fd,
      });

      setShowCreate(false);
      setTitle('');
      setDescription('');
      setLocation('');
      setAssetId('');
      setAttachment(null);
      await loadTickets();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setSavingUpdate(true);
    try {
      await apiRequest(`/api/tickets/${selectedTicket.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: editStatus,
          priority: editPriority,
          assignedTechnicianId: editTechId ? Number(editTechId) : null,
          resolutionDetails: editResolution,
        }),
      });
      await openTicketDetail(selectedTicket.id);
      await loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update ticket');
    } finally {
      setSavingUpdate(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newComment.trim()) return;
    try {
      await apiRequest(`/api/tickets/${selectedTicket.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          comment: newComment.trim(),
          isInternal: isInternalNote,
        }),
      });
      setNewComment('');
      setIsInternalNote(false);
      await openTicketDetail(selectedTicket.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">ICT Helpdesk &amp; Tickets</h1>
          <p className="mt-1 text-sm text-slate-600">
            {isPrivileged
              ? 'Assign technicians, update ticket workflows, and document resolution notes.'
              : 'Report computer, printer, network, software, or account issues and track repair progress.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Support Ticket</span>
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100">
          {['', ...TICKET_STATUSES].map((st) => (
            <button
              key={st || 'All'}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === st ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st || 'All Tickets'}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticket #, title, user..."
              className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-1.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            aria-label="Filter by priority"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-blue-600 focus:outline-none"
          >
            <option value="">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tickets Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Ticket #</th>
                <th className="py-3 px-4">Subject &amp; Category</th>
                <th className="py-3 px-4">Requester</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Technician</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Date Reported</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-slate-500">Loading support tickets...</td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-slate-500">
                    No support tickets match the selected filters.
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => openTicketDetail(ticket.id)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-blue-700 whitespace-nowrap">
                      {ticket.ticket_number}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900 flex items-center gap-2">
                        <span className="line-clamp-1">{ticket.title}</span>
                        {ticket.attachment_path && (
                          <Paperclip className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {ticket.category} {ticket.asset_tag ? `· ${ticket.asset_tag}` : ''}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-900 text-xs font-medium">{ticket.requester_name}</div>
                      <div className="text-[11px] text-slate-500">{ticket.department_name || ticket.requester_role}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusTag value={ticket.priority} />
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                      {ticket.technician_name || <span className="text-slate-400">Unassigned</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusTag value={ticket.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {new Date(ticket.reported_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Ticket Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">Submit ICT Support Request</h2>
                <p className="text-xs text-slate-500">Provide clear problem details and attach screenshots if helpful.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="p-6 space-y-4 overflow-y-auto">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Issue Summary Title</label>
                <input
                  type="text"
                  required
                  minLength={4}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Network drop in Engineering Lab 3 or Password Reset"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Problem Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {TICKET_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Priority Level</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="">Default / My Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Related Equipment (Optional)</label>
                  <select
                    value={assetId}
                    onChange={(e) => setAssetId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="">None / Not listed</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>{a.asset_tag} — {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Specific Room / Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Science Wing Room 204, Desk 12"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Detailed Description</label>
                <textarea
                  required
                  minLength={10}
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe exact error messages, symptoms, and when the problem started..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Screenshot or Supporting File (PNG, JPG, PDF, TXT · Max 5MB)
                </label>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.pdf,.txt"
                  onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-slate-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-100"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? 'Submitting...' : 'Submit Support Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Detail Slide-Over Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-900 text-white">
              <div>
                <div className="font-mono text-xs text-blue-300">{selectedTicket.ticket_number}</div>
                <h2 className="font-display text-lg font-bold mt-0.5">{selectedTicket.title}</h2>
                <div className="text-xs text-slate-300 mt-1">
                  Reported by {selectedTicket.requester_name} · {new Date(selectedTicket.reported_at).toLocaleString()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="text-slate-300 hover:text-white p-1"
                aria-label="Close ticket drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Metadata Summary */}
              <div className="flex flex-wrap items-center gap-3">
                <StatusTag value={selectedTicket.status} />
                <StatusTag value={selectedTicket.priority} />
                <span className="text-xs text-slate-600">
                  {selectedTicket.category}
                  {selectedTicket.department_name ? ` · ${selectedTicket.department_name}` : ''}
                  {selectedTicket.location ? ` · ${selectedTicket.location}` : ''}
                </span>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Complaint Description</h3>
                <p className="mt-2 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-lg border border-slate-200 p-4">
                  {selectedTicket.description}
                </p>
              </div>

              {selectedTicket.asset_tag && (
                <div className="text-xs text-slate-700 bg-slate-50 rounded-lg border border-slate-200 px-4 py-3">
                  <span className="font-semibold">Affected Equipment:</span>{' '}
                  <span className="font-mono text-blue-700">{selectedTicket.asset_tag}</span> — {selectedTicket.asset_name}
                </div>
              )}

              {selectedTicket.attachment_path && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Supporting Attachment</h3>
                  <a
                    href={selectedTicket.attachment_path}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50"
                  >
                    <FileText className="h-4 w-4" />
                    <span>{selectedTicket.attachment_name || 'View Attachment'}</span>
                  </a>
                </div>
              )}

              {/* Technician / Admin Resolution Controls */}
              {isPrivileged ? (
                <form onSubmit={handleUpdateTicket} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                  <h3 className="font-display text-sm font-semibold text-slate-900">Technician Assignment &amp; Resolution</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                      >
                        {TICKET_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
                      <select
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                      >
                        {PRIORITIES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Assigned Technician</label>
                      <select
                        value={editTechId}
                        onChange={(e) => setEditTechId(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                      >
                        <option value="">Unassigned</option>
                        {technicians.map((tech) => (
                          <option key={tech.id} value={tech.id}>
                            {tech.full_name} ({tech.active_tickets} active)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Resolution Details</label>
                    <textarea
                      rows={3}
                      value={editResolution}
                      onChange={(e) => setEditResolution(e.target.value)}
                      placeholder="Document root cause, parts replaced, or steps taken to resolve..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingUpdate}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
                    >
                      {savingUpdate ? 'Saving...' : 'Save Ticket Updates'}
                    </button>
                  </div>
                </form>
              ) : (
                selectedTicket.resolution_details && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Resolution Details</h3>
                    <p className="mt-2 text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      {selectedTicket.resolution_details}
                    </p>
                  </div>
                )
              )}

              {/* Comments Thread */}
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Activity &amp; Comments ({comments.length})</span>
                </h3>
                <div className="space-y-3">
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      className={`rounded-lg border p-3.5 ${
                        c.is_internal ? 'border-amber-200 bg-amber-50/70' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900">
                          {c.author_name}{' '}
                          <span className="font-normal text-slate-500">· {c.author_role}</span>
                          {c.is_internal ? (
                            <span className="ml-2 text-amber-800 font-medium">(Internal Tech Note)</span>
                          ) : null}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {new Date(c.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm text-slate-700 whitespace-pre-wrap">{c.comment}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handlePostComment} className="mt-4 space-y-2">
                  <textarea
                    rows={2}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add an update or reply..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                  <div className="flex items-center justify-between">
                    {isPrivileged ? (
                      <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isInternalNote}
                          onChange={(e) => setIsInternalNote(e.target.checked)}
                          className="rounded border-slate-300 text-blue-600"
                        />
                        <span>Internal ICT technician note (hidden from requester)</span>
                      </label>
                    ) : (
                      <span />
                    )}
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Post Comment</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
