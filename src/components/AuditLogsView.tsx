import { useEffect, useState } from 'react';
import { Mail, MessageSquare, Search, ShieldAlert } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { AuditLogItem, NotificationDelivery } from '../types';
import { StatusTag } from './StatusBadge';

export function AuditLogsView({ globalSearch }: { globalSearch: string }) {
  const [tab, setTab] = useState<'audit' | 'deliveries'>('audit');
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');

  useEffect(() => {
    setLoading(true);
    if (tab === 'audit') {
      const params = new URLSearchParams();
      const q = search || globalSearch;
      if (q) params.set('search', q);
      if (entityType) params.set('entityType', entityType);

      apiRequest<{ logs: AuditLogItem[] }>(`/api/audit-logs?${params.toString()}`)
        .then((res) => {
          setLogs(res.logs);
          setError('');
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load audit logs'))
        .finally(() => setLoading(false));
    } else {
      apiRequest<{ deliveries: NotificationDelivery[] }>('/api/notifications/deliveries')
        .then((res) => {
          setDeliveries(res.deliveries);
          setError('');
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load delivery logs'))
        .finally(() => setLoading(false));
    }
  }, [tab, search, globalSearch, entityType]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Audit Logs &amp; Dispatch History</h1>
          <p className="mt-1 text-sm text-slate-600">
            Immutable security trail of user actions and transactional Email (SendGrid/Mailgun) &amp; SMS delivery records.
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 shrink-0">
          <button
            type="button"
            onClick={() => setTab('audit')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md cursor-pointer ${
              tab === 'audit' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>System Audit Trail</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('deliveries')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md cursor-pointer ${
              tab === 'deliveries' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Email &amp; SMS Dispatch Log</span>
          </button>
        </div>
      </div>

      {tab === 'audit' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action, actor, or details..."
              className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-1.5 text-sm text-slate-900"
            />
          </div>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            aria-label="Filter by entity type"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
          >
            <option value="">All Entities</option>
            <option value="user">Users</option>
            <option value="support_ticket">Support Tickets</option>
            <option value="asset">ICT Assets</option>
            <option value="maintenance_record">Maintenance</option>
            <option value="network_device">Network Devices</option>
          </select>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          {tab === 'audit' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4 text-right">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr><td colSpan={6} className="py-10 text-center text-sm text-slate-500">Loading audit trail...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-sm text-slate-500">No audit entries found.</td></tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap tabular-nums">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{log.actor_name || 'System'}</div>
                        <div className="text-[11px] text-slate-500">{log.actor_role || 'Automated'}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-blue-700 whitespace-nowrap">{log.action}</td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ''}
                      </td>
                      <td className="py-3 px-4 text-slate-800 max-w-md">{log.details}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500 whitespace-nowrap">{log.ip_address || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Channel &amp; Provider</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Subject &amp; Message</th>
                  <th className="py-3 px-4">Delivery State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr><td colSpan={5} className="py-10 text-center text-sm text-slate-500">Loading dispatch logs...</td></tr>
                ) : deliveries.length === 0 ? (
                  <tr><td colSpan={5} className="py-12 text-center text-sm text-slate-500">No Email or SMS dispatches recorded yet.</td></tr>
                ) : (
                  deliveries.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap tabular-nums">
                        {new Date(d.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 font-semibold text-slate-900 uppercase">
                          {d.channel === 'email' ? <Mail className="h-3.5 w-3.5 text-blue-600" /> : <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />}
                          <span>{d.channel}</span>
                          <span className="text-slate-400 font-normal">({d.provider})</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{d.user_name}</div>
                        <div className="font-mono text-[11px] text-slate-500">{d.recipient}</div>
                      </td>
                      <td className="py-3 px-4 max-w-md">
                        <div className="font-semibold text-slate-900">{d.subject}</div>
                        <div className="text-slate-600 line-clamp-1">{d.body}</div>
                        {d.error_message && (
                          <div className="text-[11px] text-slate-400 mt-0.5">{d.error_message}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <StatusTag value={d.status === 'sent' ? 'Completed' : d.status === 'logged' ? 'Scheduled' : 'Damaged'} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
