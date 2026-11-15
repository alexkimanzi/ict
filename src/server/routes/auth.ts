import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db.ts';
import { requireAuth, signToken, type AuthenticatedRequest } from '../middleware/auth.ts';
import { getClientIp, logAudit } from '../utils/audit.ts';

const router = Router();

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  password: z.string().min(6).max(100),
  accountType: z.enum(['Staff Member', 'Student']).default('Student'),
  departmentId: z.number().int().positive().nullable().optional(),
  phone: z.string().trim().max(40).optional(),
  staffStudentId: z.string().trim().max(60).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

router.get('/departments', (_req, res) => {
  try {
    const departments = db.prepare('SELECT id, name, code, building FROM departments ORDER BY name ASC').all();
    res.json({ departments });
  } catch (err) {
    console.error('Fetch public departments failed:', err);
    res.status(500).json({ error: 'Unable to load departments.' });
  }
});

router.post('/register', (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration data.' });
      return;
    }

    const { fullName, email, password, accountType, departmentId, phone, staffStudentId } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    if (staffStudentId) {
      const existingId = db.prepare('SELECT id FROM users WHERE staff_student_id = ?').get(staffStudentId);
      if (existingId) {
        res.status(409).json({ error: 'That Staff/Student ID is already registered.' });
        return;
      }
    }

    const role = db.prepare('SELECT id, name FROM roles WHERE name = ?').get(accountType) as { id: number; name: string } | undefined;
    if (!role) {
      res.status(400).json({ error: 'Invalid account type.' });
      return;
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO users (full_name, email, password_hash, role_id, department_id, phone, staff_student_id, is_active, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
    `).run(
      fullName,
      normalizedEmail,
      passwordHash,
      role.id,
      departmentId ?? null,
      phone || null,
      staffStudentId || null
    );

    const userId = Number(result.lastInsertRowid);
    const user = db.prepare(`
      SELECT u.id, u.full_name, u.email, u.phone, u.staff_student_id, u.is_active,
             u.role_id, r.name AS role_name, u.department_id, d.name AS department_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `).get(userId) as Record<string, unknown>;

    const token = signToken({
      id: userId,
      email: normalizedEmail,
      fullName,
      role: role.name,
      roleId: role.id,
      departmentId: departmentId ?? null,
    });

    logAudit({
      userId,
      action: 'USER_REGISTERED',
      entityType: 'user',
      entityId: userId,
      details: `Self-registered ${role.name} account (${normalizedEmail}).`,
      ipAddress: getClientIp(req),
    });

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

router.post('/login', (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Please provide a valid email and password.' });
      return;
    }

    const normalizedEmail = parsed.data.email.toLowerCase();
    const userRow = db.prepare(`
      SELECT u.id, u.full_name, u.email, u.password_hash, u.phone, u.staff_student_id, u.is_active,
             u.role_id, r.name AS role_name, u.department_id, d.name AS department_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE LOWER(u.email) = ?
    `).get(normalizedEmail) as {
      id: number;
      full_name: string;
      email: string;
      password_hash: string;
      phone: string | null;
      staff_student_id: string | null;
      is_active: number;
      role_id: number;
      role_name: string;
      department_id: number | null;
      department_name: string | null;
    } | undefined;

    if (!userRow || !bcrypt.compareSync(parsed.data.password, userRow.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (!userRow.is_active) {
      res.status(403).json({ error: 'Account is deactivated. Contact the ICT Administrator.' });
      return;
    }

    db.prepare("UPDATE users SET last_login_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(userRow.id);

    const token = signToken({
      id: userRow.id,
      email: userRow.email,
      fullName: userRow.full_name,
      role: userRow.role_name,
      roleId: userRow.role_id,
      departmentId: userRow.department_id,
    });

    logAudit({
      userId: userRow.id,
      action: 'USER_LOGIN',
      entityType: 'user',
      entityId: userRow.id,
      details: `${userRow.full_name} (${userRow.role_name}) signed in.`,
      ipAddress: getClientIp(req),
    });

    res.json({
      token,
      user: {
        id: userRow.id,
        full_name: userRow.full_name,
        email: userRow.email,
        phone: userRow.phone,
        staff_student_id: userRow.staff_student_id,
        is_active: userRow.is_active,
        role_id: userRow.role_id,
        role_name: userRow.role_name,
        department_id: userRow.department_id,
        department_name: userRow.department_name,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Unable to sign in right now.' });
  }
});

router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const user = db.prepare(`
      SELECT u.id, u.full_name, u.email, u.phone, u.staff_student_id, u.is_active,
             COALESCE(u.email_notifications, 1) AS email_notifications,
             COALESCE(u.sms_notifications, 1) AS sms_notifications,
             u.role_id, r.name AS role_name, u.department_id, d.name AS department_name, u.last_login_at
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `).get(req.user!.id);

    res.json({ user });
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ error: 'Failed to load profile.' });
  }
});

router.patch('/preferences', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const schema = z.object({
      phone: z.string().trim().max(40).optional().nullable(),
      emailNotifications: z.boolean(),
      smsNotifications: z.boolean(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid notification preferences.' });
      return;
    }

    db.prepare(`
      UPDATE users
      SET phone = ?, email_notifications = ?, sms_notifications = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      parsed.data.phone || null,
      parsed.data.emailNotifications ? 1 : 0,
      parsed.data.smsNotifications ? 1 : 0,
      req.user!.id
    );

    logAudit({
      userId: req.user!.id,
      action: 'PREFERENCES_UPDATED',
      entityType: 'user',
      entityId: req.user!.id,
      details: `Updated Email (${parsed.data.emailNotifications ? 'ON' : 'OFF'}) and SMS (${parsed.data.smsNotifications ? 'ON' : 'OFF'}) preferences.`,
      ipAddress: getClientIp(req),
    });

    const user = db.prepare(`
      SELECT u.id, u.full_name, u.email, u.phone, u.staff_student_id, u.is_active,
             COALESCE(u.email_notifications, 1) AS email_notifications,
             COALESCE(u.sms_notifications, 1) AS sms_notifications,
             u.role_id, r.name AS role_name, u.department_id, d.name AS department_name, u.last_login_at
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `).get(req.user!.id);

    res.json({ user });
  } catch (err) {
    console.error('Update preferences error:', err);
    res.status(500).json({ error: 'Failed to update notification preferences.' });
  }
});

router.post('/logout', requireAuth, (req: AuthenticatedRequest, res) => {
  logAudit({
    userId: req.user!.id,
    action: 'USER_LOGOUT',
    entityType: 'user',
    entityId: req.user!.id,
    details: `${req.user!.fullName} signed out.`,
    ipAddress: getClientIp(req),
  });
  res.json({ success: true });
});

export default router;
