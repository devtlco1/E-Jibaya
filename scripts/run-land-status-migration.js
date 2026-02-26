#!/usr/bin/env node
/**
 * تشغيل migration إضافة حقل حالة الارض (land_status)
 * 
 * استخدم أحد الطرق:
 * 1. أضف في .env: DATABASE_URL="postgresql://postgres.[project-ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres"
 *    (من Supabase Dashboard → Project Settings → Database → Connection string → URI)
 * 2. أو نفّذ add_land_status_migration.sql يدوياً في Supabase SQL Editor
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
  console.error('   من Supabase: Project Settings → Database → Connection string → URI');
  console.error('   مثال: postgresql://postgres.xxx:[PASSWORD]@aws-0-xx.pooler.supabase.com:6543/postgres');
  process.exit(1);
}

const sqlPath = path.join(__dirname, '../add_land_status_migration.sql');
const sql = readFileSync(sqlPath, 'utf8');

async function run() {
  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    console.log('✓ اتصال بقاعدة البيانات...');
    await client.query(sql);
    console.log('✓ تم تنفيذ migration إضافة land_status بنجاح');
  } catch (err) {
    console.error('❌ خطأ:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
