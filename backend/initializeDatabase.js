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
  await connection.query(`
    ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS description TEXT NULL,
      ADD COLUMN IF NOT EXISTS original_file_name VARCHAR(255) NULL,
      ADD COLUMN IF NOT EXISTS stored_file_name VARCHAR(255) NULL,
      ADD COLUMN IF NOT EXISTS file_path VARCHAR(500) NULL,
      ADD COLUMN IF NOT EXISTS mime_type VARCHAR(120) NULL,
      ADD COLUMN IF NOT EXISTS file_size BIGINT NULL,
      ADD COLUMN IF NOT EXISTS uploaded_by VARCHAR(160) NULL,
      ADD COLUMN IF NOT EXISTS published_at TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS published_by VARCHAR(160) NULL
  `);
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
