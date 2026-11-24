import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';

const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

try {
  if (!name && !email && !password) {
    console.log('Akun admin awal tidak dibuat: variabel bootstrap belum diatur.');
  } else {
    if (!name || !email || !password) {
      throw new Error('BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, dan BOOTSTRAP_ADMIN_PASSWORD wajib diatur.');
    }
    if (password.length < 12) {
      throw new Error('Kata sandi admin awal harus minimal 12 karakter.');
    }

    const [users] = await pool.execute('SELECT id FROM users LIMIT 1');
    if (users.length > 0) {
      console.log('Akun admin awal dilewati: tabel users sudah berisi pengguna.');
    } else {
      const passwordHash = await bcrypt.hash(password, 12);
      const [result] = await pool.execute(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES (?, ?, ?, 'KEPALA_LABORATORIUM')`,
        [name, email, passwordHash],
      );
      console.log(`Akun KEPALA_LABORATORIUM awal berhasil dibuat (ID ${result.insertId}, ${email}).`);
    }
  }
} finally {
  await pool.end();
}
