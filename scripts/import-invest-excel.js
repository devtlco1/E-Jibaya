/**
 * استيراد من invest exal.xlsx — الأعمدة المطلوبة فقط:
 * الاسم، رقم الحساب، B_SECT→رقم السجل، رقم المقياس، b_facter→معامل الضرب، العنوان، القراءة السابقة
 * باقي الأعمدة تُهمل.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '../.env');
const envProdPath = path.join(__dirname, '../env.production');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
if (fs.existsSync(envProdPath)) dotenv.config({ path: envProdPath, override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ يحتاج VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في .env أو env.production');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const EXCEL_PATH = path.join(__dirname, '../invest exal.xlsx');

function readExcel() {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error('ملف invest exal.xlsx غير موجود في جذر المشروع');
  }
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: null });
}

function toStr(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function toNum(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function convertToRecords(rows) {
  const records = [];
  const errors = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const accountNumber = toStr(row['رقم الحساب']);
    const subscriberName = toStr(row['الاسم']);
    const meterNumber = toStr(row['رقم المقياس']);
    if (!accountNumber && !subscriberName && !meterNumber) continue;

    const recordNumber = toStr(row['B_SECT']) ?? null;
    const multiplier = toNum(row['b_facter']);
    const region = toStr(row['العنوان']);
    const lastReading = toStr(row['القراءة السابقة']);

    const now = new Date().toISOString();
    records.push({
      subscriber_name: subscriberName,
      account_number: accountNumber,
      record_number: recordNumber,
      meter_number: meterNumber,
      multiplier: multiplier != null ? String(multiplier) : null,
      region: region,
      district: null,
      last_reading: lastReading,
      status: 'pending',
      is_refused: false,
      submitted_at: now,
      updated_at: now,
      field_agent_id: null,
      gps_latitude: null,
      gps_longitude: null,
      meter_photo_url: null,
      invoice_photo_url: null,
      invoice_photo_back_url: null,
      notes: null,
      completed_by: null,
      new_zone: null,
      new_block: null,
      new_home: null,
      locked_by: null,
      locked_at: null,
      lock_expires_at: null,
      category: null,
      phase: null,
      meter_photo_verified: false,
      invoice_photo_verified: false,
      meter_photo_rejected: false,
      invoice_photo_rejected: false,
      verification_status: null,
      total_amount: null,
      current_amount: null,
    });
  }
  return { records, errors };
}

async function uploadRecords(records) {
  const batchSize = 1000;
  let uploaded = 0;
  let failed = 0;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase.from('collection_records').insert(batch).select();
    if (error) {
      console.error(`   ❌ دفعة ${Math.floor(i / batchSize) + 1}:`, error.message);
      failed += batch.length;
    } else {
      uploaded += batch.length;
      console.log(`   ✅ رفع ${uploaded}/${records.length}...`);
    }
  }
  return { uploaded, failed };
}

async function main() {
  console.log('📂 قراءة invest exal.xlsx (الأعمدة المطلوبة فقط)...\n');
  const rows = readExcel();
  console.log(`   عدد الصفوف: ${rows.length}\n`);

  const { records } = convertToRecords(rows);
  console.log(`   سجلات جاهزة للرفع: ${records.length}\n`);

  if (records.length === 0) {
    console.log('   لا توجد صفوف تحتوي على (رقم الحساب أو الاسم أو رقم المقياس).');
    return;
  }

  console.log('📤 رفع السجلات إلى قاعدة البيانات...\n');
  const { uploaded, failed } = await uploadRecords(records);
  console.log(`\n✅ انتهى: رفع ${uploaded}، فشل ${failed}\n`);
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
