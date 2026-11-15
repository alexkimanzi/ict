import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.ts';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.ts';
import { createNotification, getClientIp, logAudit, notifyRoles } from '../utils/audit.ts';
import { ticketUpload } from '../utils/upload.ts';

const router = Router();

const createTicketSchema = z.object({
  title: z.string().trim().min(4).max(200),
  category: z.enum([
    'Computer Problem',
    'Printer Problem',
    'Network Failure',
    'Software Error',
    'Password & Account Assistance',
    'Other ICT Issue',
  ]),
  description: z.string().trim().min(10).max(4000),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).default('Medium'),
  assetId: z.preprocess((v) => (v === '' || v === undefined || v === null ? null : Number(v)), z.number().int().positive().nullable()),
  departmentId: z.preprocess((v) => (v === '' || v === undefined || v === null ? null : Number(v)), z.number().int().positive().nullable()),
  location: z.string().trim().max(150).optional(),
});

const updateTicketSchema = z.object({
  status: z.enum(['Pending', 'Assigned', 'In Progress', 'Resolved', 'Closed']).optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  assignedTechnicianId: z.number().int().positive().nullable().optional(),
  resolutionDetails: z.string().trim().max(4000).optional(),
});

const commentSchema = z.object({
  comment: z.string().trim().min(1).max(2000),
  isInternal: z.boolean().optional().default(false),
});

router.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const isPrivileged = req.user!.role === 'Administrator' || req.user!.role === 'ICT Technician';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const priority = typeof req.query.priority === 'string' ? req.query.priority.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';

    let sql = `
      SELECT st.*,
             req.full_name AS requester_name, req.email AS requester_email, req_role.name AS requester_role,
             tech_u.full_name AS technician_name,
             a.asset_tag, a.name AS asset_name,
             d.name AS department_name
      FROM support_tickets st
      JOIN users req ON st.requester_id = req.id
      JOIN roles req_role ON req.role_id = req_role.id
      LEFT JOIN technicians t ON st.assigned_technician_id = t.id
      LEFT JOIN users tech_u ON t.user_id = tech_u.id
      LEFT JOIN assets a ON st.asset_id = a.id
      LEFT JOIN departments d ON st.department_id = d.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (!isPrivileged) {
      sql += ' AND st.requester_id = ?';
      params.push(req.user!.id);
    }

    if (search) {
      sql += ` AND (LOWER(st.ticket_number) LIKE ? OR LOWER(st.title) LIKE ? OR LOWER(st.description) LIKE ? OR LOWER(req.full_name) LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) {
      sql += ' AND st.status = ?';
      params.push(status);
    }
    if (priority) {
      sql += ' AND st.priority = ?';
      params.push(priority);
    }
    if (category) {
      sql += ' AND st.category = ?';
      params.push(category);
    }

    sql += ' ORDER BY st.reported_at DESC';
    const tickets = db.prepare(sql).all(...params);
    res.json({ tickets });
  } catch (err) {
    console.error('List tickets error:', err);
    res.status(500).json({ error: 'Failed to load support tickets.' });
  }
});

router.get('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const ticketId = Number(req.params.id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      res.status(400).json({ error: 'Invalid ticket ID.' });
      return;
    }

    const ticket = db.prepare(`
      SELECT st.*,
             req.full_name AS requester_name, req.email AS requester_email, req_role.name AS requester_role,
             tech_u.full_name AS technician_name,
             a.asset_tag, a.name AS asset_name,
             d.name AS department_name
      FROM support_tickets st
      JOIN users req ON st.requester_id = req.id
      JOIN roles req_role ON req.role_id = req_role.id
      LEFT JOIN technicians t ON st.assigned_technician_id = t.id
      LEFT JOIN users tech_u ON t.user_id = tech_u.id
      LEFT JOIN assets a ON st.asset_id = a.id
      LEFT JOIN departments d ON st.department_id = d.id
      WHERE st.id = ?
    `).get(ticketId) as { requester_id: number } | undefined;

    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found.' });
      return;
    }

    const isPrivileged = req.user!.role === 'Administrator' || req.user!.role === 'ICT Technician';
    if (!isPrivileged && ticket.requester_id !== req.user!.id) {
      res.status(403).json({ error: 'You do not have permission to view this ticket.' });
      return;
    }

    let commentSql = `
      SELECT tc.*, u.full_name AS author_name, r.name AS author_role
      FROM ticket_comments tc
      JOIN users u ON tc.user_id = u.id
      JOIN roles r ON u.role_id = r.id
      WHERE tc.ticket_id = ?
    `;
    if (!isPrivileged) {
      commentSql += ' AND tc.is_internal = 0';
    }
    commentSql += ' ORDER BY tc.created_at ASC';

    const comments = db.prepare(commentSql).all(ticketId);
    res.json({ ticket, comments });
  } catch (err) {
    console.error('Get ticket error:', err);
    res.status(500).json({ error: 'Failed to load ticket details.' });
  }
});

router.post('/', requireAuth, ticketUpload.single('attachment'), (req: AuthenticatedRequest, res) => {
  try {
    const parsed = createTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid support ticket input.' });
      return;
    }

    const { title, category, description, priority, assetId, departmentId, location } = parsed.data;
    const seqRow = db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM support_tickets').get() as { next_id: number };
    const ticketNumber = `ICT-${new Date().getFullYear()}-${String(seqRow.next_id).padStart(4, '0')}`;

    const attachmentPath = req.file ? `/api/uploads/${req.file.filename}` : null;
    const attachmentName = req.file ? req.file.originalname : null;
    const effectiveDeptId = departmentId ?? req.user!.departmentId ?? null;

    const result = db.prepare(`
      INSERT INTO support_tickets (
        ticket_number, title, category, description, priority, status,
        requester_id, asset_id, department_id, location, attachment_path, attachment_name
      ) VALUES (?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?, ?)
    `).run(
      ticketNumber,
      title,
      category,
      description,
      priority,
      req.user!.id,
      assetId,
      effectiveDeptId,
      location || null,
      attachmentPath,
      attachmentName
    );

    const ticketId = Number(result.lastInsertRowid);

    notifyRoles(['Administrator', 'ICT Technician'], {
      title: `New Ticket: ${ticketNumber}`,
      message: `${req.user!.fullName} reported "${title}" (${priority} · ${category}).`,
      type: priority === 'Critical' || priority === 'High' ? 'alert' : 'info',
      referenceType: 'ticket',
      referenceId: ticketId,
      excludeUserId: req.user!.id,
    });

    createNotification({
      userId: req.user!.id,
      title: `Ticket Received: ${ticketNumber}`,
      message: `Your support request "${title}" has been logged with priority ${priority}.`,
      type: 'success',
      referenceType: 'ticket',
      referenceId: ticketId,
    });

    logAudit({
      userId: req.user!.id,
      action: 'TICKET_CREATED',
      entityType: 'support_ticket',
      entityId: ticketId,
      details: `Submitted ticket ${ticketNumber} (${category}, ${priority}): ${title}`,
      ipAddress: getClientIp(req),
    });

    const created = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(ticketId);
    res.status(201).json({ ticket: created });
  } catch (err) {
    console.error('Create ticket error:', err);
    res.status(500).json({ error: 'Failed to submit support ticket.' });
  }
});

router.patch('/:id', requireAuth, requireRole('Administrator', 'ICT Technician'), (req: AuthenticatedRequest, res) => {
  try {
    const ticketId = Number(req.params.id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      res.status(400).json({ error: 'Invalid ticket ID.' });
      return;
    }

    const parsed = updateTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid update payload.' });
      return;
    }

    const existing = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(ticketId) as {
      id: number;
      ticket_number: string;
      status: string;
      priority: string;
      requester_id: number;
      assigned_technician_id: number | null;
      resolution_details: string | null;
    } | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Support ticket not found.' });
      return;
    }

    const nextTechId = parsed.data.assignedTechnicianId !== undefined
      ? parsed.data.assignedTechnicianId
      : existing.assigned_technician_id;

    let nextStatus = parsed.data.status ?? existing.status;
    if (nextTechId && !parsed.data.status && existing.status === 'Pending') {
      nextStatus = 'Assigned';
    }

    const nextPriority = parsed.data.priority ?? existing.priority;
    const nextResolution = parsed.data.resolutionDetails !== undefined
      ? parsed.data.resolutionDetails
      : existing.resolution_details;

    const assignedAtUpdate = nextTechId && nextTechId !== existing.assigned_technician_id ? "datetime('now')" : 'assigned_at';
    const resolvedAtUpdate = nextStatus === 'Resolved' && existing.status !== 'Resolved' ? "datetime('now')" : 'resolved_at';
    const closedAtUpdate = nextStatus === 'Closed' && existing.status !== 'Closed' ? "datetime('now')" : 'closed_at';

    db.prepare(`
      UPDATE support_tickets
      SET status = ?,
          priority = ?,
          assigned_technician_id = ?,
          resolution_details = ?,
          assigned_at = ${assignedAtUpdate},
          resolved_at = ${resolvedAtUpdate},
          closed_at = ${closedAtUpdate},
          updated_at = datetime('now')
      WHERE id = ?
    `).run(nextStatus, nextPriority, nextTechId, nextResolution, ticketId);

    if (nextTechId && nextTechId !== existing.assigned_technician_id) {
      const techUser = db.prepare('SELECT user_id FROM technicians WHERE id = ?').get(nextTechId) as { user_id: number } | undefined;
      if (techUser) {
        createNotification({
          userId: techUser.user_id,
          title: `Ticket Assigned: ${existing.ticket_number}`,
          message: `You have been assigned to handle ticket ${existing.ticket_number}.`,
          type: 'info',
          referenceType: 'ticket',
          referenceId: ticketId,
        });
      }
    }

    if (nextStatus !== existing.status || (nextTechId && nextTechId !== existing.assigned_technician_id)) {
      createNotification({
        userId: existing.requester_id,
        title: `Ticket Update: ${existing.ticket_number}`,
        message: `Your support request is now "${nextStatus}".`,
        type: nextStatus === 'Resolved' || nextStatus === 'Closed' ? 'success' : 'info',
        referenceType: 'ticket',
        referenceId: ticketId,
      });
    }

    logAudit({
      userId: req.user!.id,
      action: 'TICKET_UPDATED',
      entityType: 'support_ticket',
      entityId: ticketId,
      details: `Updated ${existing.ticket_number}: status=${nextStatus}, priority=${nextPriority}, techId=${nextTechId ?? 'unassigned'}.`,
      ipAddress: getClientIp(req),
    });

    const updated = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(ticketId);
    res.json({ ticket: updated });
  } catch (err) {
    console.error('Update ticket error:', err);
    res.status(500).json({ error: 'Failed to update support ticket.' });
  }
});

router.post('/:id/comments', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const ticketId = Number(req.params.id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      res.status(400).json({ error: 'Invalid ticket ID.' });
      return;
    }

    const parsed = commentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Comment text is required.' });
      return;
    }

    const ticket = db.prepare('SELECT id, ticket_number, requester_id, assigned_technician_id FROM support_tickets WHERE id = ?').get(ticketId) as {
      id: number;
      ticket_number: string;
      requester_id: number;
      assigned_technician_id: number | null;
    } | undefined;

    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found.' });
      return;
    }

    const isPrivileged = req.user!.role === 'Administrator' || req.user!.role === 'ICT Technician';
    if (!isPrivileged && ticket.requester_id !== req.user!.id) {
      res.status(403).json({ error: 'Not authorized to comment on this ticket.' });
      return;
    }

    const isInternal = isPrivileged && parsed.data.isInternal ? 1 : 0;
    const result = db.prepare(`
      INSERT INTO ticket_comments (ticket_id, user_id, comment, is_internal)
      VALUES (?, ?, ?, ?)
    `).run(ticketId, req.user!.id, parsed.data.comment, isInternal);

    if (!isInternal) {
      if (req.user!.id !== ticket.requester_id) {
        createNotification({
          userId: ticket.requester_id,
          title: `New Reply on ${ticket.ticket_number}`,
          message: `${req.user!.fullName} commented on your ticket.`,
          type: 'info',
          referenceType: 'ticket',
          referenceId: ticketId,
        });
      } else if (ticket.assigned_technician_id) {
        const tech = db.prepare('SELECT user_id FROM technicians WHERE id = ?').get(ticket.assigned_technician_id) as { user_id: number } | undefined;
        if (tech) {
          createNotification({
            userId: tech.user_id,
            title: `Requester Replied: ${ticket.ticket_number}`,
            message: `${req.user!.fullName} added a comment to ${ticket.ticket_number}.`,
            type: 'info',
            referenceType: 'ticket',
            referenceId: ticketId,
          });
        }
      }
    }

    const created = db.prepare(`
      SELECT tc.*, u.full_name AS author_name, r.name AS author_role
      FROM ticket_comments tc
      JOIN users u ON tc.user_id = u.id
      JOIN roles r ON u.role_id = r.id
      WHERE tc.id = ?
    `).get(Number(result.lastInsertRowid));

    res.status(201).json({ comment: created });
  } catch (err) {
    console.error('Add comment error:', err);
    res.status(500).json({ error: 'Failed to post comment.' });
  }
});

export default router;
