import { Router } from 'express';
import { db } from '../db.ts';
import { requireAuth, requireRole } from '../middleware/auth.ts';

const router = Router();

router.get('/', requireAuth, requireRole('Administrator'), (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const entityType = typeof req.query.entityType === 'string' ? req.query.entityType.trim() : '';

    let sql = `
      SELECT al.*, u.full_name AS actor_name, u.email AS actor_email, r.name AS actor_role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (search) {
      sql += ` AND (LOWER(al.action) LIKE ? OR LOWER(al.details) LIKE ? OR LOWER(COALESCE(u.full_name, '')) LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (entityType) {
      sql += ' AND al.entity_type = ?';
      params.push(entityType);
    }

    sql += ' ORDER BY al.created_at DESC, al.id DESC LIMIT 200';
    const logs = db.prepare(sql).all(...params);
    res.json({ logs });
  } catch (err) {
    console.error('Fetch audit logs error:', err);
    res.status(500).json({ error: 'Failed to load audit logs.' });
  }
});

export default router;
