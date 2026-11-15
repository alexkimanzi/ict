import type { Request } from 'express';
import { db } from '../db.ts';
import { dispatchMultiChannelNotification } from './dispatcher.ts';

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

export function logAudit(params: {
  userId: number | null;
  action: string;
  entityType: string;
  entityId?: number | null;
  details: string;
  ipAddress?: string;
}): void {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      params.userId,
      params.action,
      params.entityType,
      params.entityId ?? null,
      params.details,
      params.ipAddress ?? '127.0.0.1'
    );
  } catch (err) {
    console.error('Audit log insert failed:', err);
  }
}

export function createNotification(params: {
  userId: number;
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'alert' | 'success';
  referenceType?: string;
  referenceId?: number;
}): void {
  try {
    const res = db.prepare(`
      INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      params.userId,
      params.title,
      params.message,
      params.type ?? 'info',
      params.referenceType ?? null,
      params.referenceId ?? null
    );

    const notificationId = Number(res.lastInsertRowid);
    void dispatchMultiChannelNotification({
      notificationId,
      userId: params.userId,
      title: params.title,
      message: params.message,
    });
  } catch (err) {
    console.error('Notification insert failed:', err);
  }
}

export function notifyRoles(
  roleNames: string[],
  payload: {
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'alert' | 'success';
    referenceType?: string;
    referenceId?: number;
    excludeUserId?: number;
  }
): void {
  try {
    const placeholders = roleNames.map(() => '?').join(', ');
    const recipients = db.prepare(`
      SELECT u.id
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = 1 AND r.name IN (${placeholders})
    `).all(...roleNames) as { id: number }[];

    for (const r of recipients) {
      if (payload.excludeUserId && r.id === payload.excludeUserId) continue;
      createNotification({
        userId: r.id,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        referenceType: payload.referenceType,
        referenceId: payload.referenceId,
      });
    }
  } catch (err) {
    console.error('Role notification failed:', err);
  }
}
