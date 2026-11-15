import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.ts';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.ts';
import { getClientIp, logAudit, notifyRoles } from '../utils/audit.ts';

const router = Router();

const ipv4Regex = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

const networkDeviceSchema = z.object({
  hostname: z.string().trim().min(3).max(120),
  deviceType: z.enum(['Core Router', 'Distribution Switch', 'Access Switch', 'Wireless AP', 'Firewall', 'Gateway', 'Server NIC']),
  ipAddress: z.string().trim().regex(ipv4Regex, 'Must be a valid IPv4 address.'),
  macAddress: z.string().trim().min(11).max(32),
  subnetMask: z.string().trim().regex(ipv4Regex, 'Must be a valid IPv4 subnet mask.').default('255.255.255.0'),
  vlan: z.string().trim().max(40).optional(),
  location: z.string().trim().min(2).max(150),
  departmentId: z.number().int().positive().nullable().optional(),
  manufacturer: z.string().trim().min(1).max(100),
  model: z.string().trim().max(100).optional(),
  status: z.enum(['Online', 'Degraded', 'Offline', 'Maintenance']).default('Online'),
  issueNotes: z.string().trim().max(1000).optional(),
});

const troubleshootSchema = z.object({
  action: z.string().trim().min(3).max(500),
  outcome: z.string().trim().min(2).max(500),
  newStatus: z.enum(['Online', 'Degraded', 'Offline', 'Maintenance']).optional(),
});

router.get('/', requireAuth, requireRole('Administrator', 'ICT Technician'), (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';

    let sql = `
      SELECT nd.*, d.name AS department_name
      FROM network_devices nd
      LEFT JOIN departments d ON nd.department_id = d.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (search) {
      sql += ` AND (LOWER(nd.hostname) LIKE ? OR LOWER(nd.ip_address) LIKE ? OR LOWER(nd.location) LIKE ? OR LOWER(nd.manufacturer) LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) {
      sql += ' AND nd.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY CASE nd.status WHEN \'Offline\' THEN 1 WHEN \'Degraded\' THEN 2 WHEN \'Maintenance\' THEN 3 ELSE 4 END, nd.hostname ASC';
    const devices = db.prepare(sql).all(...params);
    res.json({ devices });
  } catch (err) {
    console.error('List network devices error:', err);
    res.status(500).json({ error: 'Failed to load network devices.' });
  }
});

router.post('/', requireAuth, requireRole('Administrator', 'ICT Technician'), (req: AuthenticatedRequest, res) => {
  try {
    const parsed = networkDeviceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid network device input.' });
      return;
    }

    const d = parsed.data;
    const dup = db.prepare('SELECT id FROM network_devices WHERE hostname = ? OR mac_address = ?').get(d.hostname, d.macAddress);
    if (dup) {
      res.status(409).json({ error: 'Hostname or MAC address is already registered.' });
      return;
    }

    const result = db.prepare(`
      INSERT INTO network_devices (
        hostname, device_type, ip_address, mac_address, subnet_mask, vlan,
        location, department_id, manufacturer, model, status, issue_notes, troubleshooting_history
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]')
    `).run(
      d.hostname, d.deviceType, d.ipAddress, d.macAddress, d.subnetMask, d.vlan || null,
      d.location, d.departmentId ?? null, d.manufacturer, d.model || null, d.status, d.issueNotes || null
    );

    const id = Number(result.lastInsertRowid);

    if (d.status === 'Offline' || d.status === 'Degraded') {
      notifyRoles(['Administrator', 'ICT Technician'], {
        title: `Network Alert: ${d.hostname}`,
        message: `Device at ${d.ipAddress} (${d.location}) registered as ${d.status}.`,
        type: 'alert',
        referenceType: 'network',
        referenceId: id,
      });
    }

    logAudit({
      userId: req.user!.id,
      action: 'NETWORK_DEVICE_ADDED',
      entityType: 'network_device',
      entityId: id,
      details: `Registered ${d.deviceType} ${d.hostname} (${d.ipAddress}) at ${d.location}.`,
      ipAddress: getClientIp(req),
    });

    const created = db.prepare(`
      SELECT nd.*, d.name AS department_name
      FROM network_devices nd
      LEFT JOIN departments d ON nd.department_id = d.id
      WHERE nd.id = ?
    `).get(id);

    res.status(201).json({ device: created });
  } catch (err) {
    console.error('Create network device error:', err);
    res.status(500).json({ error: 'Failed to register network device.' });
  }
});

router.put('/:id', requireAuth, requireRole('Administrator', 'ICT Technician'), (req: AuthenticatedRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid device ID.' });
      return;
    }

    const parsed = networkDeviceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid network device input.' });
      return;
    }

    const d = parsed.data;
    const dup = db.prepare('SELECT id FROM network_devices WHERE (hostname = ? OR mac_address = ?) AND id != ?').get(d.hostname, d.macAddress, id);
    if (dup) {
      res.status(409).json({ error: 'Hostname or MAC address belongs to another device.' });
      return;
    }

    db.prepare(`
      UPDATE network_devices
      SET hostname = ?, device_type = ?, ip_address = ?, mac_address = ?, subnet_mask = ?,
          vlan = ?, location = ?, department_id = ?, manufacturer = ?, model = ?,
          status = ?, issue_notes = ?, last_checked_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(
      d.hostname, d.deviceType, d.ipAddress, d.macAddress, d.subnetMask,
      d.vlan || null, d.location, d.departmentId ?? null, d.manufacturer, d.model || null,
      d.status, d.issueNotes || null, id
    );

    logAudit({
      userId: req.user!.id,
      action: 'NETWORK_DEVICE_UPDATED',
      entityType: 'network_device',
      entityId: id,
      details: `Updated network device ${d.hostname} (${d.ipAddress}) — status: ${d.status}.`,
      ipAddress: getClientIp(req),
    });

    const updated = db.prepare(`
      SELECT nd.*, d.name AS department_name
      FROM network_devices nd
      LEFT JOIN departments d ON nd.department_id = d.id
      WHERE nd.id = ?
    `).get(id);

    res.json({ device: updated });
  } catch (err) {
    console.error('Update network device error:', err);
    res.status(500).json({ error: 'Failed to update network device.' });
  }
});

router.post('/:id/troubleshoot', requireAuth, requireRole('Administrator', 'ICT Technician'), (req: AuthenticatedRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid device ID.' });
      return;
    }

    const parsed = troubleshootSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Action and outcome are required.' });
      return;
    }

    const device = db.prepare('SELECT * FROM network_devices WHERE id = ?').get(id) as {
      id: number;
      hostname: string;
      status: string;
      troubleshooting_history: string;
    } | undefined;

    if (!device) {
      res.status(404).json({ error: 'Network device not found.' });
      return;
    }

    let history: Array<Record<string, string>> = [];
    try {
      history = JSON.parse(device.troubleshooting_history || '[]');
    } catch {
      history = [];
    }

    history.unshift({
      date: new Date().toISOString().slice(0, 10),
      technician: req.user!.fullName,
      action: parsed.data.action,
      outcome: parsed.data.outcome,
    });

    const nextStatus = parsed.data.newStatus || device.status;

    db.prepare(`
      UPDATE network_devices
      SET troubleshooting_history = ?,
          status = ?,
          last_checked_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(history), nextStatus, id);

    logAudit({
      userId: req.user!.id,
      action: 'NETWORK_TROUBLESHOOT',
      entityType: 'network_device',
      entityId: id,
      details: `Logged troubleshooting on ${device.hostname}: ${parsed.data.action} (${nextStatus}).`,
      ipAddress: getClientIp(req),
    });

    const updated = db.prepare(`
      SELECT nd.*, d.name AS department_name
      FROM network_devices nd
      LEFT JOIN departments d ON nd.department_id = d.id
      WHERE nd.id = ?
    `).get(id);

    res.json({ device: updated });
  } catch (err) {
    console.error('Network troubleshoot error:', err);
    res.status(500).json({ error: 'Failed to log troubleshooting entry.' });
  }
});

export default router;
