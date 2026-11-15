-- ============================================================================
-- ICT HELP DESK AND ASSET MANAGEMENT SYSTEM
-- PostgreSQL Relational Database Schema (12 Core Tables)
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  permissions TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  code VARCHAR(20) NOT NULL UNIQUE,
  building VARCHAR(120) NOT NULL,
  head_name VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  department_id INTEGER REFERENCES departments(id) ON UPDATE CASCADE ON DELETE SET NULL,
  phone VARCHAR(40),
  staff_student_id VARCHAR(60) UNIQUE,
  email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  sms_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(20) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assets (
  id SERIAL PRIMARY KEY,
  asset_tag VARCHAR(60) NOT NULL UNIQUE,
  asset_identification_number VARCHAR(120) NOT NULL UNIQUE,
  serial_number VARCHAR(120) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  category_id INTEGER NOT NULL REFERENCES asset_categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  manufacturer VARCHAR(100) NOT NULL,
  model VARCHAR(120),
  purchase_date DATE NOT NULL,
  warranty_expiry DATE,
  department_id INTEGER REFERENCES departments(id) ON UPDATE CASCADE ON DELETE SET NULL,
  location VARCHAR(150) NOT NULL,
  condition VARCHAR(40) NOT NULL CHECK (condition IN ('Excellent', 'Good', 'Fair', 'Needs Maintenance', 'Damaged', 'Retired')),
  status VARCHAR(40) NOT NULL DEFAULT 'Operational' CHECK (status IN ('Operational', 'In Repair', 'Under Maintenance', 'Decommissioned')),
  assigned_user_id INTEGER REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS technicians (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  specialization VARCHAR(120) NOT NULL,
  certification VARCHAR(120),
  availability_status VARCHAR(30) NOT NULL DEFAULT 'Available' CHECK (availability_status IN ('Available', 'Busy', 'On Leave')),
  max_active_tickets INTEGER NOT NULL DEFAULT 8 CHECK (max_active_tickets > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id SERIAL PRIMARY KEY,
  ticket_number VARCHAR(40) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  category VARCHAR(80) NOT NULL CHECK (category IN ('Computer Problem', 'Printer Problem', 'Network Failure', 'Software Error', 'Password & Account Assistance', 'Other ICT Issue')),
  description TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  status VARCHAR(30) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Assigned', 'In Progress', 'Resolved', 'Closed')),
  requester_id INTEGER NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  assigned_technician_id INTEGER REFERENCES technicians(id) ON UPDATE CASCADE ON DELETE SET NULL,
  asset_id INTEGER REFERENCES assets(id) ON UPDATE CASCADE ON DELETE SET NULL,
  department_id INTEGER REFERENCES departments(id) ON UPDATE CASCADE ON DELETE SET NULL,
  location VARCHAR(150),
  attachment_path TEXT,
  attachment_name VARCHAR(255),
  resolution_details TEXT,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_comments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON UPDATE CASCADE ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  comment TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maintenance_records (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON UPDATE CASCADE ON DELETE CASCADE,
  technician_id INTEGER REFERENCES technicians(id) ON UPDATE CASCADE ON DELETE SET NULL,
  maintenance_type VARCHAR(40) NOT NULL CHECK (maintenance_type IN ('Preventive', 'Corrective Repair', 'Hardware Upgrade', 'Inspection')),
  issue_summary TEXT NOT NULL,
  work_performed TEXT,
  parts_replaced TEXT,
  cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  scheduled_date DATE NOT NULL,
  completed_date DATE,
  next_maintenance_date DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'In Progress', 'Completed', 'Cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS network_devices (
  id SERIAL PRIMARY KEY,
  hostname VARCHAR(120) NOT NULL UNIQUE,
  device_type VARCHAR(60) NOT NULL CHECK (device_type IN ('Core Router', 'Distribution Switch', 'Access Switch', 'Wireless AP', 'Firewall', 'Gateway', 'Server NIC')),
  ip_address INET NOT NULL,
  mac_address VARCHAR(32) NOT NULL UNIQUE,
  subnet_mask VARCHAR(40) NOT NULL DEFAULT '255.255.255.0',
  vlan VARCHAR(40),
  location VARCHAR(150) NOT NULL,
  department_id INTEGER REFERENCES departments(id) ON UPDATE CASCADE ON DELETE SET NULL,
  manufacturer VARCHAR(100) NOT NULL,
  model VARCHAR(100),
  status VARCHAR(30) NOT NULL DEFAULT 'Online' CHECK (status IN ('Online', 'Degraded', 'Offline', 'Maintenance')),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  issue_notes TEXT,
  troubleshooting_history TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(40) NOT NULL DEFAULT 'info',
  reference_type VARCHAR(40),
  reference_id INTEGER,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id SERIAL PRIMARY KEY,
  notification_id INTEGER REFERENCES notifications(id) ON UPDATE CASCADE ON DELETE SET NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms')),
  recipient VARCHAR(180) NOT NULL,
  provider VARCHAR(40) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'logged', 'failed')),
  provider_message_id VARCHAR(180),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id INTEGER,
  details TEXT NOT NULL,
  ip_address VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_department ON assets(department_id);
CREATE INDEX IF NOT EXISTS idx_assets_condition ON assets(condition);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_requester ON support_tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_tickets_technician ON support_tickets(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_asset ON maintenance_records(asset_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_records(status);
CREATE INDEX IF NOT EXISTS idx_network_status ON network_devices(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
