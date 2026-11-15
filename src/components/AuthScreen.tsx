import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Laptop, Lock, Mail, Network, ShieldCheck, Ticket, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { Department } from '../types';

const DEMO_ACCOUNTS = [
  { role: 'Administrator', email: 'admin@ictportal.edu', password: 'Password@123', summary: 'Full system, users, assets, reports & audit logs' },
  { role: 'ICT Technician', email: 'tech.kelvin@ictportal.edu', password: 'Password@123', summary: 'Tickets, repairs, maintenance & network tools' },
  { role: 'Staff Member', email: 'staff.grace@ictportal.edu', password: 'Password@123', summary: 'Submit tickets, track repairs & view dept assets' },
  { role: 'Student', email: 'student.lydia@ictportal.edu', password: 'Password@123', summary: 'Report lab, Wi-Fi & account issues and track progress' },
];

export function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Login state
  const [loginEmail, setLoginEmail] = useState('admin@ictportal.edu');
  const [loginPassword, setLoginPassword] = useState('Password@123');

  // Register state
  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [accountType, setAccountType] = useState<'Student' | 'Staff Member'>('Student');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [staffStudentId, setStaffStudentId] = useState('');

  useEffect(() => {
    apiRequest<{ departments: Department[] }>('/api/auth/departments')
      .then((res) => setDepartments(res.departments))
      .catch(() => setDepartments([]));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(loginEmail, loginPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register({
        fullName,
        email: regEmail,
        password: regPassword,
        accountType,
        departmentId: departmentId ? Number(departmentId) : null,
        phone: phone || undefined,
        staffStudentId: staffStudentId || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (email: string, password: string) => {
    setMode('login');
    setLoginEmail(email);
    setLoginPassword(password);
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row">
      {/* Left Institutional Dark-Grey & Blue Panel */}
      <div className="lg:w-[46%] bg-slate-900 text-white px-8 py-12 lg:px-14 lg:py-16 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-semibold tracking-tight text-white">
              AKHIM ICT Support Desk
            </span>
          </div>

          <div className="mt-12 max-w-lg">
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight [text-wrap:balance]">
              AKHIM ICT Support Desk
            </h1>
            <p className="mt-4 text-base text-slate-300 leading-relaxed">
              Centralized service desk, hardware lifecycle tracking, preventive maintenance scheduling, and network diagnostics for campuses, hospitals, and enterprise ICT teams.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
            <div className="rounded-lg border border-slate-800 bg-slate-800/60 p-4">
              <Ticket className="h-5 w-5 text-blue-400" />
              <h2 className="mt-2.5 text-sm font-semibold text-white">Service Ticketing</h2>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                Track hardware, software, printer, network, and account tickets from intake to closure.
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-800/60 p-4">
              <Laptop className="h-5 w-5 text-blue-400" />
              <h2 className="mt-2.5 text-sm font-semibold text-white">Asset Lifecycle</h2>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                Audit serial numbers, department custody, warranty dates, and repair history.
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-800/60 p-4">
              <Network className="h-5 w-5 text-blue-400" />
              <h2 className="mt-2.5 text-sm font-semibold text-white">Network Visibility</h2>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                Monitor routers, switches, and APs with IPv4, VLAN, and troubleshooting logs.
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-800/60 p-4">
              <Lock className="h-5 w-5 text-blue-400" />
              <h2 className="mt-2.5 text-sm font-semibold text-white">Role Governance</h2>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                JWT sessions, bcrypt password protection, and 4-tier RBAC with full audit trails.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-400">
          <span>
            Powered by <strong className="text-white font-semibold">AKHIMTECHSOLUTION</strong>
          </span>
          <div className="flex flex-wrap items-center gap-2.5 font-mono text-slate-300">
            <a href="tel:+254769623736" className="hover:text-white transition-colors">
              +254769623736
            </a>
            <span aria-hidden="true">·</span>
            <a href="mailto:akhimtechsolution@gmail.com" className="hover:text-white transition-colors">
              akhimtechsolution@gmail.com
            </a>
          </div>
        </div>
      </div>

      {/* Right Authentication Form Panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 sm:px-10 bg-white">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 border border-slate-200 mb-7">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          {mode === 'login' ? (
            <>
              <div>
                <h2 className="font-display text-2xl font-bold text-slate-900">Welcome back</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Sign in with your institutional email and password.
                </p>
              </div>

              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="name@ictportal.edu"
                      className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-blue-600 py-2.5 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {submitting ? 'Signing in...' : 'Sign In to Portal'}
                </button>
              </form>

              {/* Role Quick-Fill Reference */}
              <div className="mt-8 pt-6 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-700 mb-3">
                  Quick Role Credentials (Password: <span className="font-mono">Password@123</span>)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {DEMO_ACCOUNTS.map((acct) => (
                    <button
                      key={acct.role}
                      type="button"
                      onClick={() => fillDemo(acct.email, acct.password)}
                      className="text-left rounded-lg border border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50 p-2.5 transition-colors cursor-pointer"
                    >
                      <div className="text-xs font-semibold text-slate-900">{acct.role}</div>
                      <div className="text-[11px] font-mono text-blue-700 truncate mt-0.5">{acct.email}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{acct.summary}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <h2 className="font-display text-2xl font-bold text-slate-900">Register Account</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Create a Staff Member or Student portal account to submit and track ICT requests.
                </p>
              </div>

              <form onSubmit={handleRegister} className="mt-5 space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Wambui"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Account Category</label>
                    <select
                      value={accountType}
                      onChange={(e) => setAccountType(e.target.value as 'Student' | 'Staff Member')}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    >
                      <option value="Student">Student</option>
                      <option value="Staff Member">Staff Member</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Institutional Email</label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="jane.wambui@ictportal.edu"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                    <select
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    >
                      <option value="">Select department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Staff / Student ID</label>
                    <input
                      type="text"
                      value={staffStudentId}
                      onChange={(e) => setStaffStudentId(e.target.value)}
                      placeholder="STD-2026-014"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+254 700 123 456"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Password (min 6 chars)</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Create password"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors cursor-pointer"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>{submitting ? 'Creating Account...' : 'Register & Sign In'}</span>
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
