import React, { useState } from 'react';
import { Bell, Mail, Phone, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

export function NotificationPreferencesModal({ onClose }: { onClose: () => void }) {
  const { user, refreshProfile } = useAuth();
  const [phone, setPhone] = useState(user?.phone || '');
  const [emailEnabled, setEmailEnabled] = useState((user?.email_notifications ?? 1) === 1);
  const [smsEnabled, setSmsEnabled] = useState((user?.sms_notifications ?? 1) === 1);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiRequest('/api/auth/preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          phone: phone.trim() || null,
          emailNotifications: emailEnabled,
          smsNotifications: smsEnabled,
        }),
      });
      await refreshProfile();
      setMessage('Email and SMS alert preferences saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-blue-600" />
            <h2 className="font-display text-base font-bold text-slate-900">Email &amp; SMS Alert Preferences</h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {message && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{message}</div>
          )}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Registered Email Address</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <Mail className="h-4 w-4 text-slate-400" />
              <span>{user?.email}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Mobile Phone Number (for SMS Alerts)</label>
            <div className="relative">
              <Phone className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+254712400101"
                className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 font-mono text-sm text-slate-900"
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3 cursor-pointer">
              <div>
                <div className="text-xs font-semibold text-slate-900">Transactional Email Alerts</div>
                <div className="text-[11px] text-slate-500">Ticket updates, assignments &amp; maintenance schedules</div>
              </div>
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3 cursor-pointer">
              <div>
                <div className="text-xs font-semibold text-slate-900">SMS / Phone Number Alerts</div>
                <div className="text-[11px] text-slate-500">Urgent ticket &amp; maintenance notifications via SMS</div>
              </div>
              <input
                type="checkbox"
                checked={smsEnabled}
                onChange={(e) => setSmsEnabled(e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded"
              />
            </label>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium cursor-pointer">Close</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer">
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
