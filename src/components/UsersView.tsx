import React, { useEffect, useState } from 'react';
import { Edit2, Plus, Power, Search, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { Department, Role, User } from '../types';
import { StatusTag } from './StatusBadge';

export function UsersView({ globalSearch }: { globalSearch: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [phone, setPhone] = useState('');
  const [staffStudentId, setStaffStudentId] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const q = search || globalSearch;
      if (q) params.set('search', q);
      if (roleFilter) params.set('role', roleFilter);
      const res = await apiRequest<{ users: User[] }>(`/api/users?${params.toString()}`);
      setUsers(res.users);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [search, globalSearch, roleFilter]);

  useEffect(() => {
    apiRequest<{ roles: Role[] }>('/api/users/roles').then((r) => setRoles(r.roles)).catch(() => {});
    apiRequest<{ departments: Department[] }>('/api/users/departments').then((r) => setDepartments(r.departments)).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFullName('');
    setEmail('');
    setPassword('');
    setRoleId(roles[2] ? String(roles[2].id) : '3');
    setDepartmentId('');
    setPhone('');
    setStaffStudentId('');
    setSpecialization('');
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setFullName(u.full_name);
    setEmail(u.email);
    setPassword('');
    setRoleId(String(u.role_id));
    setDepartmentId(u.department_id ? String(u.department_id) : '');
    setPhone(u.phone || '');
    setStaffStudentId(u.staff_student_id || '');
    setSpecialization('');
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      if (editing) {
        await apiRequest(`/api/users/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            fullName,
            email,
            roleId: Number(roleId),
            departmentId: departmentId ? Number(departmentId) : null,
            phone: phone || undefined,
            staffStudentId: staffStudentId || undefined,
            newPassword: password || '',
          }),
        });
      } else {
        await apiRequest('/api/users', {
          method: 'POST',
          body: JSON.stringify({
            fullName,
            email,
            password,
            roleId: Number(roleId),
            departmentId: departmentId ? Number(departmentId) : null,
            phone: phone || undefined,
            staffStudentId: staffStudentId || undefined,
            specialization: specialization || undefined,
          }),
        });
      }
      setModalOpen(false);
      await loadUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (u: User) => {
    try {
      await apiRequest(`/api/users/${u.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: u.is_active ? false : true }),
      });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle user status');
    }
  };

  const selectedRoleName = roles.find((r) => String(r.id) === roleId)?.name;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">User &amp; Role Management</h1>
          <p className="mt-1 text-sm text-slate-600">
            Register staff, students, and ICT technicians, manage contact numbers for SMS/Email alerts, and govern access.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Register User</span>
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100">
          {['', ...roles.map((r) => r.name)].map((rn) => (
            <button
              key={rn || 'All'}
              type="button"
              onClick={() => setRoleFilter(rn)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                roleFilter === rn ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {rn || 'All Roles'}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-72">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, ID..."
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
                <th className="py-3 px-4">User &amp; Contact</th>
                <th className="py-3 px-4">Staff / Student ID</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr><td colSpan={6} className="py-10 text-center text-slate-500">Loading users...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-slate-500">No users found.</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{u.full_name}</div>
                      <div className="text-xs text-slate-500">
                        {u.email} {u.phone ? `· ${u.phone}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700">{u.staff_student_id || '—'}</td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-800">{u.role_name}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{u.department_name || 'Unassigned'}</td>
                    <td className="py-3 px-4"><StatusTag value={u.is_active ? 'Active' : 'Inactive'} /></td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleStatus(u)}
                          className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium cursor-pointer ${
                            u.is_active
                              ? 'border-red-200 text-red-700 hover:bg-red-50'
                              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          <Power className="h-3.5 w-3.5" />
                          <span>{u.is_active ? 'Deactivate' : 'Activate'}</span>
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editing ? `Edit User: ${editing.full_name}` : 'Register New User'}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">{formError}</div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                  <select required value={roleId} onChange={(e) => setRoleId(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email (for Notifications)</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number (for SMS)</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2547..." className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                  <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="">None</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Staff / Student ID</label>
                  <input type="text" value={staffStudentId} onChange={(e) => setStaffStudentId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" />
                </div>
              </div>
              {!editing && selectedRoleName === 'ICT Technician' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Technician Specialization</label>
                  <input type="text" value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="Networking, Hardware, ERP..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {editing ? 'Reset Password (leave blank to keep unchanged)' : 'Password (min 6 chars)'}
                </label>
                <input
                  type="password"
                  required={!editing}
                  minLength={editing ? 0 : 6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer">
                  {saving ? 'Saving...' : editing ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
