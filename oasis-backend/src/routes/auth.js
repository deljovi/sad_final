import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email dan kata sandi wajib diisi.' });
    }
    const [rows] = await pool.execute(
      'SELECT id, name, email, password_hash, role, active FROM users WHERE email = ?',
      [String(email).trim().toLowerCase()],
    );
    const user = rows[0];
    if (!user || !user.active || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Email atau kata sandi tidak valid.' });
    }
    if (!['LABORAN', 'KEPALA_LABORATORIUM'].includes(user.role)) {
      return res.status(403).json({ message: 'Portal ini hanya dapat diakses admin dan penjaga laboratorium.' });
    }
    const token = jwt.sign(
      { sub: user.id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
    );
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, active FROM users WHERE id = ?',
      [req.user.sub],
    );
    if (!rows[0] || !rows[0].active) {
      return res.status(401).json({ message: 'Akun tidak aktif.' });
    }
    res.json({ user: rows[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
