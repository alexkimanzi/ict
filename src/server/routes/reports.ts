import { Router } from 'express';
import { db } from '../db.ts';
import { requireAuth, requireRole } from '../middleware/auth.ts';

const router = Router();

router.get('/:type', requireAuth, requireRole('Administrator', 'ICT Technician'), (req, res) => {
  try {
    const type = req.params.type;

    switch (type) {
      case 'inventory': {
        const rows = db.prepare(`
          SELECT a.asset_tag, a.serial_number, a.name, ac.name AS category, a.manufacturer, a.model,
                 a.purchase_date, d.name AS department, a.location, a.condition, a.status,
                 COALESCE(u.full_name, 'Unassigned') AS assigned_user
          FROM assets a
          JOIN asset_categories ac ON a.category_id = ac.id
          LEFT JOIN departments d ON a.department_id = d.id
          LEFT JOIN users u ON a.assigned_user_id = u.id
          ORDER BY a.asset_tag ASC
        `).all();
        res.json({ title: 'Equipment Inventory Report', rows });
        return;
      }

      case 'problems': {
        const rows = db.prepare(`
          SELECT st.ticket_number, st.title, st.category, st.priority, st.status,
                 u.full_name AS requester, COALESCE(d.name, 'General') AS department,
                 COALESCE(tech_u.full_name, 'Unassigned') AS technician, st.reported_at
          FROM support_tickets st
          JOIN users u ON st.requester_id = u.id
          LEFT JOIN departments d ON st.department_id = d.id
          LEFT JOIN technicians t ON st.assigned_technician_id = t.id
          LEFT JOIN users tech_u ON t.user_id = tech_u.id
          ORDER BY st.reported_at DESC
        `).all();
        res.json({ title: 'Reported Technical Problems Report', rows });
        return;
      }

      case 'resolved': {
        const rows = db.prepare(`
          SELECT st.ticket_number, st.title, st.category, st.priority, st.status,
                 u.full_name AS requester, COALESCE(tech_u.full_name, 'N/A') AS resolved_by,
                 COALESCE(st.resolution_details, 'Completed') AS resolution_details,
                 st.reported_at, COALESCE(st.resolved_at, st.closed_at, st.updated_at) AS completed_at
          FROM support_tickets st
          JOIN users u ON st.requester_id = u.id
          LEFT JOIN technicians t ON st.assigned_technician_id = t.id
          LEFT JOIN users tech_u ON t.user_id = tech_u.id
          WHERE st.status IN ('Resolved', 'Closed')
          ORDER BY completed_at DESC
        `).all();
        res.json({ title: 'Resolved Complaints Report', rows });
        return;
      }

      case 'technicians': {
        const rows = db.prepare(`
          SELECT u.full_name AS technician, t.specialization, t.availability_status,
                 COUNT(st.id) AS total_assigned,
                 SUM(CASE WHEN st.status IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) AS resolved_tickets,
                 SUM(CASE WHEN st.status IN ('Assigned', 'In Progress') THEN 1 ELSE 0 END) AS active_tickets,
                 (SELECT COUNT(*) FROM maintenance_records mr WHERE mr.technician_id = t.id AND mr.status = 'Completed') AS completed_maintenance
          FROM technicians t
          JOIN users u ON t.user_id = u.id
          LEFT JOIN support_tickets st ON st.assigned_technician_id = t.id
          GROUP BY t.id, u.full_name, t.specialization, t.availability_status
          ORDER BY resolved_tickets DESC
        `).all();
        res.json({ title: 'Technician Performance Report', rows });
        return;
      }

      case 'maintenance': {
        const rows = db.prepare(`
          SELECT a.asset_tag, a.name AS asset_name, m.maintenance_type, m.issue_summary,
                 COALESCE(u.full_name, 'Unassigned') AS technician,
                 m.scheduled_date, COALESCE(m.completed_date, 'Pending') AS completed_date,
                 m.cost, m.status
          FROM maintenance_records m
          JOIN assets a ON m.asset_id = a.id
          LEFT JOIN technicians t ON m.technician_id = t.id
          LEFT JOIN users u ON t.user_id = u.id
          ORDER BY m.scheduled_date DESC
        `).all();
        res.json({ title: 'Equipment Maintenance Report', rows });
        return;
      }

      case 'damaged': {
        const rows = db.prepare(`
          SELECT a.asset_tag, a.serial_number, a.name, ac.name AS category,
                 COALESCE(d.name, 'Unassigned') AS department, a.location,
                 a.condition, a.status, COALESCE(a.notes, 'No remarks') AS notes
          FROM assets a
          JOIN asset_categories ac ON a.category_id = ac.id
          LEFT JOIN departments d ON a.department_id = d.id
          WHERE a.condition IN ('Damaged', 'Needs Maintenance', 'Retired')
             OR a.status IN ('In Repair', 'Under Maintenance', 'Decommissioned')
          ORDER BY a.condition ASC, a.asset_tag ASC
        `).all();
        res.json({ title: 'Damaged & Needs Maintenance Equipment Report', rows });
        return;
      }

      default:
        res.status(400).json({ error: 'Unknown report type requested.' });
    }
  } catch (err) {
    console.error('Report generation error:', err);
    res.status(500).json({ error: 'Failed to generate report dataset.' });
  }
});

export default router;
