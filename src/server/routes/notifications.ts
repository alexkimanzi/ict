import { Router } from 'express';
import { db } from '../db.ts';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.ts';
import { createNotification, notifyRoles } from '../utils/audit.ts';

const router = Router();

router.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const notifications = db.prepare(`
      SELECT *
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 40
    `).all(req.user!.id);

    const unreadRow = db.prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user!.id) as { count: number };
    res.json({ notifications, unreadCount: unreadRow.count });
  } catch (err) {
    console.error('Fetch notifications error:', err);
    res.status(500).json({ error: 'Failed to load notifications.' });
  }
});

router.get('/deliveries', requireAuth, requireRole('Administrator', 'ICT Technician'), (_req, res) => {
  try {
    const deliveries = db.prepare(`
      SELECT nd.*, u.full_name AS user_name
      FROM notification_deliveries nd
      JOIN users u ON nd.user_id = u.id
      ORDER BY nd.created_at DESC, nd.id DESC
      LIMIT 100
    `).all();
    res.json({ deliveries });
  } catch (err) {
    console.error('Fetch notification deliveries error:', err);
    res.status(500).json({ error: 'Failed to load email and SMS delivery logs.' });
  }
});

router.post('/dispatch-maintenance-reminders', requireAuth, requireRole('Administrator', 'ICT Technician'), (_req, res) => {
  try {
    const upcoming = db.prepare(`
      SELECT m.id, m.maintenance_type, m.issue_summary, m.scheduled_date,
             a.asset_tag, a.name AS asset_name, t.user_id AS tech_user_id
      FROM maintenance_records m
      JOIN assets a ON m.asset_id = a.id
      LEFT JOIN technicians t ON m.technician_id = t.id
      WHERE m.status IN ('Scheduled', 'In Progress')
        AND date(m.scheduled_date) <= date('now', '+7 days')
    `).all() as Array<{
      id: number;
      maintenance_type: string;
      issue_summary: string;
      scheduled_date: string;
      asset_tag: string;
      asset_name: string;
      tech_user_id: number | null;
    }>;

    let dispatchedCount = 0;
    for (const item of upcoming) {
      notifyRoles(['Administrator'], {
        title: `Upcoming Maintenance Reminder: ${item.asset_tag}`,
        message: `${item.maintenance_type} for ${item.asset_name} is scheduled for ${item.scheduled_date} (${item.issue_summary}).`,
        type: 'warning',
        referenceType: 'maintenance',
        referenceId: item.id,
      });
      if (item.tech_user_id) {
        createNotification({
          userId: item.tech_user_id,
          title: `Assigned Maintenance Due: ${item.asset_tag}`,
          message: `Reminder: ${item.maintenance_type} on ${item.asset_name} scheduled for ${item.scheduled_date}.`,
          type: 'warning',
          referenceType: 'maintenance',
          referenceId: item.id,
        });
      }
      dispatchedCount += 1;
    }

    res.json({ success: true, remindersTriggered: dispatchedCount });
  } catch (err) {
    console.error('Dispatch maintenance reminders error:', err);
    res.status(500).json({ error: 'Failed to dispatch maintenance reminders.' });
  }
});

router.patch('/read-all', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user!.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Mark all notifications read error:', err);
    res.status(500).json({ error: 'Failed to update notifications.' });
  }
});

router.patch('/:id/read', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid notification ID.' });
      return;
    }
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, req.user!.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: 'Failed to update notification.' });
  }
});

export default router;
