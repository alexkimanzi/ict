export type UserRole = 'Administrator' | 'ICT Technician' | 'Staff Member' | 'Student';

export interface User {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  staff_student_id: string | null;
  email_notifications?: number;
  sms_notifications?: number;
  is_active: number;
  role_id: number;
  role_name: UserRole;
  department_id: number | null;
  department_name: string | null;
  last_login_at?: string | null;
  created_at?: string;
}

export interface Role {
  id: number;
  name: UserRole;
  description: string;
}

export interface Department {
  id: number;
  name: string;
  code: string;
  building: string;
  head_name?: string | null;
}

export interface AssetCategory {
  id: number;
  name: string;
  code: string;
  description?: string | null;
}

export interface Technician {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  specialization: string;
  certification: string | null;
  availability_status: string;
  active_tickets: number;
}

export interface Asset {
  id: number;
  asset_tag: string;
  asset_identification_number: string;
  serial_number: string;
  name: string;
  category_id: number;
  category_name: string;
  category_code?: string;
  manufacturer: string;
  model: string | null;
  purchase_date: string;
  warranty_expiry: string | null;
  department_id: number | null;
  department_name: string | null;
  location: string;
  condition: 'Excellent' | 'Good' | 'Fair' | 'Needs Maintenance' | 'Damaged' | 'Retired';
  status: 'Operational' | 'In Repair' | 'Under Maintenance' | 'Decommissioned';
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  assigned_user_email?: string | null;
  assigned_user_phone?: string | null;
  assigned_user_staff_id?: string | null;
  assigned_user_role?: string | null;
  assigned_user_department?: string | null;
  notes: string | null;
  created_at: string;
}

export interface NotificationDelivery {
  id: number;
  notification_id: number | null;
  user_id: number;
  user_name: string;
  channel: 'email' | 'sms';
  recipient: string;
  provider: string;
  subject: string;
  body: string;
  status: 'sent' | 'logged' | 'failed';
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
}

export interface SupportTicket {
  id: number;
  ticket_number: string;
  title: string;
  category:
    | 'Computer Problem'
    | 'Printer Problem'
    | 'Network Failure'
    | 'Software Error'
    | 'Password & Account Assistance'
    | 'Other ICT Issue';
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Pending' | 'Assigned' | 'In Progress' | 'Resolved' | 'Closed';
  requester_id: number;
  requester_name: string;
  requester_email: string;
  requester_role: string;
  assigned_technician_id: number | null;
  technician_name: string | null;
  asset_id: number | null;
  asset_tag: string | null;
  asset_name: string | null;
  department_id: number | null;
  department_name: string | null;
  location: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  resolution_details: string | null;
  reported_at: string;
  assigned_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
}

export interface TicketComment {
  id: number;
  ticket_id: number;
  user_id: number;
  author_name: string;
  author_role: string;
  comment: string;
  is_internal: number;
  created_at: string;
}

export interface MaintenanceRecord {
  id: number;
  asset_id: number;
  asset_tag: string;
  asset_name: string;
  asset_condition: string;
  asset_location?: string;
  technician_id: number | null;
  technician_name: string | null;
  maintenance_type: 'Preventive' | 'Corrective Repair' | 'Hardware Upgrade' | 'Inspection';
  issue_summary: string;
  work_performed: string | null;
  parts_replaced: string | null;
  cost: number;
  scheduled_date: string;
  completed_date: string | null;
  next_maintenance_date: string | null;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
  created_at: string;
}

export interface TroubleshootingEntry {
  date: string;
  technician: string;
  action: string;
  outcome: string;
}

export interface NetworkDevice {
  id: number;
  hostname: string;
  device_type: 'Core Router' | 'Distribution Switch' | 'Access Switch' | 'Wireless AP' | 'Firewall' | 'Gateway' | 'Server NIC';
  ip_address: string;
  mac_address: string;
  subnet_mask: string;
  vlan: string | null;
  location: string;
  department_id: number | null;
  department_name: string | null;
  manufacturer: string;
  model: string | null;
  status: 'Online' | 'Degraded' | 'Offline' | 'Maintenance';
  last_checked_at: string;
  issue_notes: string | null;
  troubleshooting_history: string;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'alert' | 'success';
  reference_type: string | null;
  reference_id: number | null;
  is_read: number;
  created_at: string;
}

export interface AuditLogItem {
  id: number;
  user_id: number | null;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: string;
  ip_address: string | null;
  created_at: string;
}

export interface DashboardData {
  kpis: {
    totalUsers: number;
    totalEquipment: number;
    pendingTickets: number;
    resolvedTickets: number;
    ongoingRepairs: number;
    maintenanceNeeded: number;
    offlineNetworkDevices: number;
    myOpenTickets: number;
    myResolvedTickets: number;
    myAssignedAssets: number;
  };
  charts: {
    ticketsByStatus: Array<{ status: string; count: number }>;
    ticketsByCategory: Array<{ category: string; count: number }>;
    ticketsByPriority: Array<{ priority: string; count: number }>;
    assetsByCategory: Array<{ category: string; count: number }>;
    assetsByCondition: Array<{ condition: string; count: number }>;
    technicianWorkload: Array<{ name: string; availability: string; active_tickets: number; resolved_tickets: number }>;
  };
  recentTickets: Array<{
    id: number;
    ticket_number: string;
    title: string;
    category: string;
    priority: string;
    status: string;
    reported_at: string;
    requester_name: string;
    department_name: string | null;
  }>;
  upcomingMaintenance: Array<{
    id: number;
    maintenance_type: string;
    issue_summary: string;
    scheduled_date: string;
    status: string;
    asset_tag: string;
    asset_name: string;
    technician_name: string | null;
  }>;
}
