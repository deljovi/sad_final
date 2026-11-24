import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { pool } from './config/database.js';

import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import roomRoutes from './routes/rooms.js';
import equipmentRoutes from './routes/equipment.js';
import loanRoutes from './routes/loans.js';
import approvalRoutes from './routes/approvals.js';
import reportRoutes from './routes/reports.js';

export const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:8081')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'LabSpace API' });
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/reports', reportRoutes);

const webBuildPath = fileURLToPath(new URL('../../oasis-mobile/dist/', import.meta.url));
app.use(express.static(webBuildPath, { extensions: ['html'] }));

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} tidak ditemukan.` });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = error.status || 500;
  res.status(status).json({
    message: status === 500 ? 'Terjadi kesalahan pada server.' : error.message,
  });
});
