import express from 'express';
import { pool } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.post('/equipment', authorize('MAHASISWA', 'DOSEN'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { purpose, start_date, due_date, items } = req.body;
    if (!purpose?.trim() || !start_date || !due_date || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Tujuan, tanggal, dan daftar alat wajib diisi.' });
    }
    const start = new Date(`${start_date}T00:00:00`);
    const due = new Date(`${due_date}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(due.getTime()) || due < start) {
      return res.status(400).json({ message: 'Rentang tanggal peminjaman tidak valid.' });
    }
    const durationDays = Math.floor((due - start) / 86400000) + 1;
    if (durationDays > 3) {
      return res.status(400).json({ message: 'Peminjaman alat maksimal 3 hari.' });
    }

    await connection.beginTransaction();
    const [lateRows] = await connection.execute(
      `SELECT COUNT(DISTINCT el.id) AS late_count
       FROM equipment_loans el
       JOIN loan_items li ON li.loan_id = el.id
       WHERE el.user_id = ?
       AND (
         (li.returned_at IS NULL AND NOW() > CONCAT(el.due_date, ' 23:59:59'))
         OR (li.returned_at IS NOT NULL AND li.returned_at > CONCAT(el.due_date, ' 23:59:59'))
       )`,
      [req.user.sub],
    );
    if (Number(lateRows[0].late_count) >= 2) {
      throw Object.assign(
        new Error('Peminjaman dibatasi sampai semester berakhir karena keterlambatan tercatat dua kali.'),
        { status: 403 },
      );
    }
    let hasSpecialItem = false;

    for (const item of items) {
      if (!item.unit_id) throw Object.assign(new Error('Setiap alat harus memiliki unit.'), { status: 400 });
      const [unitRows] = await connection.execute(
        `SELECT eu.id, eu.availability_status, eu.condition_status, et.category
         FROM equipment_units eu JOIN equipment_types et ON et.id = eu.equipment_type_id
         WHERE eu.id = ? FOR UPDATE`,
        [item.unit_id],
      );
      if (!unitRows[0]) throw Object.assign(new Error('Unit alat tidak ditemukan.'), { status: 404 });
      const unit = unitRows[0];
      if (unit.availability_status !== 'TERSEDIA' || unit.condition_status !== 'BAIK') {
        throw Object.assign(new Error(`Unit alat ${item.unit_id} tidak tersedia atau tidak dalam kondisi baik.`), { status: 409 });
      }
      if (unit.category === 'KHUSUS') hasSpecialItem = true;
    }

    const [loan] = await connection.execute(
      `INSERT INTO equipment_loans
       (user_id, loan_type, purpose, start_date, due_date, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user.sub,
        hasSpecialItem ? 'KHUSUS' : 'BIASA',
        purpose.trim(),
        start_date,
        due_date,
        hasSpecialItem ? 'MENUNGGU_DOSEN' : 'MENUNGGU_LABORAN',
      ],
    );

    for (const item of items) {
      await connection.execute(
        'INSERT INTO loan_items (loan_id, unit_id, quantity) VALUES (?, ?, 1)',
        [loan.insertId, item.unit_id],
      );
    }

    if (hasSpecialItem) {
      await connection.execute(
        `INSERT INTO approvals (loan_id, approver_id, approver_role, decision)
         SELECT ?, u.id, 'DOSEN_PENGAMPU', 'MENUNGGU'
         FROM users u WHERE u.role = 'DOSEN_PENGAMPU' AND u.active = TRUE LIMIT 1`,
        [loan.insertId],
      );
    }

    await connection.commit();
    res.status(201).json({
      message: hasSpecialItem
        ? 'Pengajuan khusus dikirim untuk persetujuan dosen pengampu.'
        : 'Pengajuan alat dikirim kepada laboran.',
      id: loan.insertId,
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.get('/my', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT el.*,
              JSON_ARRAYAGG(JSON_OBJECT(
                'unit_id', li.unit_id,
                'unit_code', eu.unit_code,
                'equipment_name', et.name,
                'returned_at', li.returned_at,
                'return_condition', li.return_condition
              )) AS items
       FROM equipment_loans el
       JOIN loan_items li ON li.loan_id = el.id
       JOIN equipment_units eu ON eu.id = li.unit_id
       JOIN equipment_types et ON et.id = eu.equipment_type_id
       WHERE el.user_id = ? GROUP BY el.id ORDER BY el.created_at DESC`,
      [req.user.sub],
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post('/:loanId/handover', authorize('LABORAN'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [loans] = await connection.execute(
      'SELECT id, status FROM equipment_loans WHERE id = ? FOR UPDATE',
      [req.params.loanId],
    );
    if (!loans[0]) throw Object.assign(new Error('Transaksi peminjaman tidak ditemukan.'), { status: 404 });
    if (!['DISETUJUI'].includes(loans[0].status)) {
      throw Object.assign(new Error('Peminjaman belum disetujui untuk serah terima.'), { status: 409 });
    }
    await connection.execute(
      'UPDATE loan_items SET handed_over_at = NOW() WHERE loan_id = ?',
      [req.params.loanId],
    );
    await connection.execute(
      `UPDATE equipment_units eu JOIN loan_items li ON li.unit_id = eu.id
       SET eu.availability_status = 'DIPINJAM'
       WHERE li.loan_id = ?`,
      [req.params.loanId],
    );
    await connection.execute(
      `UPDATE equipment_loans SET status = 'SEDANG_DIPINJAM', updated_at = NOW() WHERE id = ?`,
      [req.params.loanId],
    );
    await connection.commit();
    res.json({ message: 'Serah terima alat berhasil dicatat.' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.post('/:loanId/return', authorize('LABORAN'), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { unit_id, condition } = req.body;
    const conditions = ['BAIK', 'RUSAK', 'HILANG'];
    if (!unit_id || !conditions.includes(condition)) {
      return res.status(400).json({ message: 'Unit dan kondisi pengembalian wajib diisi.' });
    }
    await connection.beginTransaction();
    const [items] = await connection.execute(
      'SELECT id, returned_at FROM loan_items WHERE loan_id = ? AND unit_id = ? FOR UPDATE',
      [req.params.loanId, unit_id],
    );
    if (!items[0]) throw Object.assign(new Error('Unit tidak termasuk transaksi peminjaman.'), { status: 404 });
    if (items[0].returned_at) throw Object.assign(new Error('Unit ini sudah dikembalikan.'), { status: 409 });

    await connection.execute(
      `UPDATE loan_items SET returned_at = NOW(), return_condition = ? WHERE id = ?`,
      [condition, items[0].id],
    );

    if (condition === 'BAIK') {
      await connection.execute(
        `UPDATE equipment_units SET condition_status = 'BAIK', availability_status = 'TERSEDIA' WHERE id = ?`,
        [unit_id],
      );
    } else if (condition === 'RUSAK') {
      await connection.execute(
        `UPDATE equipment_units SET condition_status = 'PERLU_PERBAIKAN', availability_status = 'TIDAK_TERSEDIA' WHERE id = ?`,
        [unit_id],
      );
    } else {
      await connection.execute(
        `UPDATE equipment_units SET condition_status = 'HILANG', availability_status = 'TIDAK_TERSEDIA' WHERE id = ?`,
        [unit_id],
      );
    }

    const [remaining] = await connection.execute(
      'SELECT COUNT(*) AS remaining FROM loan_items WHERE loan_id = ? AND returned_at IS NULL',
      [req.params.loanId],
    );
    if (Number(remaining[0].remaining) === 0) {
      await connection.execute(
        `UPDATE equipment_loans SET status = 'SELESAI', updated_at = NOW() WHERE id = ?`,
        [req.params.loanId],
      );
    }
    await connection.commit();
    res.json({ message: 'Pengembalian alat berhasil dicatat.' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

export default router;
