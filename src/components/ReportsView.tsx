import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { exportReportToExcel, exportReportToPDF } from '../lib/exportReports';

const REPORT_TYPES = [
  { id: 'inventory', label: 'Equipment Inventory' },
  { id: 'problems', label: 'Reported Technical Problems' },
  { id: 'resolved', label: 'Resolved Complaints' },
  { id: 'technicians', label: 'Technician Performance' },
  { id: 'maintenance', label: 'Equipment Maintenance' },
  { id: 'damaged', label: 'Damaged Equipment' },
] as const;

export function ReportsView() {
  const [activeType, setActiveType] = useState<string>('inventory');
  const [title, setTitle] = useState<string>('Equipment Inventory Report');
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    apiRequest<{ title: string; rows: Array<Record<string, unknown>> }>(`/api/reports/${activeType}`)
      .then((res) => {
        setTitle(res.title);
        setRows(res.rows);
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to generate report'))
      .finally(() => setLoading(false));
  }, [activeType]);

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Technical Reports &amp; Exports</h1>
          <p className="mt-1 text-sm text-slate-600">
            Generate live audit-ready ICT reports and export to PDF or Microsoft Excel (.xlsx).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={loading}
            onClick={() => exportReportToPDF(title, rows)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <FileText className="h-4 w-4" />
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => exportReportToExcel(title, rows)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Report Selector Tabs */}
      <div className="rounded-xl border border-slate-200 bg-white p-2 flex flex-wrap gap-1.5">
        {REPORT_TYPES.map((rt) => (
          <button
            key={rt.id}
            type="button"
            onClick={() => setActiveType(rt.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              activeType === rt.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {rt.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Report Preview Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">{title}</h2>
            <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {rows.length} record{rows.length === 1 ? '' : 's'} ready for export
            </div>
          </div>
          <Download className="h-4 w-4 text-slate-400" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                {columns.map((col) => (
                  <th key={col} className="py-3 px-4 capitalize whitespace-nowrap">
                    {col.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={Math.max(columns.length, 1)} className="py-10 text-center text-sm text-slate-500">
                    Generating report...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(columns.length, 1)} className="py-12 text-center text-sm text-slate-500">
                    No records match this report.
                  </td>
                </tr>
              ) : (
                rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50">
                    {columns.map((col) => (
                      <td key={col} className="py-3 px-4 text-slate-700 max-w-xs truncate">
                        {row[col] === null || row[col] === undefined ? '—' : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
