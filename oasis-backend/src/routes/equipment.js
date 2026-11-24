import express from 'express';
import { pool } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT et.id, et.name, et.category, et.description, et.active,
              COUNT(eu.id) AS total_units,
              SUM(CASE WHEN eu.availability_status = 'TERSEDIA'
                   AND eu.condition_status = 'BAIK' THEN 1 ELSE 0 END) AS available_units
       FROM equipment_types et
       LEFT JOIN equipment_units eu ON eu.equipment_type_id = et.id
       WHERE et.active = TRUE
       GROUP BY et.id, et.name, et.category, et.description, et.active
       ORDER BY et.name`,
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post('/types', authorize('LABORAN', 'KEPALA_LABORATORIUM'), async (req, res, next) => {
  try {
    const { name, category, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Nama jenis alat wajib diisi.' });
    if (!['BIASA', 'KHUSUS'].includes(category)) {
      return res.status(400).json({ message: 'Kategori alat tidak valid.' });
    }
    const [result] = await pool.execute(
      'INSERT INTO equipment_types (name, category, description) VALUES (?, ?, ?)',
      [name.trim(), category, description?.trim() || null],
    );
    res.status(201).json({ message: 'Jenis alat berhasil ditambahkan.', id: result.insertId });
  } catch (error) {
    next(error);
  }
});

router.post('/units', authorize('LABORAN', 'KEPALA_LABORATORIUM'), async (req, res, next) => {
  try {
    const { equipment_type_id, unit_code } = req.body;
    if (!equipment_type_id || !unit_code?.trim()) {
      return res.status(400).json({ message: 'Jenis alat dan kode unit wajib diisi.' });
    }
    const [result] = await pool.execute(
      'INSERT INTO equipment_units (equipment_type_id, unit_code) VALUES (?, ?)',
      [equipment_type_id, unit_code.trim()],
    );
    res.status(201).json({ message: 'Unit alat berhasil ditambahkan.', id: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Kode unit alat sudah digunakan.' });
    }
    next(error);
  }
});

router.patch('/units/:id/status', authorize('LABORAN', 'KEPALA_LABORATORIUM'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { condition_status, availability_status } = req.body;
    const conditions = ['BAIK', 'RUSAK', 'HILANG', 'PERLU_PERBAIKAN'];
    const availability = ['TERSEDIA', 'DIPINJAM', 'TIDAK_TERSEDIA'];
    if (condition_status && !conditions.includes(condition_status)) {
      return res.status(400).json({ message: 'Status kondisi tidak valid.' });
    }
    if (availability_status && !availability.includes(availability_status)) {
      return res.status(400).json({ message: 'Status ketersediaan tidak valid.' });
    }
    await connection.beginTransaction();
    const [currentRows] = await connection.execute(
      'SELECT condition_status, availability_status FROM equipment_units WHERE id = ? FOR UPDATE',
      [req.params.id],
    );
    if (!currentRows[0]) {
      await connection.rollback();
      return res.status(404).json({ message: 'Unit alat tidak ditemukan.' });
    }
    if (['DIPESAN', 'DIPINJAM'].includes(currentRows[0].availability_status)) {
      await connection.rollback();
      return res.status(409).json({ message: 'Status unit yang dipesan atau dipinjam dikelola melalui alur peminjaman.' });
    }
    await connection.execute(
      'UPDATE equipment_units SET condition_status = ?, availability_status = ? WHERE id = ?',
      [
        condition_status || currentRows[0].condition_status,
        availability_status || currentRows[0].availability_status,
        req.params.id,
      ],
    );
    await connection.commit();
    res.json({ message: 'Status unit alat diperbarui.' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.get('/units', async (req, res, next) => {
  try {
    const availableOnly = req.query.available === 'true';
    const [rows] = await pool.execute(
      `SELECT eu.id, eu.unit_code, eu.condition_status, eu.availability_status,
              et.id AS equipment_type_id, et.name AS equipment_name, et.category
       FROM equipment_units eu JOIN equipment_types et ON et.id = eu.equipment_type_id
       ${availableOnly ? "WHERE eu.availability_status = 'TERSEDIA' AND eu.condition_status = 'BAIK'" : ''}
       ORDER BY et.name, eu.unit_code`,
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

export default router;
