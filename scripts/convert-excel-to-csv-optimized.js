import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * تحويل ملف Excel مباشرة إلى CSV محسّن لـ Supabase
 */
function convertExcelToCSV() {
  console.log('🔄 بدء تحويل ملف Excel إلى CSV محسّن...\n');
  
  // البحث عن ملف Excel
  const dataDir = path.join(__dirname, '../DATA');
  const files = fs.readdirSync(dataDir);
  const excelFile = files.find(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
  
  if (!excelFile) {
    console.error('❌ لم يتم العثور على ملف Excel في مجلد DATA');
    console.log('   الملفات المتاحة:', files.join(', '));
    process.exit(1);
  }
  
  const inputFile = path.join(dataDir, excelFile);
  const outputFile = path.join(dataDir, 'collection_records_ready.csv');
  
  console.log(`📖 قراءة ملف Excel: ${excelFile}\n`);
  
  // قراءة ملف Excel
  const workbook = XLSX.readFile(inputFile, { 
    type: 'buffer',
    cellDates: false,
    cellNF: false,
    cellStyles: false
  });
  
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // تحويل إلى JSON مع الحفاظ على القيم الفارغة
  const data = XLSX.utils.sheet_to_json(worksheet, { 
    defval: null,
    raw: false,
    dateNF: 'yyyy-mm-dd'
  });
  
  console.log(`   📊 عدد الصفوف في Excel: ${data.length}\n`);
  
  if (data.length === 0) {
    console.error('❌ الملف فارغ');
    process.exit(1);
  }
  
  // عرض أول صف لمعرفة أسماء الأعمدة
  const firstRow = data[0];
  console.log('   📋 أسماء الأعمدة في Excel:');
  console.log('   ' + Object.keys(firstRow).join(', '));
  console.log('\n   📝 مثال على أول صف:');
  console.log('   ' + JSON.stringify(firstRow, null, 2).substring(0, 200) + '...\n');
  
  // تحديد أسماء الأعمدة العربية
  const columnMapping = {
    'رقم الحساب': 'account_number',
    'الاسم': 'subscriber_name',
    'المنطقة': 'region',
    'رقم المقياس': 'meter_number',
    'الصنف': 'category',
    'القرادة السابقة': 'last_reading',
    'القراءة السابقة': 'last_reading'
  };
  
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
   * تنظيف وتنسيق القيمة
   */
  function cleanValue(value) {
    if (value === null || value === undefined) {
      return '';
    }
    
    // تحويل إلى نص
    let str = String(value).trim();
    
    // إزالة أي أحرف غير مرئية
    str = str.replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    return str;
  }
  
  /**
   * تحويل رقم الصنف إلى نص
   */
  function convertCategory(value) {
    if (!value) return '';
    
    const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
    
    if (isNaN(numValue)) {
      // إذا كان نصاً بالفعل (منزلي، تجاري، إلخ)
      const validCategories = ['منزلي', 'تجاري', 'صناعي', 'زراعي', 'حكومي'];
      if (validCategories.includes(String(value).trim())) {
        return String(value).trim();
      }
      return '';
    }
    
    return categoryMapping[numValue] || '';
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
   * إضافة علامات اقتباس للقيم التي تحتاجها
   */
  function escapeCSVValue(value) {
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
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    
    try {
      // استخراج القيم من الأعمدة العربية
      let accountNumber = '';
      let subscriberName = '';
      let region = '';
      let meterNumber = '';
      let category = '';
      let lastReading = '';
      
      // البحث عن الأعمدة بمرونة
      for (const [arabicKey, englishKey] of Object.entries(columnMapping)) {
        const value = row[arabicKey];
        if (value !== undefined && value !== null) {
          switch (englishKey) {
            case 'account_number':
              accountNumber = cleanAccountNumber(value);
              break;
            case 'subscriber_name':
              subscriberName = cleanValue(value);
              break;
            case 'region':
              region = cleanValue(value);
              break;
            case 'meter_number':
              meterNumber = cleanValue(value);
              break;
            case 'category':
              category = convertCategory(value);
              break;
            case 'last_reading':
              lastReading = cleanValue(value);
              break;
          }
        }
      }
      
      // تخطي الصفوف الفارغة تماماً
      if (!accountNumber && !subscriberName && !meterNumber) {
        skippedCount++;
        continue;
      }
      
      // التحقق من صحة رقم الحساب
      if (accountNumber && accountNumber.length > 12) {
        console.warn(`   ⚠️  تخطي الصف ${i + 2}: رقم الحساب طويل جداً`);
        skippedCount++;
        continue;
      }
      
      // إنشاء صف CSV
      const csvRow = [
        escapeCSVValue(accountNumber),
        escapeCSVValue(subscriberName),
        escapeCSVValue(region),
        escapeCSVValue(meterNumber),
        escapeCSVValue(category),
        escapeCSVValue(lastReading),
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
      if (i < 3) {
        console.log(`\n   📝 مثال - الصف ${i + 1}:`);
        console.log(`      account_number: ${accountNumber}`);
        console.log(`      subscriber_name: ${subscriberName}`);
        console.log(`      region: ${region}`);
        console.log(`      meter_number: ${meterNumber}`);
        console.log(`      category: ${category}`);
        console.log(`      last_reading: ${lastReading}`);
      }
      
    } catch (error) {
      console.warn(`   ⚠️  خطأ في معالجة الصف ${i + 2}: ${error.message}`);
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
      console.log('   [Header]', line.substring(0, 100) + '...');
    } else {
      console.log(`   [Row ${idx}]`, line.substring(0, 100) + '...');
    }
  });
  console.log('');
}

// تشغيل التحويل
convertExcelToCSV();

