import { Router } from 'express';
import { db } from '../db.ts';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();

router.get('/stats', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const isPrivileged = req.user!.role === 'Administrator' || req.user!.role === 'ICT Technician';

    const totalUsers = (db.prepare('SELECT COUNT(*) AS count FROM users WHERE is_active = 1').get() as { count: number }).count;
    const totalEquipment = (db.prepare("SELECT COUNT(*) AS count FROM assets WHERE status != 'Decommissioned'").get() as { count: number }).count;
    const pendingTickets = (db.prepare("SELECT COUNT(*) AS count FROM support_tickets WHERE status IN ('Pending', 'Assigned', 'In Progress')").get() as { count: number }).count;
    const resolvedTickets = (db.prepare("SELECT COUNT(*) AS count FROM support_tickets WHERE status IN ('Resolved', 'Closed')").get() as { count: number }).count;
    const ongoingRepairs = (db.prepare("SELECT COUNT(*) AS count FROM maintenance_records WHERE status IN ('Scheduled', 'In Progress')").get() as { count: number }).count;
    const maintenanceNeeded = (db.prepare("SELECT COUNT(*) AS count FROM assets WHERE condition IN ('Needs Maintenance', 'Damaged')").get() as { count: number }).count;
    const offlineNetworkDevices = (db.prepare("SELECT COUNT(*) AS count FROM network_devices WHERE status IN ('Offline', 'Degraded')").get() as { count: number }).count;

    const myOpenTickets = (db.prepare("SELECT COUNT(*) AS count FROM support_tickets WHERE requester_id = ? AND status NOT IN ('Resolved', 'Closed')").get(req.user!.id) as { count: number }).count;
    const myResolvedTickets = (db.prepare("SELECT COUNT(*) AS count FROM support_tickets WHERE requester_id = ? AND status IN ('Resolved', 'Closed')").get(req.user!.id) as { count: number }).count;
    const myAssignedAssets = (db.prepare('SELECT COUNT(*) AS count FROM assets WHERE assigned_user_id = ?').get(req.user!.id) as { count: number }).count;

    const ticketsByStatus = db.prepare(`
      SELECT status, COUNT(*) AS count
      FROM support_tickets
      GROUP BY status
    `).all();

    const ticketsByCategory = db.prepare(`
      SELECT category, COUNT(*) AS count
      FROM support_tickets
      GROUP BY category
      ORDER BY count DESC
    `).all();

    const ticketsByPriority = db.prepare(`
      SELECT priority, COUNT(*) AS count
      FROM support_tickets
      GROUP BY priority
    `).all();

    const assetsByCategory = db.prepare(`
      SELECT ac.name AS category, COUNT(a.id) AS count
      FROM asset_categories ac
      LEFT JOIN assets a ON a.category_id = ac.id
      GROUP BY ac.id, ac.name
      ORDER BY count DESC
    `).all();

    const assetsByCondition = db.prepare(`
      SELECT condition, COUNT(*) AS count
      FROM assets
      GROUP BY condition
    `).all();

    const technicianWorkload = db.prepare(`
      SELECT u.full_name AS name,
             t.availability_status AS availability,
             SUM(CASE WHEN st.status IN ('Assigned', 'In Progress') THEN 1 ELSE 0 END) AS active_tickets,
             SUM(CASE WHEN st.status IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) AS resolved_tickets
      FROM technicians t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN support_tickets st ON st.assigned_technician_id = t.id
      GROUP BY t.id, u.full_name, t.availability_status
      ORDER BY resolved_tickets DESC
    `).all();

    const recentTickets = isPrivileged
      ? db.prepare(`
          SELECT st.id, st.ticket_number, st.title, st.category, st.priority, st.status, st.reported_at,
                 u.full_name AS requester_name, d.name AS department_name
          FROM support_tickets st
          JOIN users u ON st.requester_id = u.id
          LEFT JOIN departments d ON st.department_id = d.id
          ORDER BY st.reported_at DESC
          LIMIT 6
        `).all()
      : db.prepare(`
          SELECT st.id, st.ticket_number, st.title, st.category, st.priority, st.status, st.reported_at,
                 u.full_name AS requester_name, d.name AS department_name
          FROM support_tickets st
          JOIN users u ON st.requester_id = u.id
          LEFT JOIN departments d ON st.department_id = d.id
          WHERE st.requester_id = ?
          ORDER BY st.reported_at DESC
          LIMIT 6
        `).all(req.user!.id);

    const upcomingMaintenance = db.prepare(`
      SELECT m.id, m.maintenance_type, m.issue_summary, m.scheduled_date, m.status,
             a.asset_tag, a.name AS asset_name, u.full_name AS technician_name
      FROM maintenance_records m
      JOIN assets a ON m.asset_id = a.id
      LEFT JOIN technicians t ON m.technician_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE m.status IN ('Scheduled', 'In Progress')
      ORDER BY m.scheduled_date ASC
      LIMIT 5
    `).all();

    res.json({
      kpis: {
        totalUsers,
        totalEquipment,
        pendingTickets,
        resolvedTickets,
        ongoingRepairs,
        maintenanceNeeded,
        offlineNetworkDevices,
        myOpenTickets,
        myResolvedTickets,
        myAssignedAssets,
      },
      charts: {
        ticketsByStatus,
        ticketsByCategory,
        ticketsByPriority,
        assetsByCategory,
        assetsByCondition,
        technicianWorkload,
      },
      recentTickets,
      upcomingMaintenance,
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Failed to load dashboard metrics.' });
  }
});

export default router;
