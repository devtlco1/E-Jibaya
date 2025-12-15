import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdf from 'pdf-parse';
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

/**
 * استخراج أرقام الحسابات والمقاييس من نص PDF
 */
function extractAccountAndMeterNumbers(text) {
  const records = [];
  const seen = new Set();
  
  // البحث عن جميع أرقام الحسابات (12 رقم) في النص
  // نمط: 12 رقم متتالي يبدأ بـ 34
  const accountNumberPattern = /\b(34\d{10})\b/g;
  const accountNumbers = [];
  let match;
  
  while ((match = accountNumberPattern.exec(text)) !== null) {
    accountNumbers.push({
      number: match[1],
      index: match.index
    });
  }
  
  console.log(`   🔍 تم العثور على ${accountNumbers.length} رقم حساب محتمل`);
  
  // لكل رقم حساب، البحث عن رقم المقياس القريب
  for (const account of accountNumbers) {
    const accountNumber = account.number;
    
    // البحث في نطاق 200 حرف بعد رقم الحساب
    const searchStart = account.index;
    const searchEnd = Math.min(searchStart + 200, text.length);
    const searchText = text.substring(searchStart, searchEnd);
    
    // البحث عن أرقام المقاييس (5-8 أرقام) في النطاق
    // رقم المقياس عادة يكون بعد رقم الحساب بعدة أرقام
    const meterPattern = /\b(\d{5,8})\b/g;
    const meters = [];
    let meterMatch;
    
    while ((meterMatch = meterPattern.exec(searchText)) !== null) {
      const meterNum = meterMatch[1];
      // التأكد أنه ليس رقم الحساب أو جزء منه
      if (meterNum !== accountNumber && 
          !accountNumber.includes(meterNum) &&
          meterNum.length >= 5) {
        meters.push(meterNum);
      }
    }
    
    // أخذ أول رقم مقياس صالح (عادة يكون الثاني أو الثالث)
    if (meters.length > 0) {
      // تجربة الأرقام المختلفة
      for (const meterNumber of meters.slice(0, 3)) {
        const key = `${accountNumber}_${meterNumber}`;
        if (!seen.has(key)) {
          seen.add(key);
          records.push({
            accountNumber,
            meterNumber
          });
          break; // نأخذ أول رقم مقياس صالح
        }
      }
    }
  }
  
  // محاولة أخرى: البحث عن نمط جدول مباشر
  // نمط: رقم حساب (12 رقم) متبوع بأرقام ثم رقم مقياس (5-8 أرقام)
  const tablePattern = /\b(34\d{10})\b[\s\d]{0,50}?\b(\d{5,8})\b/g;
  let tableMatch;
  
  while ((tableMatch = tablePattern.exec(text)) !== null) {
    const accountNumber = tableMatch[1];
    const meterNumber = tableMatch[2];
    
    // التأكد أنه ليس رقم الحساب
    if (meterNumber !== accountNumber && 
        !accountNumber.includes(meterNumber)) {
      const key = `${accountNumber}_${meterNumber}`;
      if (!seen.has(key)) {
        seen.add(key);
        records.push({
          accountNumber,
          meterNumber
        });
      }
    }
  }
  
  console.log(`   ✅ تم استخراج ${records.length} سجل فريد`);
  
  return records;
}

/**
 * قراءة ملف PDF واستخراج البيانات
 */
async function readPDF(filePath) {
  try {
    console.log(`📄 قراءة ملف: ${filePath}`);
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    console.log(`✅ تم قراءة الملف بنجاح (${data.numpages} صفحة)`);
    return data.text;
  } catch (error) {
    console.error(`❌ خطأ في قراءة الملف ${filePath}:`, error.message);
    return null;
  }
}

/**
 * جلب جميع السجلات الموجودة (رقم الحساب + رقم المقياس) من قاعدة البيانات
 * حتى نضيف فقط السجلات الناقصة
 */
async function getExistingRecordKeys() {
  console.log('🔎 جلب السجلات الموجودة من قاعدة البيانات للتحقق من التكرار...');
  const existingKeys = new Set();

  try {
    let from = 0;
    const limit = 1000;

    // قراءة على دفعات لتفادي حجم البيانات الكبير
    while (true) {
      const to = from + limit - 1;
      const { data, error } = await supabase
        .from('collection_records')
        .select('account_number, meter_number')
        .range(from, to);

      if (error) {
        console.error('❌ خطأ في جلب السجلات الموجودة:', error.message);
        break;
      }

      if (!data || data.length === 0) {
        break;
      }

      for (const row of data) {
        if (row.account_number && row.meter_number) {
          const key = `${row.account_number}_${row.meter_number}`;
          existingKeys.add(key);
        }
      }

      from += limit;
      if (data.length < limit) {
        break;
      }
    }

    console.log(`✅ تم جلب ${existingKeys.size} سجل موجود من قاعدة البيانات`);
  } catch (error) {
    console.error('❌ خطأ غير متوقع أثناء جلب السجلات الموجودة:', error.message);
  }

  return existingKeys;
}

/**
 * إضافة سجلات إلى قاعدة البيانات (فقط السجلات غير الموجودة)
 */
async function addRecordsToDatabase(records, existingKeys) {
  // تصفية السجلات الموجودة مسبقاً
  const newRecords = records.filter(record => {
    const key = `${record.accountNumber}_${record.meterNumber}`;
    return !existingKeys.has(key);
  });
  
  const duplicateCount = records.length - newRecords.length;
  
  console.log(`\n📊 بدء إضافة السجلات إلى قاعدة البيانات...`);
  console.log(`   📋 إجمالي السجلات: ${records.length}`);
  console.log(`   ⏭️  موجود مسبقاً: ${duplicateCount}`);
  console.log(`   ➕ جديد: ${newRecords.length}\n`);
  
  if (newRecords.length === 0) {
    console.log('✅ جميع السجلات موجودة مسبقاً، لا حاجة للإضافة!');
    return;
  }
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < newRecords.length; i++) {
    const record = newRecords[i];
    
    try {
      // إنشاء السجل الجديد
      const recordData = {
        account_number: record.accountNumber,
        meter_number: record.meterNumber,
        status: 'pending',
        is_refused: false,
        meter_photo_verified: false,
        invoice_photo_verified: false,
        verification_status: 'غير مدقق'
      };
      
      const { data, error } = await supabase
        .from('collection_records')
        .insert(recordData)
        .select()
        .single();
      
      if (error) {
        errorCount++;
        // عرض الأخطاء فقط كل 100 سجل لتقليل الإخراج
        if (errorCount % 100 === 0 || i === newRecords.length - 1) {
          console.error(`❌ ${i + 1}/${newRecords.length}: خطأ في إضافة السجل ${record.accountNumber}:`, error.message);
        }
      } else {
        successCount++;
        if ((i + 1) % 100 === 0 || i === newRecords.length - 1) {
          console.log(`✅ ${i + 1}/${newRecords.length}: تم إضافة ${successCount} سجل بنجاح`);
        }
      }
      
      // تأخير صغير لتجنب الضغط على قاعدة البيانات
      if (i % 50 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      errorCount++;
      if (errorCount % 100 === 0) {
        console.error(`❌ ${i + 1}/${newRecords.length}: خطأ غير متوقع:`, error.message);
      }
    }
  }
  
  console.log(`\n📈 ملخص العملية:`);
  console.log(`   ✅ تم إضافة: ${successCount} سجل`);
  console.log(`   ⏭️  موجود مسبقاً: ${duplicateCount} سجل`);
  console.log(`   ❌ أخطاء: ${errorCount} سجل`);
  console.log(`   📊 الإجمالي: ${records.length} سجل\n`);
}

/**
 * الدالة الرئيسية
 */
async function main() {
  console.log('🚀 بدء استيراد السجلات من ملفات PDF...\n');
  
  const dataDir = path.join(__dirname, '../DATA');
  const files = [
    path.join(dataDir, 'r80_rej.pdf'),
    path.join(dataDir, 'r80.pdf')
  ];
  
  let allRecords = [];
  
  for (const filePath of files) {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  الملف غير موجود: ${filePath}`);
      continue;
    }
    
    const text = await readPDF(filePath);
    if (!text) {
      continue;
    }
    
    const records = extractAccountAndMeterNumbers(text);
    console.log(`📋 تم استخراج ${records.length} سجل من ${path.basename(filePath)}`);
    allRecords.push(...records);
  }
  
  // إزالة التكرارات
  const uniqueRecords = [];
  const seen = new Set();
  
  for (const record of allRecords) {
    const key = `${record.accountNumber}_${record.meterNumber}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRecords.push(record);
    }
  }
  
  console.log(`\n📊 إجمالي السجلات المستخرجة: ${allRecords.length}`);
  console.log(`📊 السجلات الفريدة: ${uniqueRecords.length}\n`);
  
  if (uniqueRecords.length === 0) {
    console.log('⚠️  لم يتم العثور على أي سجلات للاستيراد');
    return;
  }

  // جلب السجلات الموجودة في قاعدة البيانات
  const existingKeys = await getExistingRecordKeys();

  // تصفية السجلات لاختيار السجلات التي لا توجد في قاعدة البيانات
  const recordsToInsert = uniqueRecords.filter(record => {
    const key = `${record.accountNumber}_${record.meterNumber}`;
    return !existingKeys.has(key);
  });

  console.log(`📊 السجلات الجديدة فقط (غير الموجودة في قاعدة البيانات): ${recordsToInsert.length}\n`);

  if (recordsToInsert.length === 0) {
    console.log('✅ لا توجد سجلات جديدة لإضافتها. جميع السجلات موجودة بالفعل.');
    return;
  }
  
  // إضافة السجلات الجديدة فقط إلى قاعدة البيانات
  await addRecordsToDatabase(uniqueRecords, existingKeys);
  
  console.log('✅ اكتملت العملية بنجاح!');
}

// تشغيل البرنامج
main().catch(error => {
  console.error('❌ خطأ في البرنامج:', error);
  process.exit(1);
});

