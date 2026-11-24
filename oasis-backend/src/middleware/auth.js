import jwt from 'jsonwebtoken';
import { pool } from '../config/database.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token autentikasi diperlukan.' });
  }

  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    if (!['LABORAN', 'KEPALA_LABORATORIUM'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Portal ini hanya dapat diakses admin dan penjaga laboratorium.' });
    }
    next();
  } catch {
    res.status(401).json({ message: 'Token tidak valid atau telah kedaluwarsa.' });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Anda tidak memiliki hak akses untuk tindakan ini.' });
    }
    next();
  };
}

export async function getUserById(id) {
  const [rows] = await pool.query(
    'SELECT id, name, email, role, active FROM users WHERE id = ?',
    [id],
  );
  return rows[0];
}
