#!/usr/bin/env node
/**
 * حذف البيانات قبل ١٧ فبراير ٢٠٢٦ (فما دون)
 *
 * يحتاج DATABASE_URL في .env أو env.production:
 * postgresql://postgres.[project-ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
 *
 * أو نفّذ scripts/delete_data_before_feb17.sql يدوياً في Supabase SQL Editor
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

for (const p of ['.env', 'env.production', '.env.local']) {
  const envPath = path.join(__dirname, '..', p);
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
}

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.DIRECT_URL;

if (!databaseUrl) {
  console.error('❌ خطأ: يجب إضافة DATABASE_URL في ملف .env أو env.production');
  console.error('   من Supabase: Project Settings → Database → Connection string → URI');
  process.exit(1);
}

const sqlPath = path.join(__dirname, 'delete_data_before_feb17.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

async function run() {
  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    console.log('📦 اتصال بقاعدة البيانات...');
    await client.query(sql);
    console.log('✅ تم حذف البيانات قبل ١٧-٢-٢٠٢٦ بنجاح');
  } catch (err) {
    console.error('❌ خطأ:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
