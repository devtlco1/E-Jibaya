import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdf from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// تحميل متغيرات البيئة
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

// أيضاً محاولة تحميل من .env.production إذا كان موجوداً
const envProdPath = path.join(__dirname, '../.env.production');
if (fs.existsSync(envProdPath)) {
  dotenv.config({ path: envProdPath, override: false });
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
  
  // نمط للبحث عن أرقام الحسابات (12 رقم) وأرقام المقاييس
  // بناءً على البيانات في الملف: رقم الحساب (12 رقم) ورقم المقياس
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // البحث عن أرقام الحسابات (12 رقم متتالي) - يبدأ بـ 341 أو 345
    const accountNumberMatch = line.match(/\b(34[0-9]{10})\b/);
    
    if (accountNumberMatch) {
      const accountNumber = accountNumberMatch[1];
      
      // البحث عن رقم المقياس في نفس السطر
      // رقم المقياس عادة يكون 5-6 أرقام أو أكثر
      let meterNumber = null;
      
      // تقسيم السطر إلى أجزاء للبحث بشكل أفضل
      const parts = line.split(/\s+/);
      
      // البحث عن رقم المقياس في الأجزاء
      for (const part of parts) {
        // رقم المقياس عادة يكون بين 5-8 أرقام
        const meterMatch = part.match(/\b(\d{5,8})\b/);
        if (meterMatch) {
          const potentialMeter = meterMatch[1];
          // التأكد أنه ليس رقم الحساب
          if (potentialMeter !== accountNumber && 
              potentialMeter.length >= 5 && 
              potentialMeter.length <= 8) {
            meterNumber = potentialMeter;
            break;
          }
        }
      }
      
      // إذا لم نجد في نفس السطر، نبحث في السطر التالي
      if (!meterNumber && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        const nextLineParts = nextLine.split(/\s+/);
        
        for (const part of nextLineParts) {
          const meterMatch = part.match(/\b(\d{5,8})\b/);
          if (meterMatch) {
            const potentialMeter = meterMatch[1];
            if (potentialMeter !== accountNumber && 
                potentialMeter.length >= 5 && 
                potentialMeter.length <= 8) {
              meterNumber = potentialMeter;
              break;
            }
          }
        }
      }
      
      // محاولة أخرى: البحث عن نمط جدول (رقم حساب متبوع برقم مقياس)
      if (!meterNumber) {
        // نمط: رقم حساب ثم رقم مقياس في نفس السطر
        const tablePattern = new RegExp(`\\b${accountNumber}\\b\\s+\\d+\\s+\\d+\\s+\\d+\\s+\\d+\\s+\\b(\\d{5,8})\\b`, 'g');
        const tableMatch = line.match(tablePattern);
        if (tableMatch) {
          const extracted = tableMatch[0].match(/\b(\d{5,8})\b/);
          if (extracted && extracted.length > 1) {
            meterNumber = extracted[1];
          }
        }
      }
      
      if (accountNumber && meterNumber) {
        // التحقق من صحة البيانات
        // رقم الحساب يجب أن يكون 12 رقم
        if (accountNumber.length === 12) {
          // تجنب التكرار
          const exists = records.find(r => r.accountNumber === accountNumber && r.meterNumber === meterNumber);
          if (!exists) {
            records.push({
              accountNumber,
              meterNumber
            });
          }
        }
      }
    }
  }
  
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
 * إضافة سجلات إلى قاعدة البيانات
 */
async function addRecordsToDatabase(records) {
  console.log(`\n📊 بدء إضافة ${records.length} سجل إلى قاعدة البيانات...\n`);
  
  let successCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;
  
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    
    try {
      // التحقق من وجود السجل مسبقاً
      const { data: existing } = await supabase
        .from('collection_records')
        .select('id')
        .eq('account_number', record.accountNumber)
        .eq('meter_number', record.meterNumber)
        .limit(1);
      
      if (existing && existing.length > 0) {
        duplicateCount++;
        console.log(`⏭️  ${i + 1}/${records.length}: السجل موجود مسبقاً - ${record.accountNumber} / ${record.meterNumber}`);
        continue;
      }
      
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
        console.error(`❌ ${i + 1}/${records.length}: خطأ في إضافة السجل ${record.accountNumber}:`, error.message);
      } else {
        successCount++;
        if ((i + 1) % 10 === 0 || i === records.length - 1) {
          console.log(`✅ ${i + 1}/${records.length}: تم إضافة السجل بنجاح - ${record.accountNumber} / ${record.meterNumber}`);
        }
      }
      
      // تأخير صغير لتجنب الضغط على قاعدة البيانات
      if (i % 50 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      errorCount++;
      console.error(`❌ ${i + 1}/${records.length}: خطأ غير متوقع:`, error.message);
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
  
  // إضافة السجلات إلى قاعدة البيانات
  await addRecordsToDatabase(uniqueRecords);
  
  console.log('✅ اكتملت العملية بنجاح!');
}

// تشغيل البرنامج
main().catch(error => {
  console.error('❌ خطأ في البرنامج:', error);
  process.exit(1);
});

