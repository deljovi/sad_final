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
const starterInventory = [
  { name: 'Kamera', category: 'BIASA', prefix: 'KAM', quantity: 10 },
  { name: 'VR Headset', category: 'KHUSUS', prefix: 'VRH', quantity: 6 },
  { name: 'Router Kit', category: 'BIASA', prefix: 'RTR', quantity: 19 },
];
const [inventorySeedRows] = await connection.execute(
  'SELECT name FROM app_migrations WHERE name = ?',
  ['starter-inventory'],
);
if (inventorySeedRows.length === 0) {
  for (const item of starterInventory) {
    await connection.execute(
      `INSERT INTO equipment_types (name, category)
       SELECT ?, ? WHERE NOT EXISTS (
         SELECT 1 FROM equipment_types WHERE name = ?
       )`,
      [item.name, item.category, item.name],
    );
    const [typeRows] = await connection.execute(
      'SELECT id FROM equipment_types WHERE name = ? ORDER BY id LIMIT 1',
      [item.name],
    );
    if (!typeRows[0]) {
      throw new Error(`Jenis alat ${item.name} tidak dapat disiapkan.`);
    }
    const typeId = typeRows[0].id;
    await connection.execute(
      'UPDATE equipment_types SET category = ?, active = TRUE WHERE id = ?',
      [item.category, typeId],
    );
    const [unitCounts] = await connection.execute(
      `SELECT COUNT(*) AS total FROM equipment_units
       WHERE equipment_type_id = ? AND availability_status = 'TERSEDIA'
       AND condition_status = 'BAIK'`,
      [typeId],
    );
    const [existingCodes] = await connection.execute(
      'SELECT unit_code FROM equipment_units WHERE unit_code LIKE ?',
      [`${item.prefix}-%`],
    );
    const usedCodes = new Set(existingCodes.map((unit) => String(unit.unit_code).toUpperCase()));
    let available = Number(unitCounts[0].total);
    let serial = 1;
    while (available < item.quantity) {
      let unitCode = `${item.prefix}-${String(serial).padStart(3, '0')}`;
      while (usedCodes.has(unitCode.toUpperCase())) {
        serial += 1;
        unitCode = `${item.prefix}-${String(serial).padStart(3, '0')}`;
      }
      serial += 1;
      const [result] = await connection.execute(
        `INSERT INTO equipment_units (equipment_type_id, unit_code)
         SELECT ?, ? WHERE NOT EXISTS (
           SELECT 1 FROM equipment_units WHERE unit_code = ?
         )`,
        [typeId, unitCode, unitCode],
      );
      usedCodes.add(unitCode.toUpperCase());
      available += result.affectedRows;
    }
  }
  await connection.execute(
    'INSERT INTO app_migrations (name) VALUES (?)',
    ['starter-inventory'],
  );
}
await connection.end();
console.log(`Database ${database} berhasil disiapkan.`);
