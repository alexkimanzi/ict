import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Bell,
  CheckCheck,
  FileBarChart2,
  HardDrive,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Search,
  ShieldAlert,
  Ticket,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import type { NotificationItem } from '../types';

export type NavSection =
  | 'dashboard'
  | 'helpdesk'
  | 'assets'
  | 'maintenance'
  | 'network'
  | 'reports'
  | 'users'
  | 'audit';

interface LayoutProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  globalSearch: string;
  onGlobalSearchChange: (value: string) => void;
  onOpenPreferences: () => void;
  children: React.ReactNode;
}

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Administrator', 'ICT Technician', 'Staff Member', 'Student'] },
  { id: 'helpdesk', label: 'ICT Helpdesk', icon: Ticket, roles: ['Administrator', 'ICT Technician', 'Staff Member', 'Student'] },
  { id: 'assets', label: 'Asset Inventory', icon: HardDrive, roles: ['Administrator', 'ICT Technician', 'Staff Member'] },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench, roles: ['Administrator', 'ICT Technician'] },
  { id: 'network', label: 'Network Devices', icon: Network, roles: ['Administrator', 'ICT Technician'] },
  { id: 'reports', label: 'Reports & Export', icon: FileBarChart2, roles: ['Administrator', 'ICT Technician'] },
  { id: 'users', label: 'User Management', icon: Users, roles: ['Administrator'] },
  { id: 'audit', label: 'Audit Logs', icon: ShieldAlert, roles: ['Administrator'] },
];

export function Layout({
  activeSection,
  onNavigate,
  globalSearch,
  onGlobalSearchChange,
  onOpenPreferences,
  children,
}: LayoutProps) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement | null>(null);

  const fetchNotifications = async () => {
    try {
      const data = await apiRequest<{ notifications: NotificationItem[]; unreadCount: number }>('/api/notifications');
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // Ignore silent polling errors
    }
  };

  useEffect(() => {
    fetchNotifications();
    const timer = window.setInterval(fetchNotifications, 25000);
    return () => window.clearInterval(timer);
  }, [activeSection]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markRead = async (n: NotificationItem) => {
    if (!n.is_read) {
      await apiRequest(`/api/notifications/${n.id}/read`, { method: 'PATCH' }).catch(() => {});
      fetchNotifications();
    }
    if (n.reference_type === 'ticket') onNavigate('helpdesk');
    else if (n.reference_type === 'asset') onNavigate('assets');
    else if (n.reference_type === 'maintenance') onNavigate('maintenance');
    else if (n.reference_type === 'network') onNavigate('network');
    setNotifOpen(false);
  };

  const markAllRead = async () => {
    await apiRequest('/api/notifications/read-all', { method: 'PATCH' }).catch(() => {});
    fetchNotifications();
  };

  const visibleNav = NAV_ITEMS.filter((item) => user && item.roles.includes(user.role_name));
  const currentTitle = NAV_ITEMS.find((i) => i.id === activeSection)?.label || 'Dashboard';

  const SidebarContent = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-200">
      <div className="flex items-center justify-between px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
            <Activity className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-sm font-bold text-white truncate">AKHIM ICT Support Desk</div>
            <div className="text-[11px] text-slate-400 truncate">Asset &amp; Service Desk</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden text-slate-400 hover:text-white p-1"
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id);
                setMobileOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="text-xs font-semibold text-white truncate">{user?.full_name}</div>
        <div className="text-[11px] text-slate-400 truncate mt-0.5">
          {user?.role_name} {user?.department_name ? `· ${user.department_name}` : ''}
        </div>
        <button
          type="button"
          onClick={logout}
          className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen border-r border-slate-800">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 max-w-[80vw] h-full z-10">{SidebarContent}</div>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="text-xs text-slate-500 whitespace-nowrap">
                <span>AKHIM ICT Support Desk</span>
                <span className="mx-1.5" aria-hidden="true">/</span>
                <span className="text-slate-900 font-medium">{currentTitle}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="relative hidden sm:block w-56 md:w-72">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={globalSearch}
                onChange={(e) => onGlobalSearchChange(e.target.value)}
                placeholder="Quick search..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>

            {/* Notification Popover */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                aria-label="View notifications"
                className="relative rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden z-40">
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">Notifications</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setNotifOpen(false);
                          onOpenPreferences();
                        }}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        Email/SMS Settings
                      </button>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllRead}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                          <span>Mark all read</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-slate-500">
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => markRead(n)}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer ${
                            !n.is_read ? 'bg-blue-50/50' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-900">{n.title}</span>
                            {!n.is_read && <span className="text-[10px] font-medium text-blue-700 shrink-0">New</span>}
                          </div>
                          <p className="mt-1 text-xs text-slate-600 leading-relaxed">{n.message}</p>
                          <div className="mt-1 text-[11px] font-mono text-slate-400">
                            {new Date(n.created_at).toLocaleString()}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onOpenPreferences}
              title="Email & SMS notification preferences"
              className="hidden md:flex items-center gap-2.5 pl-2 border-l border-slate-200 hover:opacity-80 transition-opacity cursor-pointer"
            >
              <div className="h-8 w-8 rounded-lg bg-slate-900 text-white text-xs font-semibold flex items-center justify-center">
                {user?.full_name
                  .split(' ')
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-900 whitespace-nowrap">{user?.full_name}</div>
                <div className="text-[11px] text-slate-500 whitespace-nowrap">{user?.role_name}</div>
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>

        <footer className="border-t border-slate-200 bg-white px-4 sm:px-6 lg:px-8 py-4">
          <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700">
              Powered by <span className="font-semibold text-slate-900">AKHIMTECHSOLUTION</span>
            </span>
            <div className="flex flex-wrap items-center gap-3 font-mono">
              <a href="tel:+254769623736" className="hover:text-blue-600 transition-colors">
                +254769623736
              </a>
              <span aria-hidden="true">·</span>
              <a href="mailto:akhimtechsolution@gmail.com" className="hover:text-blue-600 transition-colors">
                akhimtechsolution@gmail.com
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
