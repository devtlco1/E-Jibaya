import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * تحويل ملف CSV من الأعمدة العربية إلى الإنجليزية مع UTF-8 BOM
 */
function convertCSVForSupabaseWithBOM() {
  console.log('🔄 بدء تحويل ملف CSV مع UTF-8 BOM...\n');
  
  const inputFile = path.join(__dirname, '../DATA/ بيانات مشتركين الكوت.csv');
  const outputFile = path.join(__dirname, '../DATA/collection_records_ready.csv');
  
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ الملف غير موجود: ${inputFile}`);
    process.exit(1);
  }
  
  console.log(`📖 قراءة الملف: ${inputFile}`);
  const fileContent = fs.readFileSync(inputFile, 'utf-8');
  const lines = fileContent.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length === 0) {
    console.error('❌ الملف فارغ');
    process.exit(1);
  }
  
  // قراءة السطر الأول (العناوين)
  const headerLine = lines[0];
  const headers = headerLine.split(',').map(h => h.trim());
  
  console.log(`   📊 عدد الصفوف: ${lines.length - 1}`);
  console.log(`   📋 الأعمدة: ${headers.join(', ')}\n`);
  
  // إنشاء رأس CSV جديد بالأعمدة الإنجليزية
  const newHeaders = [
    'account_number',
    'subscriber_name',
    'region',
    'meter_number',
    'category',
    'last_reading',
    'status',
    'is_refused'
  ];
  
  const outputLines = [newHeaders.join(',')];
  
  // معالجة كل صف
  let processedCount = 0;
  let skippedCount = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    try {
      // تقسيم الصف (مع مراعاة الفواصل داخل النصوص)
      const values = [];
      let currentValue = '';
      let insideQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim()); // آخر قيمة
      
      // التأكد من أن لدينا عدد كافٍ من القيم
      if (values.length < 6) {
        console.warn(`   ⚠️  تخطي الصف ${i + 1}: عدد الأعمدة غير كافٍ`);
        skippedCount++;
        continue;
      }
      
      // استخراج القيم
      const accountNumber = (values[0] || '').trim();
      const subscriberName = (values[1] || '').trim();
      const region = (values[2] || '').trim();
      const meterNumber = (values[3] || '').trim();
      const category = (values[4] || '').trim();
      const lastReading = (values[5] || '').trim();
      
      // تخطي الصفوف الفارغة
      if (!accountNumber && !subscriberName && !meterNumber) {
        skippedCount++;
        continue;
      }
      
      // تنظيف رقم الحساب (إزالة أي أحرف غير رقمية)
      const cleanAccountNumber = accountNumber.replace(/[^0-9]/g, '');
      
      // التحقق من صحة رقم الحساب
      if (cleanAccountNumber.length > 12) {
        console.warn(`   ⚠️  تخطي الصف ${i + 1}: رقم الحساب طويل جداً (${cleanAccountNumber})`);
        skippedCount++;
        continue;
      }
      
      // التحقق من صحة الصنف
      const validCategories = ['منزلي', 'تجاري', 'صناعي', 'زراعي', 'حكومي'];
      let finalCategory = '';
      if (category && category !== 'بدون صنف') {
        if (!validCategories.includes(category)) {
          console.warn(`   ⚠️  تخطي الصف ${i + 1}: صنف غير صحيح (${category})`);
          skippedCount++;
          continue;
        }
        finalCategory = category;
      }
      
      // إضافة علامات اقتباس للقيم التي تحتوي على فواصل أو أحرف خاصة
      const escapeValue = (val) => {
        if (!val) return '';
        // إذا كانت القيمة تحتوي على فاصلة أو علامة اقتباس أو سطر جديد، نضعها بين علامات اقتباس
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      };
      
      // إنشاء صف جديد
      const newRow = [
        cleanAccountNumber || '',
        escapeValue(subscriberName),
        escapeValue(region),
        meterNumber || '',
        escapeValue(finalCategory),
        lastReading || '',
        'pending', // status
        'false'    // is_refused
      ];
      
      // إضافة الصف إلى المخرجات
      outputLines.push(newRow.join(','));
      processedCount++;
      
      // عرض التقدم كل 10000 صف
      if (processedCount % 10000 === 0) {
        console.log(`   ✅ تم معالجة ${processedCount} صف...`);
      }
      
    } catch (error) {
      console.warn(`   ⚠️  خطأ في معالجة الصف ${i + 1}: ${error.message}`);
      skippedCount++;
    }
  }
  
  // كتابة الملف الجديد مع UTF-8 BOM
  console.log(`\n💾 كتابة الملف الجديد مع UTF-8 BOM: ${outputFile}`);
  const BOM = '\uFEFF'; // UTF-8 BOM
  const csvContent = outputLines.join('\n');
  fs.writeFileSync(outputFile, BOM + csvContent, 'utf-8');
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ اكتمل التحويل بنجاح!');
  console.log(`   ✅ تم معالجة: ${processedCount} صف`);
  if (skippedCount > 0) {
    console.log(`   ⚠️  تم تخطي: ${skippedCount} صف`);
  }
  console.log(`   📁 الملف الجديد: ${outputFile}`);
  console.log('   🔤 الترميز: UTF-8 with BOM');
  console.log('='.repeat(60));
  console.log('\n📋 أسماء الأعمدة في الملف الجديد:');
  console.log('   ' + newHeaders.join(', '));
  console.log('\n✨ الملف جاهز للرفع إلى Supabase!\n');
}

// تشغيل التحويل
convertCSVForSupabaseWithBOM();

