/**
 * سكربت نسخ احتياطي لقاعدة البيانات
 * يحفظ كل الجداول في مجلد backup/database_backup_YYYY-MM-DD_HH-MM/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// تحميل متغيرات البيئة
const envPath = path.join(__dirname, '../.env');
const envProdPath = path.join(__dirname, '../env.production');

if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
if (fs.existsSync(envProdPath)) dotenv.config({ path: envProdPath, override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ خطأ: يجب إعداد VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY (أو SUPABASE_SERVICE_ROLE_KEY) في ملف .env أو env.production');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const BATCH_SIZE = 1000;

/** جلب كل الصفوف من جدول (مع pagination) */
async function fetchTable(tableName) {
  const all = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + BATCH_SIZE - 1);

    if (error) {
      console.warn(`⚠️ تحذير: ${tableName} - ${error.message}`);
      return { data: [], error: error.message };
    }

    if (!data || data.length === 0) break;
    all.push(...data);
    from += BATCH_SIZE;
    if (data.length < BATCH_SIZE) hasMore = false;
  }

  return { data: all, error: null };
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(__dirname, '../backup', `database_backup_${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  console.log('📦 بدء النسخ الاحتياطي لقاعدة البيانات...');
  console.log(`📁 المجلد: ${backupDir}\n`);

  const tables = [
    'users',
    'collection_records',
    'record_photos',
    'record_locations',
    'activity_logs',
    'record_changes_log',
    'user_sessions',
    'backup_info',
    'backup_logs',
    'branch_manager_employees',
    'branch_manager_field_agents',
    'photos',
  ];

  const manifest = { created_at: new Date().toISOString(), tables: {} };

  for (const table of tables) {
    process.stdout.write(`  جاري: ${table}... `);
    const { data, error } = await fetchTable(table);

    if (error) {
      console.log(`❌ ${error}`);
      manifest.tables[table] = { count: 0, error };
      continue;
    }

    const filePath = path.join(backupDir, `${table}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 0), 'utf8');
    manifest.tables[table] = { count: data.length };
    console.log(`✅ ${data.length} صف`);
  }

  fs.writeFileSync(
    path.join(backupDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  const totalRows = Object.values(manifest.tables).reduce((s, t) => s + (t.count || 0), 0);
  console.log(`\n✅ انتهى النسخ الاحتياطي: ${totalRows} صف في ${backupDir}`);
}

main().catch((err) => {
  console.error('❌ خطأ:', err);
  process.exit(1);
});
