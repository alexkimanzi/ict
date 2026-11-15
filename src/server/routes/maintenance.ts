import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.ts';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.ts';
import { getClientIp, logAudit, notifyRoles } from '../utils/audit.ts';

const router = Router();

const createMaintenanceSchema = z.object({
  assetId: z.number().int().positive(),
  technicianId: z.number().int().positive().nullable().optional(),
  maintenanceType: z.enum(['Preventive', 'Corrective Repair', 'Hardware Upgrade', 'Inspection']),
  issueSummary: z.string().trim().min(4).max(1000),
  workPerformed: z.string().trim().max(2000).optional(),
  partsReplaced: z.string().trim().max(500).optional(),
  cost: z.number().min(0).default(0),
  scheduledDate: z.string().trim().min(4).max(30),
  nextMaintenanceDate: z.string().trim().max(30).optional(),
  status: z.enum(['Scheduled', 'In Progress', 'Completed', 'Cancelled']).default('Scheduled'),
});

const updateMaintenanceSchema = z.object({
  technicianId: z.number().int().positive().nullable().optional(),
  workPerformed: z.string().trim().max(2000).optional(),
  partsReplaced: z.string().trim().max(500).optional(),
  cost: z.number().min(0).optional(),
  completedDate: z.string().trim().max(30).nullable().optional(),
  nextMaintenanceDate: z.string().trim().max(30).nullable().optional(),
  status: z.enum(['Scheduled', 'In Progress', 'Completed', 'Cancelled']),
  assetConditionAfter: z.enum(['Excellent', 'Good', 'Fair', 'Needs Maintenance', 'Damaged', 'Retired']).optional(),
});

router.get('/', requireAuth, requireRole('Administrator', 'ICT Technician'), (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const type = typeof req.query.type === 'string' ? req.query.type.trim() : '';

    let sql = `
      SELECT m.*,
             a.asset_tag, a.name AS asset_name, a.condition AS asset_condition, a.location AS asset_location,
             u.full_name AS technician_name
      FROM maintenance_records m
      JOIN assets a ON m.asset_id = a.id
      LEFT JOIN technicians t ON m.technician_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (status) {
      sql += ' AND m.status = ?';
      params.push(status);
    }
    if (type) {
      sql += ' AND m.maintenance_type = ?';
      params.push(type);
    }

    sql += ' ORDER BY m.scheduled_date DESC, m.id DESC';
    const records = db.prepare(sql).all(...params);
    res.json({ records });
  } catch (err) {
    console.error('List maintenance error:', err);
    res.status(500).json({ error: 'Failed to load maintenance records.' });
  }
});

router.post('/', requireAuth, requireRole('Administrator', 'ICT Technician'), (req: AuthenticatedRequest, res) => {
  try {
    const parsed = createMaintenanceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid maintenance record payload.' });
      return;
    }

    const d = parsed.data;
    const asset = db.prepare('SELECT id, asset_tag, name FROM assets WHERE id = ?').get(d.assetId) as { id: number; asset_tag: string; name: string } | undefined;
    if (!asset) {
      res.status(404).json({ error: 'Referenced asset not found.' });
      return;
    }

    const completedDate = d.status === 'Completed' ? new Date().toISOString().slice(0, 10) : null;
    const result = db.prepare(`
      INSERT INTO maintenance_records (
        asset_id, technician_id, maintenance_type, issue_summary, work_performed,
        parts_replaced, cost, scheduled_date, completed_date, next_maintenance_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      d.assetId, d.technicianId ?? null, d.maintenanceType, d.issueSummary,
      d.workPerformed || null, d.partsReplaced || null, d.cost,
      d.scheduledDate, completedDate, d.nextMaintenanceDate || null, d.status
    );

    if (d.status === 'In Progress') {
      db.prepare("UPDATE assets SET status = 'Under Maintenance', updated_at = datetime('now') WHERE id = ?").run(d.assetId);
    }

    const recordId = Number(result.lastInsertRowid);

    notifyRoles(['Administrator'], {
      title: `Maintenance ${d.status}: ${asset.asset_tag}`,
      message: `${d.maintenanceType} scheduled for ${asset.name} on ${d.scheduledDate}.`,
      type: 'warning',
      referenceType: 'maintenance',
      referenceId: recordId,
    });

    logAudit({
      userId: req.user!.id,
      action: 'MAINTENANCE_CREATED',
      entityType: 'maintenance_record',
      entityId: recordId,
      details: `Logged ${d.maintenanceType} for ${asset.asset_tag} (${d.status}).`,
      ipAddress: getClientIp(req),
    });

    const created = db.prepare(`
      SELECT m.*, a.asset_tag, a.name AS asset_name, a.condition AS asset_condition, u.full_name AS technician_name
      FROM maintenance_records m
      JOIN assets a ON m.asset_id = a.id
      LEFT JOIN technicians t ON m.technician_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE m.id = ?
    `).get(recordId);

    res.status(201).json({ record: created });
  } catch (err) {
    console.error('Create maintenance error:', err);
    res.status(500).json({ error: 'Failed to create maintenance record.' });
  }
});

router.patch('/:id', requireAuth, requireRole('Administrator', 'ICT Technician'), (req: AuthenticatedRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid maintenance record ID.' });
      return;
    }

    const parsed = updateMaintenanceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid maintenance update.' });
      return;
    }

    const existing = db.prepare('SELECT * FROM maintenance_records WHERE id = ?').get(id) as {
      id: number;
      asset_id: number;
      technician_id: number | null;
      work_performed: string | null;
      parts_replaced: string | null;
      cost: number;
      completed_date: string | null;
      next_maintenance_date: string | null;
    } | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Maintenance record not found.' });
      return;
    }

    const d = parsed.data;
    const completedDate = d.completedDate !== undefined
      ? d.completedDate
      : (d.status === 'Completed' ? new Date().toISOString().slice(0, 10) : existing.completed_date);

    db.prepare(`
      UPDATE maintenance_records
      SET technician_id = ?,
          work_performed = ?,
          parts_replaced = ?,
          cost = ?,
          completed_date = ?,
          next_maintenance_date = ?,
          status = ?
      WHERE id = ?
    `).run(
      d.technicianId !== undefined ? d.technicianId : existing.technician_id,
      d.workPerformed !== undefined ? d.workPerformed : existing.work_performed,
      d.partsReplaced !== undefined ? d.partsReplaced : existing.parts_replaced,
      d.cost !== undefined ? d.cost : existing.cost,
      completedDate,
      d.nextMaintenanceDate !== undefined ? d.nextMaintenanceDate : existing.next_maintenance_date,
      d.status,
      id
    );

    if (d.status === 'Completed') {
      const nextCondition = d.assetConditionAfter || 'Good';
      db.prepare("UPDATE assets SET status = 'Operational', condition = ?, updated_at = datetime('now') WHERE id = ?").run(nextCondition, existing.asset_id);
    } else if (d.status === 'In Progress') {
      db.prepare("UPDATE assets SET status = 'Under Maintenance', updated_at = datetime('now') WHERE id = ?").run(existing.asset_id);
    }

    logAudit({
      userId: req.user!.id,
      action: 'MAINTENANCE_UPDATED',
      entityType: 'maintenance_record',
      entityId: id,
      details: `Updated maintenance record #${id} status to ${d.status}.`,
      ipAddress: getClientIp(req),
    });

    const updated = db.prepare(`
      SELECT m.*, a.asset_tag, a.name AS asset_name, a.condition AS asset_condition, u.full_name AS technician_name
      FROM maintenance_records m
      JOIN assets a ON m.asset_id = a.id
      LEFT JOIN technicians t ON m.technician_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE m.id = ?
    `).get(id);

    res.json({ record: updated });
  } catch (err) {
    console.error('Update maintenance error:', err);
    res.status(500).json({ error: 'Failed to update maintenance record.' });
  }
});

export default router;
