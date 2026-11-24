import 'dotenv/config';
import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';

const host = process.env.DB_HOST || '127.0.0.1';
const port = Number(process.env.DB_PORT || 3306);
const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const database = process.env.DB_NAME || 'oasis';

const connection = await mysql.createConnection({ host, port, user, password, multipleStatements: true });
await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
await connection.changeUser({ database });
const sql = await fs.readFile(new URL('../../database/schema.sql', import.meta.url), 'utf8');
await connection.query(sql);
await connection.query(
  `ALTER TABLE approvals
   MODIFY COLUMN approver_role ENUM('DOSEN_PENGAMPU','LABORAN','KEPALA_LABORATORIUM') NOT NULL`,
);
await connection.query(
  `ALTER TABLE equipment_units
   MODIFY COLUMN availability_status ENUM('TERSEDIA','DIPESAN','DIPINJAM','TIDAK_TERSEDIA') NOT NULL DEFAULT 'TERSEDIA'`,
);
for (const table of ['room_bookings', 'equipment_loans']) {
  for (const column of ['borrower_name', 'borrower_email']) {
    const [existingColumns] = await connection.execute(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [database, table, column],
    );
    if (existingColumns.length === 0) {
      await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` VARCHAR(150) NULL`);
    }
  }
}
await connection.query(
  `UPDATE equipment_units eu
   JOIN loan_items li ON li.unit_id = eu.id
   JOIN equipment_loans el ON el.id = li.loan_id
   SET eu.availability_status = CASE
     WHEN el.status = 'SEDANG_DIPINJAM' THEN 'DIPINJAM'
     ELSE 'DIPESAN'
   END
   WHERE eu.availability_status = 'TERSEDIA'
   AND eu.condition_status = 'BAIK'
   AND el.status IN ('MENUNGGU_DOSEN','MENUNGGU_LABORAN','DISETUJUI','SEDANG_DIPINJAM')`,
);
await connection.end();
console.log(`Database ${database} berhasil disiapkan.`);
