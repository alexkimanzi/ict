import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  PauseCircle,
  ShieldAlert,
  Wrench,
  XCircle,
} from 'lucide-react';

export function StatusTag({ value }: { value: string }) {
  const normalized = value.toLowerCase();

  let tone = 'bg-slate-100 text-slate-700 border-slate-200';
  let Icon = Clock;

  if (
    normalized === 'resolved' ||
    normalized === 'closed' ||
    normalized === 'operational' ||
    normalized === 'online' ||
    normalized === 'completed' ||
    normalized === 'excellent' ||
    normalized === 'good' ||
    normalized === 'active' ||
    normalized === 'available'
  ) {
    tone = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    Icon = CheckCircle2;
  } else if (
    normalized === 'in progress' ||
    normalized === 'assigned' ||
    normalized === 'scheduled' ||
    normalized === 'fair' ||
    normalized === 'under maintenance' ||
    normalized === 'maintenance' ||
    normalized === 'busy'
  ) {
    tone = 'bg-blue-50 text-blue-700 border-blue-200';
    Icon = Wrench;
  } else if (
    normalized === 'pending' ||
    normalized === 'needs maintenance' ||
    normalized === 'degraded' ||
    normalized === 'high' ||
    normalized === 'in repair'
  ) {
    tone = 'bg-amber-50 text-amber-800 border-amber-200';
    Icon = AlertTriangle;
  } else if (
    normalized === 'critical' ||
    normalized === 'damaged' ||
    normalized === 'offline' ||
    normalized === 'inactive' ||
    normalized === 'decommissioned' ||
    normalized === 'retired'
  ) {
    tone = 'bg-red-50 text-red-700 border-red-200';
    Icon = normalized === 'critical' ? ShieldAlert : XCircle;
  } else if (normalized === 'cancelled' || normalized === 'on leave') {
    tone = 'bg-slate-100 text-slate-600 border-slate-200';
    Icon = PauseCircle;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tone}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{value}</span>
    </span>
  );
}
