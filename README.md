# ICT Help Desk and Asset Management System

A centralized full-stack web platform for universities, colleges, hospitals, and organizations to manage ICT support tickets, hardware assets (with barcode & QR scanning), preventive maintenance, network infrastructure, PDF/Excel reports, multi-channel Email/SMS alerts, and security audit logs.

## Project Structure

- `database/schema.sql` — PostgreSQL 16+ relational DDL covering all 12 core tables (`roles`, `departments`, `users`, `asset_categories`, `assets`, `technicians`, `support_tickets`, `ticket_comments`, `maintenance_records`, `network_devices`, `notifications`, `notification_deliveries`, `audit_logs`).
- `server.ts` — Express.js + Vite unified HTTP server running on port 3000.
- `src/server/db.ts` — Relational SQL schema initialization and institutional seed data (`node:sqlite` local persistent database in `data/ict_helpdesk.db`).
- `src/server/middleware/auth.ts` — JWT authentication and 4-tier Role-Based Access Control (`Administrator`, `ICT Technician`, `Staff Member`, `Student`).
- `src/server/utils/dispatcher.ts` — Transactional Email (SendGrid / Mailgun) and SMS (Twilio) notification dispatcher.
- `src/server/utils/upload.ts` — Secure Multer attachment upload handler (5MB limit, strict MIME/extension allowlist).
- `src/server/routes/*.ts` — REST API modules (`auth`, `dashboard`, `users`, `tickets`, `assets`, `maintenance`, `network`, `reports`, `notifications`, `auditLogs`).
- `src/components/*.tsx` — Responsive React + Tailwind CSS frontend modules including `AssetScannerModal.tsx` (camera & hardware barcode/QR scanning + QR label export).

## Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables (optional for SendGrid, Mailgun, Twilio, PostgreSQL)
cp .env.example .env

# 3. Start full-stack development server (port 3000)
npm run dev

# 4. Build production bundle and run in production
npm run build
NODE_ENV=production npm start
```

## PostgreSQL Setup (External Deployment)

```bash
createdb ict_helpdesk_db
psql -d ict_helpdesk_db -f database/schema.sql
```

## Demo Accounts (Password: `Password@123`)

- **Administrator**: `admin@ictportal.edu`
- **ICT Technician**: `tech.kelvin@ictportal.edu`
- **Staff Member**: `staff.grace@ictportal.edu`
- **Student**: `student.lydia@ictportal.edu`
