#!/usr/bin/env node
/**
 * تشغيل دالة trim_activity_logs يدوياً (حذف أقدم الحركات والإبقاء على ٥٠٠٠)
 * يحتاج DATABASE_URL في .env
 */

import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const p of ['.env', 'env.production', '.env.local']) {
  const envPath = path.join(__dirname, '..', p);
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
}

const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.DIRECT_URL;
if (!databaseUrl) {
  console.error('❌ يحتاج DATABASE_URL في .env');
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });
try {
  await client.connect();
  const { rows } = await client.query('SELECT public.trim_activity_logs(5000) as deleted');
  console.log('✅ تم حذف', rows[0].deleted, 'حركة قديمة. المتبقي: آخر ٥٠٠٠ حركة.');
} catch (err) {
  console.error('❌', err.message);
  process.exit(1);
} finally {
  await client.end();
}
