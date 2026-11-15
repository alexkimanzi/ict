import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  HardDrive,
  Plus,
  Ticket,
  Users,
  Wrench,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { DashboardData } from '../types';
import type { NavSection } from './Layout';
import { StatusTag } from './StatusBadge';

interface DashboardViewProps {
  onNavigate: (section: NavSection) => void;
  onOpenNewTicket: () => void;
}

export function DashboardView({ onNavigate, onOpenNewTicket }: DashboardViewProps) {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    apiRequest<DashboardData>('/api/dashboard/stats')
      .then((res) => {
        setData(res);
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const isPrivileged = user?.role_name === 'Administrator' || user?.role_name === 'ICT Technician';

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-28 rounded-xl border border-slate-200 bg-white animate-pulse p-5" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 rounded-xl border border-slate-200 bg-white animate-pulse" />
          <div className="h-72 rounded-xl border border-slate-200 bg-white animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error || 'Failed to load dashboard data.'}
      </div>
    );
  }

  const maxCategoryCount = Math.max(1, ...data.charts.ticketsByCategory.map((c) => c.count));
  const maxAssetCategoryCount = Math.max(1, ...data.charts.assetsByCategory.map((a) => a.count));

  const statusColorMap: Record<string, string> = {
    Pending: '#D97706',
    Assigned: '#2563EB',
    'In Progress': '#1D4ED8',
    Resolved: '#16A34A',
    Closed: '#475569',
  };

  const totalStatusTickets = data.charts.ticketsByStatus.reduce((acc, item) => acc + item.count, 0) || 1;

  return (
    <div className="space-y-8">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {isPrivileged ? 'ICT Service & Asset Command Center' : 'My ICT Helpdesk Overview'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {isPrivileged
              ? 'Live operational metrics across support tickets, hardware assets, maintenance schedules, and network health.'
              : 'Submit technical support requests, monitor active ticket progress, and review assigned ICT resources.'}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenNewTicket}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Report ICT Issue</span>
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      {isPrivileged ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Registered Users</span>
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {data.kpis.totalUsers}
            </div>
            <div className="mt-1 text-xs text-slate-500">Active portal accounts</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">ICT Equipment</span>
              <HardDrive className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {data.kpis.totalEquipment}
            </div>
            <div className="mt-1 text-xs text-slate-500">Tracked hardware units</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Pending Tickets</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {data.kpis.pendingTickets}
            </div>
            <div className="mt-1 text-xs text-slate-500">Awaiting resolution</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Resolved Tickets</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {data.kpis.resolvedTickets}
            </div>
            <div className="mt-1 text-xs text-slate-500">Completed &amp; closed</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Ongoing Repairs</span>
              <Wrench className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {data.kpis.ongoingRepairs}
            </div>
            <div className="mt-1 text-xs text-slate-500">Scheduled / in progress</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Needs Maintenance</span>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {data.kpis.maintenanceNeeded}
            </div>
            <div className="mt-1 text-xs text-slate-500">Damaged or due service</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">My Open Tickets</span>
              <Ticket className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {data.kpis.myOpenTickets}
            </div>
            <div className="mt-1 text-xs text-slate-500">Active support requests</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Resolved Requests</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {data.kpis.myResolvedTickets}
            </div>
            <div className="mt-1 text-xs text-slate-500">Completed by ICT team</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Assigned Equipment</span>
              <HardDrive className="h-4 w-4 text-slate-600" />
            </div>
            <div className="mt-3 font-display text-2xl font-bold text-slate-900 tabular-nums">
              {data.kpis.myAssignedAssets}
            </div>
            <div className="mt-1 text-xs text-slate-500">Hardware in your custody</div>
          </div>
        </div>
      )}

      {/* Graphical Statistics Section (Admin & ICT Technician) */}
      {isPrivileged && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 1: Tickets by Category Horizontal Bar */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-display text-base font-semibold text-slate-900">Tickets by Problem Category</h2>
            <p className="text-xs text-slate-500 mt-0.5">Distribution of reported technical complaints</p>
            <div className="mt-5 space-y-3.5">
              {data.charts.ticketsByCategory.map((item) => {
                const pct = Math.round((item.count / maxCategoryCount) * 100);
                return (
                  <div key={item.category}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-700 font-medium truncate pr-2">{item.category}</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">{item.count}</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart 2: Ticket Status Donut Breakdown */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-display text-base font-semibold text-slate-900">Ticket Resolution Pipeline</h2>
            <p className="text-xs text-slate-500 mt-0.5">Current workflow distribution across statuses</p>
            <div className="mt-5 flex items-center gap-6">
              <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0 -rotate-90" aria-label="Ticket status chart">
                <circle cx="60" cy="60" r="44" fill="none" stroke="#f1f5f9" strokeWidth="16" />
                {(() => {
                  let cumulative = 0;
                  const circumference = 2 * Math.PI * 44;
                  return data.charts.ticketsByStatus.map((item) => {
                    const fraction = item.count / totalStatusTickets;
                    const dash = fraction * circumference;
                    const offset = -cumulative * circumference;
                    cumulative += fraction;
                    return (
                      <circle
                        key={item.status}
                        cx="60"
                        cy="60"
                        r="44"
                        fill="none"
                        stroke={statusColorMap[item.status] || '#2563EB'}
                        strokeWidth="16"
                        strokeDasharray={`${dash} ${circumference - dash}`}
                        strokeDashoffset={offset}
                      />
                    );
                  });
                })()}
              </svg>
              <div className="flex-1 space-y-2">
                {data.charts.ticketsByStatus.map((item) => (
                  <div key={item.status} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: statusColorMap[item.status] || '#2563EB' }}
                      />
                      <span className="text-slate-700">{item.status}</span>
                    </div>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chart 3: Equipment Inventory by Category */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-display text-base font-semibold text-slate-900">Equipment Inventory Breakdown</h2>
            <p className="text-xs text-slate-500 mt-0.5">Registered assets grouped by hardware type</p>
            <div className="mt-5 space-y-3">
              {data.charts.assetsByCategory.map((item) => {
                const pct = Math.round((item.count / maxAssetCategoryCount) * 100);
                return (
                  <div key={item.category}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-700 font-medium truncate pr-2">{item.category}</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">{item.count}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-800 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tables Row: Recent Tickets + Upcoming Maintenance / Technician Load */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${isPrivileged ? 'lg:col-span-2' : 'lg:col-span-3'} rounded-xl border border-slate-200 bg-white overflow-hidden`}>
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">Recent Support Tickets</h2>
              <p className="text-xs text-slate-500">Latest reported ICT complaints and service statuses</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('helpdesk')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer whitespace-nowrap"
            >
              View all tickets
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Issue</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Reported</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {data.recentTickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-blue-700 whitespace-nowrap">
                      {t.ticket_number}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 line-clamp-1">{t.title}</div>
                      <div className="text-xs text-slate-500">
                        {t.category} · {t.requester_name}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusTag value={t.priority} />
                    </td>
                    <td className="py-3 px-4">
                      <StatusTag value={t.status} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {new Date(t.reported_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {isPrivileged && (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">Maintenance Queue</h2>
                <p className="text-xs text-slate-500">Scheduled preventive &amp; repair tasks</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('maintenance')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer whitespace-nowrap"
              >
                Manage
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {data.upcomingMaintenance.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">No pending maintenance tasks.</div>
              ) : (
                data.upcomingMaintenance.map((m) => (
                  <div key={m.id} className="px-6 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-900">{m.asset_tag}</span>
                      <StatusTag value={m.status} />
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">{m.asset_name}</div>
                    <div className="mt-0.5 text-xs text-slate-600 line-clamp-1">{m.issue_summary}</div>
                    <div className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
                      {m.maintenance_type} · Due {m.scheduled_date}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
