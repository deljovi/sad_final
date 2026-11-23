import express from 'express';
import { pool } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);
router.use(authorize('KEPALA_LABORATORIUM', 'LABORAN'));

router.get('/monthly', async (req, res, next) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    if (!month || month < 1 || month > 12 || !year || year < 2000) {
      return res.status(400).json({ message: 'Bulan dan tahun laporan wajib valid.' });
    }
    const [roomBookings] = await pool.execute(
      `SELECT COUNT(*) AS total FROM room_bookings
       WHERE status IN ('DISETUJUI','SELESAI') AND MONTH(start_at) = ? AND YEAR(start_at) = ?`,
      [month, year],
    );
    const [equipmentLoans] = await pool.execute(
      `SELECT COUNT(*) AS total FROM equipment_loans
       WHERE status IN ('DISETUJUI','SEDANG_DIPINJAM','SELESAI')
       AND MONTH(start_date) = ? AND YEAR(start_date) = ?`,
      [month, year],
    );
    const [equipmentStatus] = await pool.execute(
      `SELECT
         SUM(CASE WHEN availability_status = 'TERSEDIA' AND condition_status = 'BAIK' THEN 1 ELSE 0 END) AS available,
         SUM(CASE WHEN availability_status = 'DIPINJAM' THEN 1 ELSE 0 END) AS borrowed,
         SUM(CASE WHEN condition_status IN ('RUSAK','PERLU_PERBAIKAN') THEN 1 ELSE 0 END) AS damaged,
         SUM(CASE WHEN condition_status = 'HILANG' THEN 1 ELSE 0 END) AS lost
       FROM equipment_units`,
    );
    res.json({
      period: { month, year },
      room_loans: Number(roomBookings[0].total),
      equipment_loans: Number(equipmentLoans[0].total),
      equipment: equipmentStatus[0],
    });
  } catch (error) {
    next(error);
  }
});

router.get('/room-frequency', async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT r.name, COUNT(rb.id) AS usage_count
       FROM rooms r LEFT JOIN room_bookings rb ON rb.room_id = r.id
       AND rb.status IN ('DISETUJUI','SELESAI')
       GROUP BY r.id, r.name ORDER BY usage_count DESC, r.name`,
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.get('/equipment-frequency', async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT et.name, COUNT(li.id) AS usage_count
       FROM equipment_types et
       LEFT JOIN equipment_units eu ON eu.equipment_type_id = et.id
       LEFT JOIN loan_items li ON li.unit_id = eu.id
       GROUP BY et.id, et.name ORDER BY usage_count DESC, et.name`,
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

export default router;
