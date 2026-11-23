import bcrypt from 'bcryptjs';
import express from 'express';
import { pool } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.post('/', authorize('KEPALA_LABORATORIUM'), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const allowedRoles = ['MAHASISWA', 'DOSEN', 'DOSEN_PENGAMPU', 'LABORAN', 'KEPALA_LABORATORIUM'];
    if (!name || !email || !password || !allowedRoles.includes(role)) {
      return res.status(400).json({ message: 'Data akun atau role tidak valid.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: 'Kata sandi minimal 8 karakter.' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name.trim(), String(email).trim().toLowerCase(), passwordHash, role],
    );
    res.status(201).json({ message: 'Akun berhasil dibuat.', id: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Email sudah digunakan.' });
    }
    next(error);
  }
});

router.get('/', authorize('KEPALA_LABORATORIUM', 'LABORAN'), async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, active, created_at FROM users ORDER BY name',
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', authorize('KEPALA_LABORATORIUM'), async (req, res, next) => {
  try {
    const active = req.body.active === true;
    await pool.execute('UPDATE users SET active = ? WHERE id = ?', [active, req.params.id]);
    res.json({ message: active ? 'Akun diaktifkan.' : 'Akun dinonaktifkan.' });
  } catch (error) {
    next(error);
  }
});

export default router;
