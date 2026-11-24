import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';

const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

try {
  const hasBootstrapValues = Boolean(name || email || password);
  const hasCompleteBootstrapValues = Boolean(name && email && password);

  if (!hasBootstrapValues) {
    console.log('Akun admin awal tidak dibuat: variabel bootstrap belum diatur.');
  } else if (!hasCompleteBootstrapValues) {
    console.error('Akun admin awal dilewati: ketiga variabel BOOTSTRAP_ADMIN_* harus diisi. Server tetap akan dijalankan.');
  } else if (password.length < 12) {
    console.error('Akun admin awal dilewati: sandi bootstrap harus minimal 12 karakter. Server tetap akan dijalankan.');
  } else {
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
