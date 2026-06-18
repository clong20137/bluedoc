const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

async function createConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });
}

async function ensureDocumentColumns(connection) {
  const databaseName = process.env.DB_NAME || 'bluedoc';
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = 'documents'`,
    [databaseName]
  );
  const existingColumns = new Set(rows.map((row) => row.COLUMN_NAME));
  const requiredColumns = [
    ['description', 'TEXT NULL'],
    ['original_file_name', 'VARCHAR(255) NULL'],
    ['stored_file_name', 'VARCHAR(255) NULL'],
    ['file_path', 'VARCHAR(500) NULL'],
    ['mime_type', 'VARCHAR(120) NULL'],
    ['file_size', 'BIGINT NULL'],
    ['uploaded_by', 'VARCHAR(160) NULL'],
    ['content_html', 'LONGTEXT NULL'],
    ['baseline_content_html', 'LONGTEXT NULL'],
    ['content_updated_by', 'VARCHAR(160) NULL'],
    ['content_updated_at', 'TIMESTAMP NULL'],
    ['published_at', 'TIMESTAMP NULL'],
    ['published_by', 'VARCHAR(160) NULL']
  ];

  for (const [columnName, definition] of requiredColumns) {
    if (!existingColumns.has(columnName)) {
      await connection.query(`ALTER TABLE documents ADD COLUMN \`${columnName}\` ${definition}`);
    }
  }
}

async function initializeDatabase(options = {}) {
  const connection = await createConnection();

  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await connection.query(schemaSql);
    await ensureDocumentColumns(connection);

    if (options.seed) {
      const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
      await connection.query(seedSql);
    }
  } finally {
    await connection.end();
  }
}

module.exports = {
  initializeDatabase
};
