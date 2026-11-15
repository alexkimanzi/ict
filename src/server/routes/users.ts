import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db.ts';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.ts';
import { getClientIp, logAudit } from '../utils/audit.ts';

const router = Router();

const createUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  password: z.string().min(6).max(100),
  roleId: z.number().int().positive(),
  departmentId: z.number().int().positive().nullable().optional(),
  phone: z.string().trim().max(40).optional(),
  staffStudentId: z.string().trim().max(60).optional(),
  specialization: z.string().trim().max(120).optional(),
});

const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  roleId: z.number().int().positive(),
  departmentId: z.number().int().positive().nullable().optional(),
  phone: z.string().trim().max(40).optional(),
  staffStudentId: z.string().trim().max(60).optional(),
  newPassword: z.string().min(6).max(100).optional().or(z.literal('')),
});

router.get('/roles', requireAuth, (_req, res) => {
  const roles = db.prepare('SELECT id, name, description FROM roles ORDER BY id ASC').all();
  res.json({ roles });
});

router.get('/departments', requireAuth, (_req, res) => {
  const departments = db.prepare('SELECT id, name, code, building, head_name FROM departments ORDER BY name ASC').all();
  res.json({ departments });
});

router.get('/technicians', requireAuth, (_req, res) => {
  const technicians = db.prepare(`
    SELECT t.id, t.user_id, u.full_name, u.email, t.specialization, t.certification, t.availability_status,
           (SELECT COUNT(*) FROM support_tickets st WHERE st.assigned_technician_id = t.id AND st.status IN ('Assigned', 'In Progress')) AS active_tickets
    FROM technicians t
    JOIN users u ON t.user_id = u.id
    WHERE u.is_active = 1
    ORDER BY u.full_name ASC
  `).all();
  res.json({ technicians });
});

router.get('/', requireAuth, requireRole('Administrator', 'ICT Technician'), (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const roleFilter = typeof req.query.role === 'string' ? req.query.role.trim() : '';

    let sql = `
      SELECT u.id, u.full_name, u.email, u.phone, u.staff_student_id, u.is_active,
             u.role_id, r.name AS role_name, u.department_id, d.name AS department_name,
             u.last_login_at, u.created_at
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (search) {
      sql += ` AND (LOWER(u.full_name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(COALESCE(u.staff_student_id, '')) LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (roleFilter) {
      sql += ` AND r.name = ?`;
      params.push(roleFilter);
    }

    sql += ` ORDER BY u.created_at DESC`;
    const users = db.prepare(sql).all(...params);
    res.json({ users });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Failed to load users.' });
  }
});

router.post('/', requireAuth, requireRole('Administrator'), (req: AuthenticatedRequest, res) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid user data.' });
      return;
    }

    const { fullName, email, password, roleId, departmentId, phone, staffStudentId, specialization } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const dup = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(normalizedEmail);
    if (dup) {
      res.status(409).json({ error: 'A user with that email already exists.' });
      return;
    }

    const role = db.prepare('SELECT id, name FROM roles WHERE id = ?').get(roleId) as { id: number; name: string } | undefined;
    if (!role) {
      res.status(400).json({ error: 'Selected role does not exist.' });
      return;
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO users (full_name, email, password_hash, role_id, department_id, phone, staff_student_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(fullName, normalizedEmail, passwordHash, roleId, departmentId ?? null, phone || null, staffStudentId || null);

    const newUserId = Number(result.lastInsertRowid);

    if (role.name === 'ICT Technician') {
      db.prepare(`
        INSERT OR IGNORE INTO technicians (user_id, specialization, availability_status)
        VALUES (?, ?, 'Available')
      `).run(newUserId, specialization || 'General ICT Support');
    }

    logAudit({
      userId: req.user!.id,
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: newUserId,
      details: `Created user ${fullName} (${normalizedEmail}) with role ${role.name}.`,
      ipAddress: getClientIp(req),
    });

    const created = db.prepare(`
      SELECT u.id, u.full_name, u.email, u.phone, u.staff_student_id, u.is_active,
             u.role_id, r.name AS role_name, u.department_id, d.name AS department_name, u.created_at
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `).get(newUserId);

    res.status(201).json({ user: created });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

router.put('/:id', requireAuth, requireRole('Administrator'), (req: AuthenticatedRequest, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      res.status(400).json({ error: 'Invalid user ID.' });
      return;
    }

    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid user update payload.' });
      return;
    }

    const { fullName, email, roleId, departmentId, phone, staffStudentId, newPassword } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const dup = db.prepare('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?').get(normalizedEmail, userId);
    if (dup) {
      res.status(409).json({ error: 'Email is already in use by another user.' });
      return;
    }

    const role = db.prepare('SELECT id, name FROM roles WHERE id = ?').get(roleId) as { id: number; name: string } | undefined;
    if (!role) {
      res.status(400).json({ error: 'Invalid role selected.' });
      return;
    }

    if (newPassword && newPassword.length >= 6) {
      const hash = bcrypt.hashSync(newPassword, 10);
      db.prepare(`
        UPDATE users
        SET full_name = ?, email = ?, role_id = ?, department_id = ?, phone = ?, staff_student_id = ?, password_hash = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(fullName, normalizedEmail, roleId, departmentId ?? null, phone || null, staffStudentId || null, hash, userId);
    } else {
      db.prepare(`
        UPDATE users
        SET full_name = ?, email = ?, role_id = ?, department_id = ?, phone = ?, staff_student_id = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(fullName, normalizedEmail, roleId, departmentId ?? null, phone || null, staffStudentId || null, userId);
    }

    if (role.name === 'ICT Technician') {
      db.prepare(`
        INSERT OR IGNORE INTO technicians (user_id, specialization, availability_status)
        VALUES (?, 'General ICT Support', 'Available')
      `).run(userId);
    }

    logAudit({
      userId: req.user!.id,
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: userId,
      details: `Updated user ${fullName} (${normalizedEmail}) — role: ${role.name}.`,
      ipAddress: getClientIp(req),
    });

    const updated = db.prepare(`
      SELECT u.id, u.full_name, u.email, u.phone, u.staff_student_id, u.is_active,
             u.role_id, r.name AS role_name, u.department_id, d.name AS department_name, u.last_login_at, u.created_at
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `).get(userId);

    res.json({ user: updated });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

router.patch('/:id/status', requireAuth, requireRole('Administrator'), (req: AuthenticatedRequest, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      res.status(400).json({ error: 'Invalid user ID.' });
      return;
    }
    if (userId === req.user!.id) {
      res.status(400).json({ error: 'You cannot deactivate your own active administrator account.' });
      return;
    }

    const isActive = req.body.isActive ? 1 : 0;
    db.prepare("UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(isActive, userId);

    logAudit({
      userId: req.user!.id,
      action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityType: 'user',
      entityId: userId,
      details: `${isActive ? 'Activated' : 'Deactivated'} user account #${userId}.`,
      ipAddress: getClientIp(req),
    });

    res.json({ success: true, is_active: isActive });
  } catch (err) {
    console.error('Toggle user status error:', err);
    res.status(500).json({ error: 'Failed to update account status.' });
  }
});

export default router;
