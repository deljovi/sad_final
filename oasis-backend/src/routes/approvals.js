import express from 'express';
import { pool } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('LABORAN', 'KEPALA_LABORATORIUM'), async (_req, res, next) => {
  try {
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
       WHERE el.status IN ('MENUNGGU_DOSEN','MENUNGGU_LABORAN','DISETUJUI','SEDANG_DIPINJAM')
       ORDER BY el.created_at`,
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post('/:loanId/approve', authorize('LABORAN', 'KEPALA_LABORATORIUM'), async (req, res, next) => {
  try {
    const { note } = req.body;
    const [loanRows] = await pool.execute(
      'SELECT status FROM equipment_loans WHERE id = ?',
      [req.params.loanId],
    );
    if (!loanRows[0]) return res.status(404).json({ message: 'Transaksi peminjaman tidak ditemukan.' });
    if (loanRows[0].status === 'MENUNGGU_DOSEN') {
      const [approvalResult] = await pool.execute(
        `UPDATE approvals SET approver_id = ?, decision = 'DISETUJUI',
         note = ?, decided_at = NOW()
         WHERE loan_id = ? AND approver_role = 'DOSEN_PENGAMPU' AND decision = 'MENUNGGU'`,
        [req.user.sub, note?.trim() || null, req.params.loanId],
      );
      if (approvalResult.affectedRows === 0) {
        return res.status(409).json({ message: 'Permohonan ini sudah diproses.' });
      }
      await pool.execute(
        `UPDATE equipment_loans SET status = 'MENUNGGU_LABORAN', updated_at = NOW()
         WHERE id = ? AND status = 'MENUNGGU_DOSEN'`,
        [req.params.loanId],
      );
      return res.json({ message: 'Persetujuan peminjaman khusus berhasil dicatat.' });
    }
    if (loanRows[0].status !== 'MENUNGGU_LABORAN') {
      return res.status(409).json({ message: 'Permohonan ini tidak sedang menunggu persetujuan laboratorium.' });
    }
    const approverRole = req.user.role;
    await pool.execute(
      `INSERT INTO approvals (loan_id, approver_id, approver_role, decision, note, decided_at)
       SELECT ?, ?, ?, 'DISETUJUI', ?, NOW()
       WHERE NOT EXISTS (
         SELECT 1 FROM approvals WHERE loan_id = ? AND approver_role = ?
       )`,
      [req.params.loanId, req.user.sub, approverRole, note?.trim() || null, req.params.loanId, approverRole],
    );
    await pool.execute(
      `UPDATE equipment_loans SET status = 'DISETUJUI', updated_at = NOW()
       WHERE id = ? AND status = 'MENUNGGU_LABORAN'`,
      [req.params.loanId],
    );
    res.json({
      message: approverRole === 'LABORAN'
        ? 'Permohonan disetujui oleh laboran.'
        : 'Permohonan disetujui oleh kepala laboratorium.',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:loanId/reject', authorize('LABORAN', 'KEPALA_LABORATORIUM'), async (req, res, next) => {
  try {
    const { note } = req.body;
    if (!note?.trim()) return res.status(400).json({ message: 'Catatan penolakan wajib diisi.' });
    const [loanRows] = await pool.execute(
      'SELECT status FROM equipment_loans WHERE id = ?',
      [req.params.loanId],
    );
    if (!loanRows[0]) return res.status(404).json({ message: 'Transaksi peminjaman tidak ditemukan.' });
    if (loanRows[0].status === 'MENUNGGU_DOSEN') {
      const [approvalResult] = await pool.execute(
        `UPDATE approvals SET approver_id = ?, decision = 'DITOLAK',
         note = ?, decided_at = NOW()
         WHERE loan_id = ? AND approver_role = 'DOSEN_PENGAMPU' AND decision = 'MENUNGGU'`,
        [req.user.sub, note.trim(), req.params.loanId],
      );
      if (approvalResult.affectedRows === 0) {
        return res.status(409).json({ message: 'Permohonan ini sudah diproses.' });
      }
      await pool.execute(
        `UPDATE equipment_loans SET status = 'DITOLAK', rejection_reason = ?, updated_at = NOW()
         WHERE id = ? AND status = 'MENUNGGU_DOSEN'`,
        [note.trim(), req.params.loanId],
      );
      return res.json({ message: 'Permohonan peminjaman khusus ditolak.' });
    }
    if (loanRows[0].status !== 'MENUNGGU_LABORAN') {
      return res.status(409).json({ message: 'Permohonan ini tidak sedang menunggu keputusan.' });
    }
    await pool.execute(
      `UPDATE equipment_loans SET status = 'DITOLAK', rejection_reason = ?, updated_at = NOW()
       WHERE id = ? AND status = 'MENUNGGU_LABORAN'`,
      [note.trim(), req.params.loanId],
    );
    res.json({
      message: req.user.role === 'LABORAN'
        ? 'Permohonan ditolak oleh laboran.'
        : 'Permohonan ditolak oleh kepala laboratorium.',
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/room/:bookingId', authorize('LABORAN', 'KEPALA_LABORATORIUM'), async (req, res, next) => {
  try {
    const { decision, rejection_reason } = req.body;
    if (!['DISETUJUI', 'DITOLAK'].includes(decision)) {
      return res.status(400).json({ message: 'Keputusan peminjaman ruang tidak valid.' });
    }
    if (decision === 'DITOLAK' && !rejection_reason?.trim()) {
      return res.status(400).json({ message: 'Alasan penolakan wajib diisi.' });
    }
    const [result] = await pool.execute(
      `UPDATE room_bookings SET status = ?, rejection_reason = ?, updated_at = NOW()
       WHERE id = ? AND status = 'MENUNGGU'`,
      [decision, decision === 'DITOLAK' ? rejection_reason.trim() : null, req.params.bookingId],
    );
    if (result.affectedRows === 0) {
      return res.status(409).json({ message: 'Pengajuan ruang tidak ditemukan atau sudah diproses.' });
    }
    res.json({ message: 'Keputusan peminjaman ruang berhasil dicatat.' });
  } catch (error) {
    next(error);
  }
});

export default router;
