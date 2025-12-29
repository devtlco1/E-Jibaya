import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * تحويل ملف CSV مع إصلاح مشكلة الترميز والاقتباس
 */
function convertCSVFixed() {
  console.log('🔄 بدء تحويل ملف CSV مع إصلاح الترميز...\n');
  
  const inputFile = path.join(__dirname, '../DATA/ بيانات مشتركين الكوت.csv');
  const outputFile = path.join(__dirname, '../DATA/collection_records_ready.csv');
  
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ الملف غير موجود: ${inputFile}`);
    process.exit(1);
  }
  
  console.log(`📖 قراءة الملف: ${inputFile}`);
  
  // قراءة الملف بترميز UTF-8
  const fileContent = fs.readFileSync(inputFile, 'utf-8');
  const lines = fileContent.split(/\r?\n/).filter(line => line.trim() !== '');
  
  if (lines.length === 0) {
    console.error('❌ الملف فارغ');
    process.exit(1);
  }
  
  console.log(`   📊 عدد الصفوف: ${lines.length - 1}\n`);
  
  // جدول تحويل الأصناف
  const categoryMapping = {
    0: null,
    1: 'حكومي', 2: 'حكومي', 8: 'حكومي', 23: 'حكومي', 101: 'حكومي', 102: 'حكومي', 108: 'حكومي',
    4: 'صناعي', 5: 'صناعي', 6: 'صناعي', 7: 'صناعي', 17: 'صناعي',
    104: 'صناعي', 105: 'صناعي', 106: 'صناعي', 107: 'صناعي',
    9: 'تجاري', 19: 'تجاري', 24: 'تجاري', 33: 'تجاري',
    21: 'منزلي', 26: 'منزلي', 27: 'منزلي', 28: 'منزلي', 29: 'منزلي', 39: 'منزلي',
    22: 'زراعي'
  };
  
  /**
   * تقسيم CSV بشكل صحيح مع مراعاة علامات الاقتباس
   */
  function parseCSVLine(line) {
    const values = [];
    let currentValue = '';
    let insideQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          // علامة اقتباس مزدوجة داخل النص
          currentValue += '"';
          i++; // تخطي العلامة الثانية
        } else {
          // بداية أو نهاية نص مقتبس
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        // فاصلة خارج النص المقتبس
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    
    // إضافة آخر قيمة
    values.push(currentValue.trim());
    
    return values;
  }
  
  /**
   * تنظيف القيمة
   */
  function cleanValue(value) {
    if (!value) return '';
    return String(value).trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
  }
  
  /**
   * تحويل الصنف
   */
  function convertCategory(value) {
    if (!value) return '';
    
    const str = String(value).trim();
    
    // إذا كان نصاً بالفعل
    const validCategories = ['منزلي', 'تجاري', 'صناعي', 'زراعي', 'حكومي', 'بدون صنف'];
    if (validCategories.includes(str)) {
      return str === 'بدون صنف' ? '' : str;
    }
    
    // إذا كان رقماً
    const num = parseInt(str, 10);
    if (!isNaN(num)) {
      return categoryMapping[num] || '';
    }
    
    return '';
  }
  
  /**
   * تنظيف رقم الحساب
   */
  function cleanAccountNumber(value) {
    if (!value) return '';
    const cleaned = String(value).replace(/[^0-9]/g, '');
    return cleaned.length > 12 ? cleaned.substring(0, 12) : cleaned;
  }
  
  /**
   * إضافة علامات اقتباس للقيم التي تحتاجها (لـ CSV)
   */
  function formatCSVValue(value) {
    if (!value) return '';
    
    const str = String(value);
    
    // إذا كانت القيمة تحتوي على فاصلة، علامة اقتباس، أو سطر جديد
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      // استبدال علامات الاقتباس المزدوجة باثنتين
      return `"${str.replace(/"/g, '""')}"`;
    }
    
    return str;
  }
  
  // إنشاء رأس CSV
  const csvHeaders = [
    'account_number',
    'subscriber_name',
    'region',
    'meter_number',
    'category',
    'last_reading',
    'status',
    'is_refused'
  ];
  
  const csvRows = [csvHeaders.join(',')];
  
  // معالجة كل صف
  let processedCount = 0;
  let skippedCount = 0;
  
  console.log('🔄 بدء معالجة البيانات...\n');
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    try {
      // تقسيم الصف
      const values = parseCSVLine(line);
      
      if (values.length < 6) {
        console.warn(`   ⚠️  تخطي الصف ${i + 1}: عدد الأعمدة غير كافٍ (${values.length})`);
        skippedCount++;
        continue;
      }
      
      // استخراج القيم
      const accountNumber = cleanAccountNumber(values[0]);
      const subscriberName = cleanValue(values[1]);
      const region = cleanValue(values[2]);
      const meterNumber = cleanValue(values[3]);
      const category = convertCategory(values[4]);
      const lastReading = cleanValue(values[5]);
      
      // تخطي الصفوف الفارغة
      if (!accountNumber && !subscriberName && !meterNumber) {
        skippedCount++;
        continue;
      }
      
      // التحقق من صحة رقم الحساب
      if (accountNumber && accountNumber.length > 12) {
        console.warn(`   ⚠️  تخطي الصف ${i + 1}: رقم الحساب طويل جداً`);
        skippedCount++;
        continue;
      }
      
      // إنشاء صف CSV
      const csvRow = [
        formatCSVValue(accountNumber),
        formatCSVValue(subscriberName),
        formatCSVValue(region),
        formatCSVValue(meterNumber),
        formatCSVValue(category),
        formatCSVValue(lastReading),
        'pending',
        'false'
      ];
      
      csvRows.push(csvRow.join(','));
      processedCount++;
      
      // عرض التقدم
      if (processedCount % 10000 === 0) {
        console.log(`   ✅ تم معالجة ${processedCount} صف...`);
      }
      
      // عرض أول 3 صفوف كمثال
      if (i <= 3) {
        console.log(`\n   📝 مثال - الصف ${i}:`);
        console.log(`      account_number: "${accountNumber}"`);
        console.log(`      subscriber_name: "${subscriberName}"`);
        console.log(`      region: "${region}"`);
        console.log(`      meter_number: "${meterNumber}"`);
        console.log(`      category: "${category}"`);
        console.log(`      last_reading: "${lastReading}"`);
      }
      
    } catch (error) {
      console.warn(`   ⚠️  خطأ في معالجة الصف ${i + 1}: ${error.message}`);
      skippedCount++;
    }
  }
  
  // كتابة الملف مع UTF-8 BOM
  console.log(`\n💾 كتابة الملف الجديد: ${outputFile}`);
  const BOM = '\uFEFF';
  const csvContent = csvRows.join('\n');
  fs.writeFileSync(outputFile, BOM + csvContent, 'utf-8');
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ اكتمل التحويل بنجاح!');
  console.log(`   ✅ تم معالجة: ${processedCount} صف`);
  if (skippedCount > 0) {
    console.log(`   ⚠️  تم تخطي: ${skippedCount} صف`);
  }
  console.log(`   📁 الملف الجديد: ${outputFile}`);
  console.log(`   🔤 الترميز: UTF-8 with BOM`);
  console.log('='.repeat(60));
  console.log('\n📋 أسماء الأعمدة في الملف الجديد:');
  console.log('   ' + csvHeaders.join(', '));
  console.log('\n✨ الملف جاهز للرفع إلى Supabase!\n');
  
  // عرض عينة من الملف
  console.log('📄 عينة من الملف (أول 3 صفوف):\n');
  const sampleLines = csvRows.slice(0, 4);
  sampleLines.forEach((line, idx) => {
    if (idx === 0) {
      console.log('   [Header]', line);
    } else {
      const preview = line.length > 150 ? line.substring(0, 150) + '...' : line;
      console.log(`   [Row ${idx}]`, preview);
    }
  });
  console.log('');
}

// تشغيل التحويل
convertCSVFixed();

