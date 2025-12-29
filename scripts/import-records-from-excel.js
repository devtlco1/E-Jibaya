import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// تحميل متغيرات البيئة
const envPath = path.join(__dirname, '../.env');
const envProdPath = path.join(__dirname, '../env.production');

// محاولة تحميل من .env أولاً
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// ثم محاولة تحميل من env.production إذا كان موجوداً
if (fs.existsSync(envProdPath)) {
  dotenv.config({ path: envProdPath, override: true });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ خطأ: يجب إعداد VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في ملف .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// جدول تحويل الأصناف من رقم إلى نص
const categoryMapping = {
  0: null, // بدون صنف
  1: 'حكومي',
  2: 'حكومي',
  4: 'صناعي',
  5: 'صناعي',
  6: 'صناعي',
  7: 'صناعي',
  8: 'حكومي',
  9: 'تجاري',
  17: 'صناعي',
  19: 'تجاري',
  21: 'منزلي',
  22: 'زراعي',
  23: 'حكومي',
  24: 'تجاري',
  26: 'منزلي',
  27: 'منزلي',
  28: 'منزلي',
  29: 'منزلي',
  33: 'تجاري',
  39: 'منزلي',
  101: 'حكومي',
  102: 'حكومي',
  104: 'صناعي',
  105: 'صناعي',
  106: 'صناعي',
  107: 'صناعي',
  108: 'حكومي'
};

/**
 * تحويل رقم الصنف إلى نص الصنف
 */
function convertCategoryCode(code) {
  if (code === null || code === undefined || code === '') {
    return null;
  }
  
  const numCode = typeof code === 'string' ? parseInt(code, 10) : code;
  
  if (isNaN(numCode)) {
    return null;
  }
  
  return categoryMapping[numCode] || null;
}

/**
 * حذف جميع السجلات من قاعدة البيانات
 */
async function deleteAllRecords() {
  console.log('🗑️  بدء حذف جميع السجلات من قاعدة البيانات...\n');
  
  try {
    // حذف السجلات المرتبطة أولاً
    console.log('   📋 حذف سجلات التغييرات...');
    const { error: changesError } = await supabase
      .from('record_changes_log')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // حذف الكل
    
    if (changesError) {
      console.warn('   ⚠️  تحذير في حذف سجلات التغييرات:', changesError.message);
    }
    
    console.log('   📸 حذف الصور الإضافية...');
    const { error: photosError } = await supabase
      .from('record_photos')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (photosError) {
      console.warn('   ⚠️  تحذير في حذف الصور:', photosError.message);
    }
    
    console.log('   📍 حذف المواقع...');
    const { error: locationsError } = await supabase
      .from('record_locations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (locationsError) {
      console.warn('   ⚠️  تحذير في حذف المواقع:', locationsError.message);
    }
    
    console.log('   📝 حذف سجلات النشاط...');
    const { error: activityError } = await supabase
      .from('activity_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (activityError) {
      console.warn('   ⚠️  تحذير في حذف سجلات النشاط:', activityError.message);
    }
    
    console.log('   🗂️  حذف السجلات الرئيسية...');
    
    // حذف السجلات على دفعات لتجنب timeout
    let deletedCount = 0;
    let hasMore = true;
    const batchSize = 1000;
    
    while (hasMore) {
      // جلب دفعة من السجلات
      const { data: records, error: fetchError } = await supabase
        .from('collection_records')
        .select('id')
        .limit(batchSize);
      
      if (fetchError) {
        throw new Error(`خطأ في جلب السجلات: ${fetchError.message}`);
      }
      
      if (!records || records.length === 0) {
        hasMore = false;
        break;
      }
      
      // حذف الدفعة
      const ids = records.map(r => r.id);
      const { error: deleteError } = await supabase
        .from('collection_records')
        .delete()
        .in('id', ids);
      
      if (deleteError) {
        throw new Error(`خطأ في حذف السجلات: ${deleteError.message}`);
      }
      
      deletedCount += records.length;
      console.log(`   ✅ تم حذف ${deletedCount} سجل...`);
      
      if (records.length < batchSize) {
        hasMore = false;
      }
    }
    
    console.log(`\n✅ تم حذف جميع السجلات بنجاح (${deletedCount} سجل)\n`);
    return true;
  } catch (error) {
    console.error('❌ خطأ في حذف السجلات:', error.message);
    throw error;
  }
}

/**
 * قراءة ملف Excel وتحويله إلى بيانات
 */
function readExcelFile(filePath) {
  console.log(`📖 قراءة ملف Excel: ${filePath}\n`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`الملف غير موجود: ${filePath}`);
  }
  
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0]; // أول sheet
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { defval: null });
  
  console.log(`   📊 تم قراءة ${data.length} صف من ملف Excel\n`);
  
  return data;
}

/**
 * تحويل بيانات Excel إلى تنسيق قاعدة البيانات
 */
function convertExcelDataToRecords(excelData) {
  console.log('🔄 تحويل بيانات Excel إلى تنسيق قاعدة البيانات...\n');
  
  const records = [];
  const errors = [];
  
  for (let i = 0; i < excelData.length; i++) {
    const row = excelData[i];
    
    try {
      // استخراج البيانات من الصف
      const accountNumber = row['رقم الحساب']?.toString().trim() || null;
      const subscriberName = row['الاسم']?.toString().trim() || null;
      const region = row['العنوان']?.toString().trim() || null;
      const meterNumber = row['رقم المقياس']?.toString().trim() || null;
      const categoryCode = row['الصنف'] !== undefined ? row['الصنف'] : null;
      const lastReading = row['القراءة السابقة']?.toString().trim() || null;
      
      // تخطي الصفوف الفارغة
      if (!accountNumber && !subscriberName && !meterNumber) {
        continue;
      }
      
      // تحويل الصنف
      const category = convertCategoryCode(categoryCode);
      
      // إنشاء السجل
      const record = {
        account_number: accountNumber,
        subscriber_name: subscriberName,
        region: region,
        meter_number: meterNumber,
        category: category,
        last_reading: lastReading,
        status: 'pending',
        is_refused: false,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        field_agent_id: null, // سيتم تعيينه لاحقاً
        gps_latitude: null,
        gps_longitude: null,
        meter_photo_url: null,
        invoice_photo_url: null,
        notes: null,
        completed_by: null,
        new_zone: null,
        new_block: null,
        new_home: null,
        locked_by: null,
        locked_at: null,
        lock_expires_at: null,
        phase: null,
        multiplier: null,
        meter_photo_verified: false,
        invoice_photo_verified: false,
        meter_photo_rejected: false,
        invoice_photo_rejected: false,
        verification_status: null,
        total_amount: null,
        current_amount: null
      };
      
      records.push(record);
    } catch (error) {
      errors.push({
        row: i + 2, // +2 لأن الصف الأول هو header و i يبدأ من 0
        error: error.message,
        data: row
      });
    }
  }
  
  console.log(`   ✅ تم تحويل ${records.length} سجل`);
  if (errors.length > 0) {
    console.log(`   ⚠️  ${errors.length} صف به أخطاء`);
    errors.forEach(err => {
      console.log(`      - الصف ${err.row}: ${err.error}`);
    });
  }
  console.log('');
  
  return { records, errors };
}

/**
 * رفع السجلات إلى قاعدة البيانات
 */
async function uploadRecords(records) {
  console.log(`📤 بدء رفع ${records.length} سجل إلى قاعدة البيانات...\n`);
  
  const batchSize = 1000;
  let uploadedCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    try {
      const { data, error } = await supabase
        .from('collection_records')
        .insert(batch)
        .select();
      
      if (error) {
        console.error(`   ❌ خطأ في رفع الدفعة ${Math.floor(i / batchSize) + 1}:`, error.message);
        errorCount += batch.length;
      } else {
        uploadedCount += batch.length;
        console.log(`   ✅ تم رفع ${uploadedCount}/${records.length} سجل...`);
      }
    } catch (error) {
      console.error(`   ❌ خطأ غير متوقع في رفع الدفعة ${Math.floor(i / batchSize) + 1}:`, error.message);
      errorCount += batch.length;
    }
  }
  
  console.log(`\n✅ تم رفع ${uploadedCount} سجل بنجاح`);
  if (errorCount > 0) {
    console.log(`⚠️  فشل رفع ${errorCount} سجل`);
  }
  console.log('');
  
  return { uploadedCount, errorCount };
}

/**
 * الدالة الرئيسية
 */
async function main() {
  console.log('🚀 بدء استيراد البيانات من ملف Excel\n');
  console.log('='.repeat(60));
  console.log('');
  
  try {
    // 1. حذف جميع السجلات
    await deleteAllRecords();
    
    // 2. قراءة ملف Excel
    const excelFilePath = path.join(__dirname, '../DATA/invest --.xlsx');
    const excelData = readExcelFile(excelFilePath);
    
    // 3. تحويل البيانات
    const { records, errors } = convertExcelDataToRecords(excelData);
    
    if (records.length === 0) {
      console.log('⚠️  لا توجد سجلات للرفع');
      return;
    }
    
    // 4. رفع السجلات
    const { uploadedCount, errorCount } = await uploadRecords(records);
    
    // 5. ملخص
    console.log('='.repeat(60));
    console.log('📊 ملخص العملية:');
    console.log(`   ✅ تم رفع: ${uploadedCount} سجل`);
    if (errorCount > 0) {
      console.log(`   ❌ فشل رفع: ${errorCount} سجل`);
    }
    if (errors.length > 0) {
      console.log(`   ⚠️  أخطاء في التحويل: ${errors.length} صف`);
    }
    console.log('='.repeat(60));
    console.log('\n✅ اكتملت العملية بنجاح!\n');
    
  } catch (error) {
    console.error('\n❌ خطأ في العملية:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// تشغيل السكريبت
main();


