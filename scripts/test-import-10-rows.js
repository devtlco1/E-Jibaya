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
 * قراءة أول 10 صفوف من ملف CSV المحول
 */
function readFirst10Rows() {
  const csvFile = path.join(__dirname, '../DATA/collection_records_ready.csv');
  
  if (!fs.existsSync(csvFile)) {
    console.error(`❌ الملف غير موجود: ${csvFile}`);
    process.exit(1);
  }
  
  console.log('📖 قراءة أول 10 صفوف من ملف CSV...\n');
  
  const content = fs.readFileSync(csvFile, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  
  // تخطي السطر الأول (header) وأخذ أول 10 صفوف
  const dataLines = lines.slice(1, 11);
  
  const records = [];
  
  for (const line of dataLines) {
    const values = line.split(',');
    
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
    }
  }
  
  console.log(`✅ تم قراءة ${records.length} سجل\n`);
  console.log('📋 عينة من البيانات:\n');
  records.slice(0, 3).forEach((record, idx) => {
    console.log(`   [${idx + 1}]`);
    console.log(`      account_number: ${record.account_number}`);
    console.log(`      subscriber_name: ${record.subscriber_name}`);
    console.log(`      region: ${record.region}`);
    console.log(`      meter_number: ${record.meter_number}`);
    console.log(`      category: ${record.category}`);
    console.log(`      last_reading: ${record.last_reading}`);
    console.log('');
  });
  
  return records;
}

/**
 * رفع 10 سطور تجريبية إلى قاعدة البيانات
 */
async function testImport10Rows() {
  console.log('🧪 اختبار رفع 10 سطور إلى قاعدة البيانات...\n');
  console.log('='.repeat(60));
  console.log('');
  
  try {
    // قراءة البيانات
    const records = readFirst10Rows();
    
    // رفع البيانات
    console.log('📤 رفع البيانات إلى Supabase...\n');
    
    const { data, error } = await supabase
      .from('collection_records')
      .insert(records)
      .select();
    
    if (error) {
      console.error('❌ خطأ في الرفع:', error.message);
      console.error('   التفاصيل:', JSON.stringify(error, null, 2));
      process.exit(1);
    }
    
    console.log('✅ تم رفع البيانات بنجاح!\n');
    console.log(`   ✅ تم رفع ${data.length} سجل\n`);
    
    // التحقق من البيانات المرفوعة
    console.log('🔍 التحقق من البيانات المرفوعة...\n');
    
    const { data: insertedData, error: fetchError } = await supabase
      .from('collection_records')
      .select('account_number, subscriber_name, region, meter_number, category, last_reading')
      .in('account_number', records.map(r => r.account_number))
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (fetchError) {
      console.error('❌ خطأ في جلب البيانات:', fetchError.message);
    } else {
      console.log(`✅ تم جلب ${insertedData.length} سجل من قاعدة البيانات\n`);
      console.log('📋 البيانات المرفوعة:\n');
      
      insertedData.forEach((record, idx) => {
        console.log(`   [${idx + 1}]`);
        console.log(`      account_number: ${record.account_number}`);
        console.log(`      subscriber_name: "${record.subscriber_name}"`);
        console.log(`      region: "${record.region}"`);
        console.log(`      meter_number: ${record.meter_number}`);
        console.log(`      category: "${record.category}"`);
        console.log(`      last_reading: ${record.last_reading}`);
        console.log('');
      });
      
      // التحقق من البيانات العربية
      const hasArabic = insertedData.some(r => 
        r.subscriber_name && /[\u0600-\u06FF]/.test(r.subscriber_name)
      );
      
      if (hasArabic) {
        console.log('✅ البيانات العربية موجودة بشكل صحيح!\n');
      } else {
        console.log('⚠️  تحذير: البيانات العربية قد لا تظهر بشكل صحيح\n');
      }
    }
    
    console.log('='.repeat(60));
    console.log('\n✅ الاختبار نجح! يمكنك الآن رفع باقي البيانات.\n');
    
  } catch (error) {
    console.error('\n❌ خطأ في العملية:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// تشغيل الاختبار
testImport10Rows();

