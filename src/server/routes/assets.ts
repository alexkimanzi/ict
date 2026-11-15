import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.ts';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.ts';
import { getClientIp, logAudit, notifyRoles } from '../utils/audit.ts';

const router = Router();

const assetSchema = z.object({
  assetTag: z.string().trim().min(3).max(60),
  assetIdentificationNumber: z.string().trim().max(120).optional(),
  serialNumber: z.string().trim().min(3).max(120),
  name: z.string().trim().min(2).max(160),
  categoryId: z.number().int().positive(),
  manufacturer: z.string().trim().min(1).max(100),
  model: z.string().trim().max(120).optional(),
  purchaseDate: z.string().trim().min(4).max(30),
  warrantyExpiry: z.string().trim().max(30).optional(),
  departmentId: z.number().int().positive().nullable().optional(),
  location: z.string().trim().min(2).max(150),
  condition: z.enum(['Excellent', 'Good', 'Fair', 'Needs Maintenance', 'Damaged', 'Retired']),
  status: z.enum(['Operational', 'In Repair', 'Under Maintenance', 'Decommissioned']).default('Operational'),
  assignedUserId: z.number().int().positive().nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
});

const quickScanSchema = z.object({
  assetIdentificationNumber: z.string().trim().min(2).max(120).optional(),
  assignedUserId: z.number().int().positive().nullable().optional(),
  status: z.enum(['Operational', 'In Repair', 'Under Maintenance', 'Decommissioned']).optional(),
  condition: z.enum(['Excellent', 'Good', 'Fair', 'Needs Maintenance', 'Damaged', 'Retired']).optional(),
  location: z.string().trim().min(2).max(150).optional(),
  departmentId: z.number().int().positive().nullable().optional(),
});

const ASSET_SELECT_SQL = `
  SELECT a.*,
         ac.name AS category_name, ac.code AS category_code,
         d.name AS department_name,
         u.full_name AS assigned_user_name,
         u.email AS assigned_user_email,
         u.phone AS assigned_user_phone,
         u.staff_student_id AS assigned_user_staff_id,
         ur.name AS assigned_user_role,
         ud.name AS assigned_user_department
  FROM assets a
  JOIN asset_categories ac ON a.category_id = ac.id
  LEFT JOIN departments d ON a.department_id = d.id
  LEFT JOIN users u ON a.assigned_user_id = u.id
  LEFT JOIN roles ur ON u.role_id = ur.id
  LEFT JOIN departments ud ON u.department_id = ud.id
`;

router.get('/categories', requireAuth, (_req, res) => {
  const categories = db.prepare('SELECT id, name, code, description FROM asset_categories ORDER BY name ASC').all();
  res.json({ categories });
});

router.get('/lookup/:code', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const rawCode = decodeURIComponent(req.params.code || '').trim();
    if (!rawCode) {
      res.status(400).json({ error: 'Scanned code is empty.' });
      return;
    }

    let lookupKey = rawCode;
    if (rawCode.startsWith('{')) {
      try {
        const parsed = JSON.parse(rawCode) as {
          asset_identification_number?: string;
          asset_tag?: string;
          serial_number?: string;
        };
        lookupKey = parsed.asset_identification_number || parsed.asset_tag || parsed.serial_number || rawCode;
      } catch {
        // Keep rawCode
      }
    }

    const asset = db.prepare(`
      ${ASSET_SELECT_SQL}
      WHERE LOWER(a.asset_identification_number) = LOWER(?)
         OR LOWER(a.asset_tag) = LOWER(?)
         OR LOWER(a.serial_number) = LOWER(?)
      LIMIT 1
    `).get(lookupKey, lookupKey, lookupKey);

    if (!asset) {
      res.status(404).json({ error: `No asset found matching scanned code "${lookupKey}".` });
      return;
    }

    logAudit({
      userId: req.user!.id,
      action: 'ASSET_SCANNED_LOOKUP',
      entityType: 'asset',
      entityId: Number((asset as { id: number }).id),
      details: `Looked up asset via barcode/QR scan (${lookupKey}).`,
      ipAddress: getClientIp(req),
    });

    res.json({ asset });
  } catch (err) {
    console.error('Asset scan lookup error:', err);
    res.status(500).json({ error: 'Failed to look up scanned asset.' });
  }
});

router.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const categoryId = typeof req.query.categoryId === 'string' && req.query.categoryId ? Number(req.query.categoryId) : null;
    const condition = typeof req.query.condition === 'string' ? req.query.condition.trim() : '';
    const mineOnly = req.query.mine === 'true' || req.user!.role === 'Student';

    let sql = `${ASSET_SELECT_SQL} WHERE 1=1`;
    const params: unknown[] = [];

    if (mineOnly && req.user!.role !== 'Administrator' && req.user!.role !== 'ICT Technician') {
      sql += ' AND (a.assigned_user_id = ? OR a.department_id = ?)';
      params.push(req.user!.id, req.user!.departmentId ?? -1);
    }

    if (search) {
      sql += ` AND (
        LOWER(a.asset_tag) LIKE ?
        OR LOWER(a.asset_identification_number) LIKE ?
        OR LOWER(a.serial_number) LIKE ?
        OR LOWER(a.name) LIKE ?
        OR LOWER(a.manufacturer) LIKE ?
        OR LOWER(a.location) LIKE ?
        OR LOWER(COALESCE(u.full_name, '')) LIKE ?
      )`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (categoryId) {
      sql += ' AND a.category_id = ?';
      params.push(categoryId);
    }
    if (condition) {
      sql += ' AND a.condition = ?';
      params.push(condition);
    }

    sql += ' ORDER BY a.created_at DESC';
    const assets = db.prepare(sql).all(...params);
    res.json({ assets });
  } catch (err) {
    console.error('List assets error:', err);
    res.status(500).json({ error: 'Failed to load ICT assets.' });
  }
});

router.post('/', requireAuth, requireRole('Administrator', 'ICT Technician'), (req: AuthenticatedRequest, res) => {
  try {
    const parsed = assetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid asset details.' });
      return;
    }

    const d = parsed.data;
    const identificationNumber = d.assetIdentificationNumber?.trim() || d.assetTag;

    const dup = db.prepare('SELECT id FROM assets WHERE asset_tag = ? OR asset_identification_number = ? OR serial_number = ?').get(
      d.assetTag,
      identificationNumber,
      d.serialNumber
    );
    if (dup) {
      res.status(409).json({ error: 'An asset with that Asset Tag, Identification Number, or Serial Number already exists.' });
      return;
    }

    const result = db.prepare(`
      INSERT INTO assets (
        asset_tag, asset_identification_number, serial_number, name, category_id, manufacturer, model,
        purchase_date, warranty_expiry, department_id, location, condition, status, assigned_user_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      d.assetTag, identificationNumber, d.serialNumber, d.name, d.categoryId, d.manufacturer, d.model || null,
      d.purchaseDate, d.warrantyExpiry || null, d.departmentId ?? null, d.location,
      d.condition, d.status, d.assignedUserId ?? null, d.notes || null
    );

    const assetId = Number(result.lastInsertRowid);

    if (d.condition === 'Damaged' || d.condition === 'Needs Maintenance') {
      notifyRoles(['Administrator'], {
        title: `Asset Requires Attention: ${d.assetTag}`,
        message: `${d.name} (${identificationNumber}) was registered with condition "${d.condition}".`,
        type: 'warning',
        referenceType: 'asset',
        referenceId: assetId,
      });
    }

    logAudit({
      userId: req.user!.id,
      action: 'ASSET_REGISTERED',
      entityType: 'asset',
      entityId: assetId,
      details: `Registered asset ${d.assetTag} (ID#: ${identificationNumber}, SN: ${d.serialNumber}).`,
      ipAddress: getClientIp(req),
    });

    const created = db.prepare(`${ASSET_SELECT_SQL} WHERE a.id = ?`).get(assetId);
    res.status(201).json({ asset: created });
  } catch (err) {
    console.error('Create asset error:', err);
    res.status(500).json({ error: 'Failed to register ICT asset.' });
  }
});

router.put('/:id', requireAuth, requireRole('Administrator', 'ICT Technician'), (req: AuthenticatedRequest, res) => {
  try {
    const assetId = Number(req.params.id);
    if (!Number.isInteger(assetId) || assetId <= 0) {
      res.status(400).json({ error: 'Invalid asset ID.' });
      return;
    }

    const parsed = assetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid asset update details.' });
      return;
    }

    const d = parsed.data;
    const identificationNumber = d.assetIdentificationNumber?.trim() || d.assetTag;

    const dup = db.prepare('SELECT id FROM assets WHERE (asset_tag = ? OR asset_identification_number = ? OR serial_number = ?) AND id != ?').get(
      d.assetTag,
      identificationNumber,
      d.serialNumber,
      assetId
    );
    if (dup) {
      res.status(409).json({ error: 'Another asset already uses that Asset Tag, Identification Number, or Serial Number.' });
      return;
    }

    db.prepare(`
      UPDATE assets
      SET asset_tag = ?, asset_identification_number = ?, serial_number = ?, name = ?, category_id = ?, manufacturer = ?, model = ?,
          purchase_date = ?, warranty_expiry = ?, department_id = ?, location = ?,
          condition = ?, status = ?, assigned_user_id = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      d.assetTag, identificationNumber, d.serialNumber, d.name, d.categoryId, d.manufacturer, d.model || null,
      d.purchaseDate, d.warrantyExpiry || null, d.departmentId ?? null, d.location,
      d.condition, d.status, d.assignedUserId ?? null, d.notes || null, assetId
    );

    if (d.condition === 'Damaged' || d.condition === 'Needs Maintenance') {
      notifyRoles(['Administrator'], {
        title: `Maintenance Alert: ${d.assetTag}`,
        message: `${d.name} condition updated to "${d.condition}".`,
        type: 'warning',
        referenceType: 'asset',
        referenceId: assetId,
      });
    }

    logAudit({
      userId: req.user!.id,
      action: 'ASSET_UPDATED',
      entityType: 'asset',
      entityId: assetId,
      details: `Updated asset ${d.assetTag} (ID#: ${identificationNumber}, Condition: ${d.condition}, Status: ${d.status}).`,
      ipAddress: getClientIp(req),
    });

    const updated = db.prepare(`${ASSET_SELECT_SQL} WHERE a.id = ?`).get(assetId);
    res.json({ asset: updated });
  } catch (err) {
    console.error('Update asset error:', err);
    res.status(500).json({ error: 'Failed to update ICT asset.' });
  }
});

router.patch('/:id/quick-scan', requireAuth, requireRole('Administrator', 'ICT Technician'), (req: AuthenticatedRequest, res) => {
  try {
    const assetId = Number(req.params.id);
    if (!Number.isInteger(assetId) || assetId <= 0) {
      res.status(400).json({ error: 'Invalid asset ID.' });
      return;
    }

    const parsed = quickScanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid quick-scan update data.' });
      return;
    }

    const existing = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId) as {
      id: number;
      asset_tag: string;
      asset_identification_number: string;
      name: string;
      assigned_user_id: number | null;
      status: string;
      condition: string;
      location: string;
      department_id: number | null;
    } | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Asset not found.' });
      return;
    }

    const d = parsed.data;
    const nextIdentification = d.assetIdentificationNumber || existing.asset_identification_number;
    const nextAssignedUserId = d.assignedUserId !== undefined ? d.assignedUserId : existing.assigned_user_id;
    const nextStatus = d.status ?? existing.status;
    const nextCondition = d.condition ?? existing.condition;
    const nextLocation = d.location ?? existing.location;
    const nextDepartmentId = d.departmentId !== undefined ? d.departmentId : existing.department_id;

    db.prepare(`
      UPDATE assets
      SET asset_identification_number = ?,
          assigned_user_id = ?,
          status = ?,
          condition = ?,
          location = ?,
          department_id = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(nextIdentification, nextAssignedUserId, nextStatus, nextCondition, nextLocation, nextDepartmentId, assetId);

    if (nextCondition === 'Damaged' || nextCondition === 'Needs Maintenance') {
      notifyRoles(['Administrator'], {
        title: `Scanned Asset Flagged: ${existing.asset_tag}`,
        message: `${existing.name} scanned at ${nextLocation} and marked "${nextCondition}".`,
        type: 'warning',
        referenceType: 'asset',
        referenceId: assetId,
      });
    }

    logAudit({
      userId: req.user!.id,
      action: 'ASSET_SCAN_UPDATED',
      entityType: 'asset',
      entityId: assetId,
      details: `Scan-updated ${existing.asset_tag} (ID#: ${nextIdentification}) → status=${nextStatus}, location="${nextLocation}", assignedUserId=${nextAssignedUserId ?? 'none'}.`,
      ipAddress: getClientIp(req),
    });

    const updated = db.prepare(`${ASSET_SELECT_SQL} WHERE a.id = ?`).get(assetId);
    res.json({ asset: updated });
  } catch (err) {
    console.error('Quick scan update error:', err);
    res.status(500).json({ error: 'Failed to update asset from scan.' });
  }
});

router.delete('/:id', requireAuth, requireRole('Administrator'), (req: AuthenticatedRequest, res) => {
  try {
    const assetId = Number(req.params.id);
    if (!Number.isInteger(assetId) || assetId <= 0) {
      res.status(400).json({ error: 'Invalid asset ID.' });
      return;
    }

    const existing = db.prepare('SELECT asset_tag, name FROM assets WHERE id = ?').get(assetId) as { asset_tag: string; name: string } | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Asset not found.' });
      return;
    }

    db.prepare('DELETE FROM assets WHERE id = ?').run(assetId);

    logAudit({
      userId: req.user!.id,
      action: 'ASSET_DELETED',
      entityType: 'asset',
      entityId: assetId,
      details: `Removed asset ${existing.asset_tag} (${existing.name}).`,
      ipAddress: getClientIp(req),
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Delete asset error:', err);
    res.status(500).json({ error: 'Failed to delete asset.' });
  }
});

export default router;
