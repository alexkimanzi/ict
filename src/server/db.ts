import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'ict_helpdesk.db');
export const db = new DatabaseSync(dbPath);

db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

function ensureColumn(table: string, column: string, definition: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      permissions TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      building TEXT NOT NULL,
      head_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      department_id INTEGER REFERENCES departments(id) ON UPDATE CASCADE ON DELETE SET NULL,
      phone TEXT,
      staff_student_id TEXT UNIQUE,
      email_notifications INTEGER NOT NULL DEFAULT 1 CHECK (email_notifications IN (0, 1)),
      sms_notifications INTEGER NOT NULL DEFAULT 1 CHECK (sms_notifications IN (0, 1)),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS asset_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_tag TEXT NOT NULL UNIQUE,
      asset_identification_number TEXT NOT NULL UNIQUE,
      serial_number TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES asset_categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      manufacturer TEXT NOT NULL,
      model TEXT,
      purchase_date TEXT NOT NULL,
      warranty_expiry TEXT,
      department_id INTEGER REFERENCES departments(id) ON UPDATE CASCADE ON DELETE SET NULL,
      location TEXT NOT NULL,
      condition TEXT NOT NULL CHECK (condition IN ('Excellent', 'Good', 'Fair', 'Needs Maintenance', 'Damaged', 'Retired')),
      status TEXT NOT NULL DEFAULT 'Operational' CHECK (status IN ('Operational', 'In Repair', 'Under Maintenance', 'Decommissioned')),
      assigned_user_id INTEGER REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS technicians (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
      specialization TEXT NOT NULL,
      certification TEXT,
      availability_status TEXT NOT NULL DEFAULT 'Available' CHECK (availability_status IN ('Available', 'Busy', 'On Leave')),
      max_active_tickets INTEGER NOT NULL DEFAULT 8 CHECK (max_active_tickets > 0),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('Computer Problem', 'Printer Problem', 'Network Failure', 'Software Error', 'Password & Account Assistance', 'Other ICT Issue')),
      description TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
      status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Assigned', 'In Progress', 'Resolved', 'Closed')),
      requester_id INTEGER NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      assigned_technician_id INTEGER REFERENCES technicians(id) ON UPDATE CASCADE ON DELETE SET NULL,
      asset_id INTEGER REFERENCES assets(id) ON UPDATE CASCADE ON DELETE SET NULL,
      department_id INTEGER REFERENCES departments(id) ON UPDATE CASCADE ON DELETE SET NULL,
      location TEXT,
      attachment_path TEXT,
      attachment_name TEXT,
      resolution_details TEXT,
      reported_at TEXT NOT NULL DEFAULT (datetime('now')),
      assigned_at TEXT,
      resolved_at TEXT,
      closed_at TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ticket_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON UPDATE CASCADE ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
      comment TEXT NOT NULL,
      is_internal INTEGER NOT NULL DEFAULT 0 CHECK (is_internal IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS maintenance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL REFERENCES assets(id) ON UPDATE CASCADE ON DELETE CASCADE,
      technician_id INTEGER REFERENCES technicians(id) ON UPDATE CASCADE ON DELETE SET NULL,
      maintenance_type TEXT NOT NULL CHECK (maintenance_type IN ('Preventive', 'Corrective Repair', 'Hardware Upgrade', 'Inspection')),
      issue_summary TEXT NOT NULL,
      work_performed TEXT,
      parts_replaced TEXT,
      cost REAL NOT NULL DEFAULT 0,
      scheduled_date TEXT NOT NULL,
      completed_date TEXT,
      next_maintenance_date TEXT,
      status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'In Progress', 'Completed', 'Cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS network_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hostname TEXT NOT NULL UNIQUE,
      device_type TEXT NOT NULL CHECK (device_type IN ('Core Router', 'Distribution Switch', 'Access Switch', 'Wireless AP', 'Firewall', 'Gateway', 'Server NIC')),
      ip_address TEXT NOT NULL,
      mac_address TEXT NOT NULL UNIQUE,
      subnet_mask TEXT NOT NULL DEFAULT '255.255.255.0',
      vlan TEXT,
      location TEXT NOT NULL,
      department_id INTEGER REFERENCES departments(id) ON UPDATE CASCADE ON DELETE SET NULL,
      manufacturer TEXT NOT NULL,
      model TEXT,
      status TEXT NOT NULL DEFAULT 'Online' CHECK (status IN ('Online', 'Degraded', 'Offline', 'Maintenance')),
      last_checked_at TEXT NOT NULL DEFAULT (datetime('now')),
      issue_notes TEXT,
      troubleshooting_history TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      reference_type TEXT,
      reference_id INTEGER,
      is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notification_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_id INTEGER REFERENCES notifications(id) ON UPDATE CASCADE ON DELETE SET NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
      channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
      recipient TEXT NOT NULL,
      provider TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('sent', 'logged', 'failed')),
      provider_message_id TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT NOT NULL,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

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
    CREATE INDEX IF NOT EXISTS idx_deliveries_created ON notification_deliveries(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
  `);

  ensureColumn('users', 'email_notifications', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('users', 'sms_notifications', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('assets', 'asset_identification_number', "TEXT DEFAULT ''");
  db.exec("UPDATE assets SET asset_identification_number = asset_tag WHERE asset_identification_number IS NULL OR asset_identification_number = ''");

  const existingRoles = db.prepare('SELECT COUNT(*) AS count FROM roles').get() as { count: number };
  if (existingRoles.count > 0) {
    return;
  }

  seedInitialData();
}

function seedInitialData(): void {
  const passwordHash = bcrypt.hashSync('Password@123', 10);

  const insertRole = db.prepare('INSERT INTO roles (name, description, permissions) VALUES (?, ?, ?)');
  insertRole.run('Administrator', 'Full system governance, user lifecycle, asset inventory, reports, and audit logs.', JSON.stringify(['*']));
  insertRole.run('ICT Technician', 'Ticket resolution, asset repairs, preventive maintenance, and network diagnostics.', JSON.stringify(['tickets:manage', 'assets:manage', 'maintenance:manage', 'network:manage', 'reports:view']));
  insertRole.run('Staff Member', 'Submit ICT support tickets, view department assets, and track complaint resolution.', JSON.stringify(['tickets:create', 'tickets:own', 'assets:view']));
  insertRole.run('Student', 'Submit ICT lab, Wi-Fi, and account helpdesk requests and track ticket progress.', JSON.stringify(['tickets:create', 'tickets:own']));

  const insertDept = db.prepare('INSERT INTO departments (name, code, building, head_name) VALUES (?, ?, ?, ?)');
  insertDept.run('ICT & Network Operations', 'ICT', 'Central Data Center, Block A', 'Dr. Samuel Mwangi');
  insertDept.run('Computer Science & Engineering', 'CSC', 'Science & Technology Wing', 'Prof. Beatrice Wanjiku');
  insertDept.run('Health Sciences & Teaching Lab', 'HSL', 'Medical Complex, Floor 2', 'Dr. Daniel Ochieng');
  insertDept.run('Finance & Administration', 'FIN', 'Administration Building', 'Grace Njoroge');
  insertDept.run('University Library & E-Learning', 'LIB', 'Main Knowledge Commons', 'Peter Kamau');
  insertDept.run('Student Affairs & Admissions', 'SAA', 'Student Services Center', 'Mercy Mutiso');

  const insertUser = db.prepare(`
    INSERT INTO users (full_name, email, password_hash, role_id, department_id, phone, staff_student_id, email_notifications, sms_notifications, is_active, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 1, datetime('now', ?))
  `);
  insertUser.run('Alex Mbuvi', 'admin@ictportal.edu', passwordHash, 1, 1, '+254712400101', 'ADM-001', '-1 hours');
  insertUser.run('Kelvin Otieno', 'tech.kelvin@ictportal.edu', passwordHash, 2, 1, '+254722410202', 'TEC-014', '-2 hours');
  insertUser.run('Faith Cherono', 'tech.faith@ictportal.edu', passwordHash, 2, 1, '+254733512303', 'TEC-019', '-3 hours');
  insertUser.run('Brian Mutua', 'tech.brian@ictportal.edu', passwordHash, 2, 1, '+254711609404', 'TEC-023', '-5 hours');
  insertUser.run('Dr. Grace Njoroge', 'staff.grace@ictportal.edu', passwordHash, 3, 4, '+254720882112', 'STF-204', '-6 hours');
  insertUser.run('Peter Kamau', 'staff.peter@ictportal.edu', passwordHash, 3, 5, '+254724319550', 'STF-318', '-12 hours');
  insertUser.run('Lydia Achieng', 'student.lydia@ictportal.edu', passwordHash, 4, 2, '+254790118209', 'STD-2024-0891', '-4 hours');
  insertUser.run('David Kiprop', 'student.david@ictportal.edu', passwordHash, 4, 3, '+254795301774', 'STD-2024-1142', '-18 hours');

  const insertTech = db.prepare(`
    INSERT INTO technicians (user_id, specialization, certification, availability_status, max_active_tickets)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertTech.run(2, 'Workstations, Servers & Active Directory', 'CompTIA A+ / Microsoft MCSA', 'Available', 10);
  insertTech.run(3, 'Campus Networking, Routing & Wi-Fi', 'Cisco CCNP Enterprise', 'Available', 8);
  insertTech.run(4, 'Printers, AV Projectors & Hardware Repair', 'HP Certified Service Tech', 'Busy', 8);

  const insertCat = db.prepare('INSERT INTO asset_categories (name, code, description) VALUES (?, ?, ?)');
  insertCat.run('Desktop Computer', 'DSK', 'Workstations and lab desktop PCs');
  insertCat.run('Laptop', 'LPT', 'Portable notebooks issued to faculty and staff');
  insertCat.run('Printer', 'PRT', 'LaserJet, multifunction, and departmental printers');
  insertCat.run('Router', 'RTR', 'Edge and core campus routing appliances');
  insertCat.run('Switch', 'SWT', 'Managed Layer 2 and Layer 3 PoE network switches');
  insertCat.run('Server', 'SRV', 'Rackmount compute, virtualization, and storage hosts');
  insertCat.run('Projector', 'PRJ', 'Lecture hall and boardroom display projectors');
  insertCat.run('UPS & Power', 'UPS', 'Uninterruptible power supplies and PDU units');

  const insertAsset = db.prepare(`
    INSERT INTO assets (
      asset_tag, asset_identification_number, serial_number, name, category_id, manufacturer, model,
      purchase_date, warranty_expiry, department_id, location, condition, status, assigned_user_id, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertAsset.run('ICT-DSK-1001', 'ICT-DSK-1001', 'SN-DL-884102A', 'OptiPlex 7010 Lab Workstation #01', 1, 'Dell', 'OptiPlex 7010 SFF', '2024-02-14', '2027-02-14', 2, 'CS Lab 2, Desk 01', 'Good', 'Operational', 7, 'Dual-boot Linux/Windows lab image');
  insertAsset.run('ICT-DSK-1002', 'ICT-DSK-1002', 'SN-DL-884103B', 'OptiPlex 7010 Lab Workstation #02', 1, 'Dell', 'OptiPlex 7010 SFF', '2024-02-14', '2027-02-14', 2, 'CS Lab 2, Desk 02', 'Needs Maintenance', 'In Repair', 7, 'Intermittent POST memory beep reported');
  insertAsset.run('ICT-LPT-2004', 'ICT-LPT-2004', 'SN-LN-992104X', 'ThinkPad T14 Gen 4 Executive', 2, 'Lenovo', 'ThinkPad T14 Gen 4', '2024-08-20', '2027-08-20', 4, 'Admin Block, Room 204', 'Excellent', 'Operational', 5, 'Issued to Finance Director');
  insertAsset.run('ICT-LPT-2008', 'ICT-LPT-2008', 'SN-HP-551029Q', 'EliteBook 840 G10 Staff Unit', 2, 'HP', 'EliteBook 840 G10', '2024-05-11', '2027-05-11', 5, 'Main Library, Desk 3', 'Good', 'Operational', 6, 'Library catalog workstation');
  insertAsset.run('ICT-PRT-3002', 'ICT-PRT-3002', 'SN-HP-M428FDW-19', 'LaserJet Pro MFP M428fdw', 3, 'HP', 'LaserJet Pro M428fdw', '2023-06-10', '2026-06-10', 4, 'Finance Corridor Bay', 'Needs Maintenance', 'In Repair', 5, 'Fuser paper jam sensor fault');
  insertAsset.run('ICT-PRT-3005', 'ICT-PRT-3005', 'SN-CN-IR2625-07', 'imageRUNNER 2625i Copier', 3, 'Canon', 'imageRUNNER 2625i', '2023-09-01', '2026-09-01', 6, 'Admissions Hall', 'Good', 'Operational', null, 'Shared department MFP');
  insertAsset.run('ICT-RTR-4001', 'ICT-RTR-4001', 'SN-CS-ISR4331-01', 'Core Campus Edge Router', 4, 'Cisco', 'ISR 4331', '2022-11-05', '2027-11-05', 1, 'Data Center Rack R1-U4', 'Excellent', 'Operational', 3, 'Primary BGP & WAN uplink');
  insertAsset.run('ICT-SWT-5003', 'ICT-SWT-5003', 'SN-CS-C9200L-11', 'Science Wing 48-Port PoE Switch', 5, 'Cisco', 'Catalyst 9200L-48P', '2023-03-18', '2028-03-18', 2, 'Science IDF Closet B', 'Fair', 'Under Maintenance', 3, 'High SFP optical error rate on port Te1/0/2');
  insertAsset.run('ICT-SWT-5007', 'ICT-SWT-5007', 'SN-AR-2930F-08', 'Library Floor 2 Access Switch', 5, 'Aruba', '2930F 48G PoE+', '2023-04-22', '2028-04-22', 5, 'Library Telecom Closet 2', 'Good', 'Operational', 3, 'Feeds 12 ceiling APs');
  insertAsset.run('ICT-SRV-6001', 'ICT-SRV-6001', 'SN-DL-R750-001', 'Academic ERP & Auth Server', 6, 'Dell', 'PowerEdge R750', '2023-01-12', '2028-01-12', 1, 'Data Center Rack R2-U10', 'Excellent', 'Operational', 2, '64 cores, 256GB ECC RAM, RAID-10 NVMe');
  insertAsset.run('ICT-SRV-6002', 'ICT-SRV-6002', 'SN-HP-DL380-04', 'Backup & File Storage Host', 6, 'HPE', 'ProLiant DL380 Gen10', '2022-07-19', '2027-07-19', 1, 'Data Center Rack R2-U14', 'Good', 'Operational', 2, 'Nightly ZFS snapshots');
  insertAsset.run('ICT-PRJ-7001', 'ICT-PRJ-7001', 'SN-EP-EB2250U', 'Lecture Theatre A Ceiling Projector', 7, 'Epson', 'EB-2250U 5000lm', '2022-04-08', '2025-04-08', 3, 'Medical Lecture Hall A', 'Damaged', 'In Repair', null, 'Lamp ballast failed during morning lecture');
  insertAsset.run('ICT-PRJ-7004', 'ICT-PRJ-7004', 'SN-BQ-MH733', 'Boardroom Interactive Projector', 7, 'BenQ', 'MH733 Full HD', '2024-01-25', '2027-01-25', 4, 'Executive Boardroom', 'Excellent', 'Operational', null, 'HDMI matrix verified');
  insertAsset.run('ICT-UPS-8001', 'ICT-UPS-8001', 'SN-AP-SMT3000', 'Data Center Smart-UPS 3000VA', 8, 'APC', 'Smart-UPS SMT3000RMI2U', '2023-05-30', '2026-05-30', 1, 'Data Center Rack R1-U38', 'Needs Maintenance', 'Operational', 2, 'Battery pack replacement due this quarter');

  const insertTicket = db.prepare(`
    INSERT INTO support_tickets (
      ticket_number, title, category, description, priority, status,
      requester_id, assigned_technician_id, asset_id, department_id, location,
      resolution_details, reported_at, assigned_at, resolved_at, closed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), ?, ?, ?)
  `);

  insertTicket.run('ICT-2026-0001', 'Finance MFP Printer constant paper jam on Tray 2', 'Printer Problem', 'The HP LaserJet Pro M428fdw in the Finance corridor jams every time payroll batch PDFs are printed from Tray 2. Error code 13.B9.D2 displays on panel.', 'High', 'In Progress', 5, 3, 5, 4, 'Finance Corridor Bay', 'Pickup rollers inspected; replacement fuser assembly ordered and installation underway.', '-6 days', "datetime('now', '-5 days')", null, null);
  insertTicket.run('ICT-2026-0002', 'CS Lab 2 Workstation #02 fails to boot with memory beep', 'Computer Problem', 'Desktop ICT-DSK-1002 emits 3 short beeps on startup and does not show display output on the monitor during programming practicals.', 'High', 'Assigned', 7, 1, 2, 2, 'CS Lab 2, Desk 02', null, '-4 days', "datetime('now', '-3 days')", null, null);
  insertTicket.run('ICT-2026-0003', 'Intermittent Wi-Fi & Ethernet drops in Science Wing Floor 2', 'Network Failure', 'Students and lab terminals connected to Science IDF Closet B lose IP connectivity every 15-20 minutes with high packet loss to the gateway.', 'Critical', 'In Progress', 7, 2, 8, 2, 'Science Wing, Floor 2', 'Identified CRC errors on SFP+ uplink module Te1/0/2. Replacing transceiver and testing fiber patch.', '-3 days', "datetime('now', '-3 days')", null, null);
  insertTicket.run('ICT-2026-0004', 'Library Koha catalog client throws TLS certificate error', 'Software Error', 'After yesterday OS patch, the library circulation terminal displays SEC_ERROR_UNKNOWN_ISSUER when connecting to the internal catalog portal.', 'Medium', 'Resolved', 6, 1, 4, 5, 'Main Library, Desk 3', 'Re-imported institutional root CA bundle into Firefox/system trust store and verified HTTPS handshake.', '-10 days', "datetime('now', '-9 days')", "datetime('now', '-8 days')", null);
  insertTicket.run('ICT-2026-0005', 'Student portal MFA reset and password unlock request', 'Password & Account Assistance', 'Replaced mobile phone and lost authenticator app access; unable to log into student registration portal before Friday deadline.', 'Medium', 'Pending', 8, null, null, 3, 'Medical Complex, Floor 2', null, '-1 days', null, null, null);
  insertTicket.run('ICT-2026-0006', 'Medical Lecture Hall A ceiling projector lamp failed', 'Other ICT Issue', 'Projector powered off abruptly during anatomy lecture and red lamp indicator is flashing continuously.', 'Critical', 'Assigned', 8, 3, 12, 3, 'Medical Lecture Hall A', null, '-2 days', "datetime('now', '-1 days')", null, null);
  insertTicket.run('ICT-2026-0007', 'ERP Accounting module slow report generation', 'Software Error', 'Quarterly ledger export times out after 60 seconds for Finance department users.', 'High', 'Resolved', 5, 1, 10, 4, 'Admin Block, Room 204', 'Increased query pool memory and rebuilt composite index on ledger_entries; export now completes in 2.4s.', '-15 days', "datetime('now', '-14 days')", "datetime('now', '-12 days')", null);
  insertTicket.run('ICT-2026-0008', 'New faculty laptop VPN profile provisioning', 'Password & Account Assistance', 'Need split-tunnel WireGuard/OpenVPN credentials configured on ThinkPad T14 for off-campus budget approvals.', 'Low', 'Closed', 5, 2, 3, 4, 'Admin Block, Room 204', 'Provisioned MFA-bound VPN certificate and verified remote access with user.', '-22 days', "datetime('now', '-21 days')", "datetime('now', '-20 days')", "datetime('now', '-19 days')");
  insertTicket.run('ICT-2026-0009', 'Admissions copier toner cartridge alignment warning', 'Printer Problem', 'Canon imageRUNNER 2625i showing faint vertical streak on left margin of admission letters.', 'Low', 'Closed', 6, 3, 6, 6, 'Admissions Hall', 'Cleaned drum corona wire and calibrated transfer belt.', '-28 days', "datetime('now', '-27 days')", "datetime('now', '-26 days')", "datetime('now', '-25 days')");
  insertTicket.run('ICT-2026-0010', 'Medical Lab Wi-Fi captive portal failing on Android tablets', 'Network Failure', 'Clinical assessment tablets fail DNS redirect on Guest/Student SSID in Medical Complex.', 'High', 'Pending', 8, null, null, 3, 'Medical Complex, Lab 3', null, '-6 hours', null, null, null);

  const insertComment = db.prepare("INSERT INTO ticket_comments (ticket_id, user_id, comment, is_internal, created_at) VALUES (?, ?, ?, ?, datetime('now', ?))");
  insertComment.run(1, 5, 'Payroll run is scheduled for Thursday morning, please prioritize.', 0, '-5 days');
  insertComment.run(1, 4, 'Disassembled Tray 2 feed clutch; awaiting replacement separation pad from stores.', 0, '-4 days');
  insertComment.run(3, 3, 'Confirmed 14% Rx CRC errors on interface Te1/0/2 of Catalyst 9200L.', 1, '-2 days');
  insertComment.run(3, 3, 'We have isolated the faulty fiber transceiver and are swapping it out today.', 0, '-1 days');
  insertComment.run(4, 2, 'Root CA certificate updated on workstation; please confirm catalog access works.', 0, '-8 days');
  insertComment.run(4, 6, 'Confirmed working smoothly now, thank you!', 0, '-8 days');

  const insertMaint = db.prepare(`
    INSERT INTO maintenance_records (
      asset_id, technician_id, maintenance_type, issue_summary, work_performed,
      parts_replaced, cost, scheduled_date, completed_date, next_maintenance_date, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertMaint.run(5, 3, 'Corrective Repair', 'Paper jam sensor & fuser roller wear', 'Cleaning paper path and replacing Tray 2 separation pad', 'HP RM2-5425 Separation Roller Kit', 85.00, '2026-11-14', null, '2027-02-14', 'In Progress');
  insertMaint.run(12, 3, 'Corrective Repair', 'Projector lamp ballast failure', 'Diagnosed power rail; replacement UHE lamp module ordered', 'Epson ELPLP95 Lamp Assembly', 210.00, '2026-11-16', null, '2027-05-16', 'Scheduled');
  insertMaint.run(14, 1, 'Preventive', 'Quarterly UPS battery load & runtime calibration', null, 'APC RBC43 Battery Cartridge (pending)', 340.00, '2026-11-20', null, '2027-02-20', 'Scheduled');
  insertMaint.run(10, 1, 'Preventive', 'Data center server dust purge & firmware patch', 'Updated iDRAC9 firmware, verified RAID-10 SMART health', 'None', 0.00, '2026-11-01', '2026-11-01', '2027-02-01', 'Completed');
  insertMaint.run(8, 2, 'Corrective Repair', 'SFP+ fiber link flapping and CRC errors', 'Testing LC/LC multimode patch cord and swapping 10GBASE-SR SFP', 'Cisco SFP-10G-SR Transceiver', 145.00, '2026-11-15', null, '2027-05-15', 'In Progress');
  insertMaint.run(2, 1, 'Inspection', 'POST 3-beep memory slot diagnostic', 'Reseating DDR5 DIMM modules and running MemTest86+', null, 0.00, '2026-11-15', null, '2027-05-15', 'Scheduled');

  const insertNet = db.prepare(`
    INSERT INTO network_devices (
      hostname, device_type, ip_address, mac_address, subnet_mask, vlan,
      location, department_id, manufacturer, model, status, last_checked_at, issue_notes, troubleshooting_history
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), ?, ?)
  `);
  insertNet.run('CORE-RTR-01.campus.edu', 'Core Router', '10.10.0.1', '00:1A:2B:3C:4D:01', '255.255.255.0', 'VLAN 10 (Core)', 'Data Center Rack R1-U4', 1, 'Cisco', 'ISR 4331', 'Online', '-5 minutes', 'All BGP peers established; CPU load 14%.', JSON.stringify([{ date: '2026-11-10', technician: 'Faith Cherono', action: 'Verified BGP failover path to secondary ISP', outcome: 'Passed with <200ms convergence' }]));
  insertNet.run('FW-EDGE-01.campus.edu', 'Firewall', '10.10.0.2', '00:1A:2B:3C:4D:02', '255.255.255.0', 'VLAN 10 (DMZ)', 'Data Center Rack R1-U6', 1, 'Fortinet', 'FortiGate 200F', 'Online', '-5 minutes', 'IPS & SSL inspection nominal.', JSON.stringify([{ date: '2026-11-12', technician: 'Faith Cherono', action: 'Updated Geo-IP signatures and VPN CRL', outcome: 'Completed' }]));
  insertNet.run('SW-SCI-IDF2.campus.edu', 'Distribution Switch', '10.10.20.11', '00:1A:2B:3C:4D:11', '255.255.255.0', 'VLAN 20 (Labs)', 'Science IDF Closet B', 2, 'Cisco', 'Catalyst 9200L-48P', 'Degraded', '-3 minutes', 'Elevated CRC errors on uplink Te1/0/2 causing intermittent drops in CS Lab 2.', JSON.stringify([{ date: '2026-11-13', technician: 'Faith Cherono', action: 'Inspected fiber Rx optical power (-14.2 dBm, borderline)', outcome: 'Scheduled SFP transceiver swap' }, { date: '2026-11-14', technician: 'Faith Cherono', action: 'Moved Lab 2 VLAN trunk to backup port Te1/0/1 temporarily', outcome: 'Reduced packet loss from 18% to 2%' }]));
  insertNet.run('SW-LIB-FL2.campus.edu', 'Access Switch', '10.10.30.14', '00:1A:2B:3C:4D:14', '255.255.255.0', 'VLAN 30 (Library)', 'Library Telecom Closet 2', 5, 'Aruba', '2930F 48G PoE+', 'Online', '-8 minutes', 'PoE budget at 42% (155W / 370W).', JSON.stringify([{ date: '2026-11-02', technician: 'Faith Cherono', action: 'Firmware patched to WC.16.11', outcome: 'Healthy' }]));
  insertNet.run('AP-MED-HALL-03.campus.edu', 'Wireless AP', '10.10.40.23', '00:1A:2B:3C:4D:23', '255.255.255.0', 'VLAN 40 (Student Wi-Fi)', 'Medical Complex, Lab 3 Ceiling', 3, 'Ubiquiti', 'UniFi U6-Enterprise', 'Offline', '-12 minutes', 'Unreachable from controller; PoE injector or cable run suspect.', JSON.stringify([{ date: '2026-11-15', technician: 'Faith Cherono', action: 'Ping sweep failed; checking PoE switch port 18 status', outcome: 'Pending physical cable test' }]));
  insertNet.run('SW-ADM-FL1.campus.edu', 'Access Switch', '10.10.50.10', '00:1A:2B:3C:4D:50', '255.255.255.0', 'VLAN 50 (Finance)', 'Admin Building, MDF Closet', 4, 'Cisco', 'Catalyst 2960X', 'Online', '-6 minutes', 'Nominal throughput; 802.1X NAC enforced.', JSON.stringify([]));

  const insertNotif = db.prepare(`
    INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);
  insertNotif.run(1, 'Equipment Maintenance Alert', 'APC Smart-UPS 3000VA (ICT-UPS-8001) battery replacement is due.', 'warning', 'asset', 14, 0, '-2 hours');
  insertNotif.run(1, 'Damaged Equipment Reported', 'Lecture Theatre A Projector (ICT-PRJ-7001) marked as Damaged.', 'alert', 'asset', 12, 0, '-1 days');
  insertNotif.run(2, 'New Ticket Assigned: ICT-2026-0002', 'CS Lab 2 Workstation #02 boot failure assigned to you.', 'info', 'ticket', 2, 0, '-3 days');
  insertNotif.run(3, 'Critical Network Ticket: ICT-2026-0003', 'Science Wing Floor 2 packet loss requires urgent SFP check.', 'alert', 'ticket', 3, 0, '-3 days');
  insertNotif.run(5, 'Ticket Update: ICT-2026-0001', 'Technician Brian Mutua updated status to In Progress.', 'info', 'ticket', 1, 0, '-4 days');
  insertNotif.run(6, 'Ticket Resolved: ICT-2026-0004', 'Library Koha TLS certificate issue has been marked Resolved.', 'success', 'ticket', 4, 1, '-8 days');
  insertNotif.run(7, 'Ticket Assigned: ICT-2026-0002', 'Kelvin Otieno has been assigned to investigate your CS Lab PC issue.', 'info', 'ticket', 2, 0, '-3 days');

  const insertDelivery = db.prepare(`
    INSERT INTO notification_deliveries (notification_id, user_id, channel, recipient, provider, subject, body, status, error_message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);
  insertDelivery.run(1, 1, 'email', 'admin@ictportal.edu', 'sendgrid', 'Equipment Maintenance Alert', 'APC Smart-UPS 3000VA (ICT-UPS-8001) battery replacement is due.', 'logged', 'Queued locally (SENDGRID_API_KEY not set in environment)', '-2 hours');
  insertDelivery.run(1, 1, 'sms', '+254712400101', 'twilio', 'Equipment Maintenance Alert', '[ICT Helpdesk] Equipment Maintenance Alert: APC Smart-UPS 3000VA battery replacement is due.', 'logged', 'Queued locally (Twilio SMS credentials not set in environment)', '-2 hours');
  insertDelivery.run(5, 5, 'email', 'staff.grace@ictportal.edu', 'sendgrid', 'Ticket Update: ICT-2026-0001', 'Technician Brian Mutua updated status to In Progress.', 'logged', 'Queued locally (SENDGRID_API_KEY not set in environment)', '-4 days');
  insertDelivery.run(5, 5, 'sms', '+254720882112', 'twilio', 'Ticket Update: ICT-2026-0001', '[ICT Helpdesk] Ticket Update: ICT-2026-0001 is In Progress.', 'logged', 'Queued locally (Twilio SMS credentials not set in environment)', '-4 days');

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);
  insertAudit.run(1, 'SYSTEM_SEED', 'system', null, 'Initialized institutional ICT Help Desk & Asset Management schema and baseline records.', '127.0.0.1', '-30 days');
  insertAudit.run(1, 'ASSET_REGISTERED', 'asset', 14, 'Registered Data Center Smart-UPS 3000VA (ICT-UPS-8001).', '10.10.1.5', '-10 days');
  insertAudit.run(3, 'NETWORK_TROUBLESHOOT', 'network_device', 3, 'Logged optical Rx power diagnostic on SW-SCI-IDF2.campus.edu.', '10.10.1.22', '-2 days');
  insertAudit.run(4, 'TICKET_UPDATED', 'support_ticket', 1, 'Moved ICT-2026-0001 to In Progress and ordered fuser kit.', '10.10.1.31', '-2 days');
  insertAudit.run(2, 'TICKET_RESOLVED', 'support_ticket', 4, 'Resolved Library Koha TLS certificate error (ICT-2026-0004).', '10.10.1.18', '-8 days');
  insertAudit.run(1, 'MAINTENANCE_SCHEDULED', 'maintenance_record', 3, 'Scheduled preventive UPS battery calibration for 2026-11-20.', '10.10.1.5', '-1 days');
}
