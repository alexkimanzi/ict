import { useEffect, useState } from 'react';
import { AssetsView } from './components/AssetsView';
import { AuditLogsView } from './components/AuditLogsView';
import { AuthScreen } from './components/AuthScreen';
import { DashboardView } from './components/DashboardView';
import { HelpdeskView } from './components/HelpdeskView';
import { Layout, type NavSection } from './components/Layout';
import { MaintenanceView } from './components/MaintenanceView';
import { NetworkView } from './components/NetworkView';
import { NotificationPreferencesModal } from './components/NotificationPreferencesModal';
import { ReportsView } from './components/ReportsView';
import { UsersView } from './components/UsersView';
import { AuthProvider, useAuth } from './context/AuthContext';

function PortalShell() {
  const { user, loading } = useAuth();
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [globalSearch, setGlobalSearch] = useState('');
  const [newTicketTrigger, setNewTicketTrigger] = useState(0);
  const [prefsOpen, setPrefsOpen] = useState(false);

  useEffect(() => {
    setActiveSection('dashboard');
    setGlobalSearch('');
  }, [user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm font-medium text-slate-600">Loading ICT Operations Portal...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const isAdmin = user.role_name === 'Administrator';
  const isPrivileged = user.role_name === 'Administrator' || user.role_name === 'ICT Technician';
  const canViewAssets = isPrivileged || user.role_name === 'Staff Member';

  const handleOpenNewTicket = () => {
    setActiveSection('helpdesk');
    setNewTicketTrigger((prev) => prev + 1);
  };

  return (
    <Layout
      activeSection={activeSection}
      onNavigate={setActiveSection}
      globalSearch={globalSearch}
      onGlobalSearchChange={setGlobalSearch}
      onOpenPreferences={() => setPrefsOpen(true)}
    >
      {activeSection === 'dashboard' && (
        <DashboardView onNavigate={setActiveSection} onOpenNewTicket={handleOpenNewTicket} />
      )}
      {activeSection === 'helpdesk' && (
        <HelpdeskView globalSearch={globalSearch} openCreateModalTrigger={newTicketTrigger} />
      )}
      {activeSection === 'assets' && canViewAssets && (
        <AssetsView globalSearch={globalSearch} />
      )}
      {activeSection === 'maintenance' && isPrivileged && (
        <MaintenanceView globalSearch={globalSearch} />
      )}
      {activeSection === 'network' && isPrivileged && (
        <NetworkView globalSearch={globalSearch} />
      )}
      {activeSection === 'reports' && isPrivileged && <ReportsView />}
      {activeSection === 'users' && isAdmin && <UsersView globalSearch={globalSearch} />}
      {activeSection === 'audit' && isAdmin && <AuditLogsView globalSearch={globalSearch} />}

      {prefsOpen && <NotificationPreferencesModal onClose={() => setPrefsOpen(false)} />}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PortalShell />
    </AuthProvider>
  );
}
