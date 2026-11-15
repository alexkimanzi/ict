import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'ict-helpdesk-enterprise-jwt-secret-key-2026';

export interface AuthUserPayload {
  id: number;
  email: string;
  fullName: string;
  role: string;
  roleId: number;
  departmentId: number | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}

export function signToken(payload: AuthUserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  const token = authHeader.slice(7).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUserPayload;
    const dbUser = db.prepare(`
      SELECT u.id, u.email, u.full_name, u.is_active, u.role_id, u.department_id, r.name AS role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `).get(decoded.id) as {
      id: number;
      email: string;
      full_name: string;
      is_active: number;
      role_id: number;
      department_id: number | null;
      role_name: string;
    } | undefined;

    if (!dbUser) {
      res.status(401).json({ error: 'Account no longer exists.' });
      return;
    }
    if (!dbUser.is_active) {
      res.status(403).json({ error: 'Your account has been deactivated. Contact ICT Administration.' });
      return;
    }

    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      fullName: dbUser.full_name,
      role: dbUser.role_name,
      roleId: dbUser.role_id,
      departmentId: dbUser.department_id,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: `Access denied. Required role: ${allowedRoles.join(' or ')}.` });
      return;
    }
    next();
  };
}
