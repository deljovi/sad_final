import express from 'express';
import { pool } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const includeInactive = ['LABORAN', 'KEPALA_LABORATORIUM'].includes(req.user.role);
    const [rooms] = await pool.execute(
      `SELECT id, name, capacity, active FROM rooms
       ${includeInactive ? '' : 'WHERE active = TRUE'}
       ORDER BY name`,
    );
    res.json(rooms);
  } catch (error) {
    next(error);
  }
});

router.get('/bookings', async (req, res, next) => {
  try {
    const staffRoles = ['LABORAN', 'KEPALA_LABORATORIUM'];
    const [rows] = await pool.execute(
      `SELECT rb.*, r.name AS room_name, u.name AS borrower_name
       FROM room_bookings rb
       JOIN rooms r ON r.id = rb.room_id
       JOIN users u ON u.id = rb.user_id
       ${staffRoles.includes(req.user.role) ? '' : 'WHERE rb.user_id = ?'}
       ORDER BY rb.start_at DESC`,
      staffRoles.includes(req.user.role) ? [] : [req.user.sub],
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post('/', authorize('LABORAN', 'KEPALA_LABORATORIUM'), async (req, res, next) => {
  try {
    const { name, capacity } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Nama ruang wajib diisi.' });
    if (capacity != null && (!Number.isInteger(Number(capacity)) || Number(capacity) < 0)) {
      return res.status(400).json({ message: 'Kapasitas tidak valid.' });
    }
    const [result] = await pool.execute(
      'INSERT INTO rooms (name, capacity) VALUES (?, ?)',
      [name.trim(), capacity == null ? null : Number(capacity)],
    );
    res.status(201).json({ message: 'Ruang berhasil ditambahkan.', id: result.insertId });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', authorize('LABORAN', 'KEPALA_LABORATORIUM'), async (req, res, next) => {
  try {
    await pool.execute('UPDATE rooms SET active = ? WHERE id = ?', [req.body.active === true, req.params.id]);
    res.json({ message: 'Status ruang diperbarui.' });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/schedules', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, course_name, day_of_week, start_time, end_time, valid_from, valid_until FROM course_schedules WHERE room_id = ? ORDER BY day_of_week, start_time',
      [req.params.id],
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/schedules', authorize('LABORAN', 'KEPALA_LABORATORIUM'), async (req, res, next) => {
  try {
    const { course_name, day_of_week, start_time, end_time, valid_from, valid_until } = req.body;
    if (!course_name || day_of_week == null || !start_time || !end_time) {
      return res.status(400).json({ message: 'Data jadwal kuliah belum lengkap.' });
    }
    if (Number(day_of_week) < 0 || Number(day_of_week) > 6 || start_time >= end_time) {
      return res.status(400).json({ message: 'Hari atau rentang waktu jadwal tidak valid.' });
    }
    await pool.execute(
      `INSERT INTO course_schedules
       (room_id, course_name, day_of_week, start_time, end_time, valid_from, valid_until)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, course_name.trim(), Number(day_of_week), start_time, end_time, valid_from || null, valid_until || null],
    );
    res.status(201).json({ message: 'Jadwal kuliah berhasil ditambahkan.' });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/bookings', authorize('MAHASISWA', 'DOSEN'), async (req, res, next) => {
  try {
    const { start_at, end_at, purpose } = req.body;
    if (!start_at || !end_at || !purpose?.trim()) {
      return res.status(400).json({ message: 'Waktu peminjaman dan tujuan wajib diisi.' });
    }
    const start = new Date(start_at);
    const end = new Date(end_at);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({ message: 'Rentang waktu peminjaman tidak valid.' });
    }
    if ((end - start) / 3600000 > 2) {
      return res.status(400).json({ message: 'Peminjaman ruang maksimal 2 jam per sesi.' });
    }

    const mysqlStart = start.toISOString().slice(0, 19).replace('T', ' ');
    const mysqlEnd = end.toISOString().slice(0, 19).replace('T', ' ');
    const [overlap] = await pool.execute(
      `SELECT id FROM room_bookings
       WHERE room_id = ? AND status IN ('MENUNGGU','DISETUJUI')
       AND start_at < ? AND end_at > ? LIMIT 1`,
      [req.params.id, mysqlEnd, mysqlStart],
    );
    if (overlap[0]) {
      return res.status(409).json({ message: 'Ruang sudah memiliki peminjaman yang bertumpang tindih.' });
    }

    const day = start.getDay();
    const timeStart = start.toISOString().slice(11, 19);
    const timeEnd = end.toISOString().slice(11, 19);
    const [schedules] = await pool.execute(
      `SELECT id FROM course_schedules
       WHERE room_id = ? AND day_of_week = ?
       AND (valid_from IS NULL OR valid_from <= ?)
       AND (valid_until IS NULL OR valid_until >= ?)
       AND start_time < ? AND end_time > ? LIMIT 1`,
      [req.params.id, day, start.toISOString().slice(0, 10), start.toISOString().slice(0, 10), timeEnd, timeStart],
    );
    if (schedules[0]) {
      return res.status(409).json({ message: 'Waktu peminjaman bertabrakan dengan jadwal perkuliahan.' });
    }

    const [result] = await pool.execute(
      `INSERT INTO room_bookings (room_id, user_id, start_at, end_at, purpose)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, req.user.sub, mysqlStart, mysqlEnd, purpose.trim()],
    );
    res.status(201).json({ message: 'Pengajuan peminjaman ruang berhasil dikirim.', id: result.insertId });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/bookings', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT rb.*, u.name AS borrower_name
       FROM room_bookings rb JOIN users u ON u.id = rb.user_id
       WHERE rb.room_id = ? ORDER BY rb.start_at DESC`,
      [req.params.id],
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

export default router;
