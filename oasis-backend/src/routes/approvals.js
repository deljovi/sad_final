import express from 'express';
import { pool } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('LABORAN', 'DOSEN_PENGAMPU'), async (req, res, next) => {
  try {
    if (req.user.role === 'DOSEN_PENGAMPU') {
      const [rows] = await pool.execute(
        `SELECT el.*, u.name AS borrower_name,
                (SELECT JSON_ARRAYAGG(JSON_OBJECT(
                  'unit_id', li.unit_id,
                  'unit_code', eu.unit_code,
                  'equipment_name', et.name,
                  'returned_at', li.returned_at,
                  'return_condition', li.return_condition
                ))
                 FROM loan_items li
                 JOIN equipment_units eu ON eu.id = li.unit_id
                 JOIN equipment_types et ON et.id = eu.equipment_type_id
                 WHERE li.loan_id = el.id) AS items
         FROM equipment_loans el JOIN users u ON u.id = el.user_id
         JOIN approvals a ON a.loan_id = el.id
         WHERE el.status = 'MENUNGGU_DOSEN'
         AND a.approver_id = ? AND a.decision = 'MENUNGGU'
         ORDER BY el.created_at`,
        [req.user.sub],
      );
      return res.json(rows);
    }
    const [rows] = await pool.execute(
      `SELECT el.*, u.name AS borrower_name,
              (SELECT JSON_ARRAYAGG(JSON_OBJECT(
                'unit_id', li.unit_id,
                'unit_code', eu.unit_code,
                'equipment_name', et.name,
                'returned_at', li.returned_at,
                'return_condition', li.return_condition
              ))
               FROM loan_items li
               JOIN equipment_units eu ON eu.id = li.unit_id
               JOIN equipment_types et ON et.id = eu.equipment_type_id
               WHERE li.loan_id = el.id) AS items
       FROM equipment_loans el JOIN users u ON u.id = el.user_id
       WHERE el.status IN ('MENUNGGU_LABORAN','DISETUJUI','SEDANG_DIPINJAM')
       ORDER BY el.created_at`,
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post('/:loanId/approve', authorize('LABORAN', 'DOSEN_PENGAMPU'), async (req, res, next) => {
  try {
    const { note } = req.body;
    if (req.user.role === 'DOSEN_PENGAMPU') {
      await pool.execute(
        `UPDATE approvals SET decision = 'DISETUJUI', note = ?, decided_at = NOW()
         WHERE loan_id = ? AND approver_id = ? AND approver_role = 'DOSEN_PENGAMPU'
         AND decision = 'MENUNGGU'`,
        [note?.trim() || null, req.params.loanId, req.user.sub],
      );
      await pool.execute(
        `UPDATE equipment_loans SET status = 'MENUNGGU_LABORAN', updated_at = NOW()
         WHERE id = ? AND status = 'MENUNGGU_DOSEN'`,
        [req.params.loanId],
      );
      return res.json({ message: 'Persetujuan dosen pengampu berhasil dicatat.' });
    }
    await pool.execute(
      `INSERT INTO approvals (loan_id, approver_id, approver_role, decision, note, decided_at)
       SELECT ?, ?, 'LABORAN', 'DISETUJUI', ?, NOW()
       WHERE NOT EXISTS (
         SELECT 1 FROM approvals WHERE loan_id = ? AND approver_role = 'LABORAN'
       )`,
      [req.params.loanId, req.user.sub, note?.trim() || null, req.params.loanId],
    );
    await pool.execute(
      `UPDATE equipment_loans SET status = 'DISETUJUI', updated_at = NOW()
       WHERE id = ? AND status = 'MENUNGGU_LABORAN'`,
      [req.params.loanId],
    );
    res.json({ message: 'Permohonan disetujui oleh laboran.' });
  } catch (error) {
    next(error);
  }
});

router.post('/:loanId/reject', authorize('LABORAN', 'DOSEN_PENGAMPU'), async (req, res, next) => {
  try {
    const { note } = req.body;
    if (!note?.trim()) return res.status(400).json({ message: 'Catatan penolakan wajib diisi.' });
    if (req.user.role === 'DOSEN_PENGAMPU') {
      await pool.execute(
        `UPDATE approvals SET decision = 'DITOLAK', note = ?, decided_at = NOW()
         WHERE loan_id = ? AND approver_id = ? AND decision = 'MENUNGGU'`,
        [note.trim(), req.params.loanId, req.user.sub],
      );
      await pool.execute(
        `UPDATE equipment_loans SET status = 'DITOLAK', rejection_reason = ?, updated_at = NOW()
         WHERE id = ? AND status = 'MENUNGGU_DOSEN'`,
        [note.trim(), req.params.loanId],
      );
      return res.json({ message: 'Permohonan ditolak oleh dosen pengampu.' });
    }
    await pool.execute(
      `UPDATE equipment_loans SET status = 'DITOLAK', rejection_reason = ?, updated_at = NOW()
       WHERE id = ? AND status = 'MENUNGGU_LABORAN'`,
      [note.trim(), req.params.loanId],
    );
    res.json({ message: 'Permohonan ditolak oleh laboran.' });
  } catch (error) {
    next(error);
  }
});

router.patch('/room/:bookingId', authorize('LABORAN'), async (req, res, next) => {
  try {
    const { decision, rejection_reason } = req.body;
    if (!['DISETUJUI', 'DITOLAK'].includes(decision)) {
      return res.status(400).json({ message: 'Keputusan peminjaman ruang tidak valid.' });
    }
    if (decision === 'DITOLAK' && !rejection_reason?.trim()) {
      return res.status(400).json({ message: 'Alasan penolakan wajib diisi.' });
    }
    await pool.execute(
      `UPDATE room_bookings SET status = ?, rejection_reason = ?, updated_at = NOW()
       WHERE id = ? AND status = 'MENUNGGU'`,
      [decision, decision === 'DITOLAK' ? rejection_reason.trim() : null, req.params.bookingId],
    );
    res.json({ message: 'Keputusan peminjaman ruang berhasil dicatat.' });
  } catch (error) {
    next(error);
  }
});

export default router;
