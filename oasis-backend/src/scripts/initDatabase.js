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
await connection.end();
console.log(`Database ${database} berhasil disiapkan.`);
