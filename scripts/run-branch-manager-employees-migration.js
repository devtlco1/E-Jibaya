#!/usr/bin/env node
/**
 * تشغيل migration إضافة جدول branch_manager_employees
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const p of ['.env', 'env.production', '.env.local']) {
  dotenv.config({ path: path.join(__dirname, '..', p) });
}

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.DIRECT_URL;
if (!databaseUrl) {
  console.error('❌ خطأ: يجب إضافة DATABASE_URL في ملف .env');
  process.exit(1);
}

const sqlPath = path.join(__dirname, '../add_branch_manager_employees.sql');
const sql = readFileSync(sqlPath, 'utf8');

async function run() {
  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    console.log('✓ اتصال بقاعدة البيانات...');
    await client.query(sql);
    console.log('✓ تم إنشاء جدول branch_manager_employees بنجاح');
  } catch (err) {
    console.error('❌ خطأ:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
