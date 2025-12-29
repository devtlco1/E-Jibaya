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

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

if (fs.existsSync(envProdPath)) {
  dotenv.config({ path: envProdPath, override: true });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ خطأ: يجب إعداد VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * قراءة جميع البيانات من ملف CSV
 */
function readAllRecords() {
  const csvFile = path.join(__dirname, '../DATA/collection_records_ready.csv');
  
  if (!fs.existsSync(csvFile)) {
    console.error(`❌ الملف غير موجود: ${csvFile}`);
    process.exit(1);
  }
  
  console.log('📖 قراءة جميع البيانات من ملف CSV...\n');
  
  const content = fs.readFileSync(csvFile, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  
  // تخطي السطر الأول (header)
  const dataLines = lines.slice(1);
  
  const records = [];
  let errorCount = 0;
  
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) continue;
    
    try {
      // تقسيم CSV بشكل صحيح
      const values = [];
      let currentValue = '';
      let insideQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const nextChar = line[j + 1];
        
        if (char === '"') {
          if (insideQuotes && nextChar === '"') {
            currentValue += '"';
            j++;
          } else {
            insideQuotes = !insideQuotes;
          }
        } else if (char === ',' && !insideQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim());
      
      if (values.length >= 6) {
        records.push({
          account_number: values[0] || null,
          subscriber_name: values[1] || null,
          region: values[2] || null,
          meter_number: values[3] || null,
          category: values[4] || null,
          last_reading: values[5] || null,
          status: 'pending',
          is_refused: false
        });
      } else {
        errorCount++;
      }
    } catch (error) {
      errorCount++;
    }
  }
  
  console.log(`✅ تم قراءة ${records.length} سجل`);
  if (errorCount > 0) {
    console.log(`   ⚠️  تم تخطي ${errorCount} صف بسبب أخطاء`);
  }
  console.log('');
  
  return records;
}

/**
 * رفع جميع البيانات إلى قاعدة البيانات
 */
async function importAllRecords() {
  console.log('🚀 بدء رفع جميع البيانات إلى قاعدة البيانات...\n');
  console.log('='.repeat(60));
  console.log('');
  
  try {
    // قراءة البيانات
    const records = readAllRecords();
    
    if (records.length === 0) {
      console.error('❌ لا توجد بيانات للرفع');
      process.exit(1);
    }
    
    // رفع البيانات على دفعات
    const batchSize = 1000;
    let uploadedCount = 0;
    let errorCount = 0;
    const totalBatches = Math.ceil(records.length / batchSize);
    
    console.log(`📤 رفع ${records.length} سجل على ${totalBatches} دفعة...\n`);
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      try {
        const { data, error } = await supabase
          .from('collection_records')
          .insert(batch)
          .select('id');
        
        if (error) {
          console.error(`   ❌ خطأ في الدفعة ${batchNumber}/${totalBatches}:`, error.message);
          errorCount += batch.length;
        } else {
          uploadedCount += data.length;
          console.log(`   ✅ الدفعة ${batchNumber}/${totalBatches}: تم رفع ${data.length} سجل (إجمالي: ${uploadedCount}/${records.length})`);
        }
        
        // تأخير صغير لتجنب الضغط على API
        if (i + batchSize < records.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`   ❌ خطأ غير متوقع في الدفعة ${batchNumber}/${totalBatches}:`, error.message);
        errorCount += batch.length;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 ملخص العملية:');
    console.log(`   ✅ تم رفع: ${uploadedCount} سجل`);
    if (errorCount > 0) {
      console.log(`   ❌ فشل رفع: ${errorCount} سجل`);
    }
    console.log('='.repeat(60));
    console.log('\n✅ اكتملت العملية!\n');
    
  } catch (error) {
    console.error('\n❌ خطأ في العملية:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// تشغيل الرفع
importAllRecords();

