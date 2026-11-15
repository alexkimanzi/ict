import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { initializeDatabase } from './src/server/db.ts';
import authRoutes from './src/server/routes/auth.ts';
import dashboardRoutes from './src/server/routes/dashboard.ts';
import userRoutes from './src/server/routes/users.ts';
import ticketRoutes from './src/server/routes/tickets.ts';
import assetRoutes from './src/server/routes/assets.ts';
import maintenanceRoutes from './src/server/routes/maintenance.ts';
import networkRoutes from './src/server/routes/network.ts';
import reportRoutes from './src/server/routes/reports.ts';
import notificationRoutes from './src/server/routes/notifications.ts';
import auditLogRoutes from './src/server/routes/auditLogs.ts';
import { uploadsDir } from './src/server/utils/upload.ts';

initializeDatabase();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// Serve uploaded ticket attachments safely
app.use('/api/uploads', express.static(uploadsDir, {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));

// Health endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// REST API routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/network-devices', networkRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit-logs', auditLogRoutes);

// API error handler (handles multer size/type rejections and JSON errors cleanly)
app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal server error';
  const status = message.includes('File too large') || message.includes('Invalid file type') ? 400 : 500;
  res.status(status).json({ error: message });
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ICT Help Desk & Asset Management System running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
