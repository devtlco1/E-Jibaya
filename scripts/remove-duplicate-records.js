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
 * البحث عن السجلات المكررة (نفس رقم الحساب ورقم المقياس)
 */
async function findDuplicateRecords() {
  console.log('🔍 البحث عن السجلات المكررة...\n');
  
  try {
    // جلب جميع السجلات مع رقم الحساب ورقم المقياس (بدون limit)
    let allRecords = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;

    console.log('📥 جلب السجلات من قاعدة البيانات...');

    while (hasMore) {
      const to = from + limit - 1;
      const { data: records, error } = await supabase
        .from('collection_records')
        .select('id, account_number, meter_number, submitted_at, created_at')
        .not('account_number', 'is', null)
        .not('meter_number', 'is', null)
        .range(from, to)
        .order('submitted_at', { ascending: false });

      if (error) {
        console.error('❌ خطأ في جلب السجلات:', error.message);
        break;
      }

      if (!records || records.length === 0) {
        hasMore = false;
        break;
      }

      allRecords.push(...records);
      from += limit;

      if (records.length < limit) {
        hasMore = false;
      }

      console.log(`   📥 تم جلب ${allRecords.length} سجل حتى الآن...`);
    }

    const records = allRecords;

    if (!records || records.length === 0) {
      console.log('⚠️  لا توجد سجلات في قاعدة البيانات');
      return [];
    }

    console.log(`📊 إجمالي السجلات: ${records.length}`);

    // تجميع السجلات حسب رقم الحساب ورقم المقياس
    const recordsMap = new Map();
    const duplicates = [];

    for (const record of records) {
      const key = `${record.account_number}_${record.meter_number}`;
      
      if (!recordsMap.has(key)) {
        recordsMap.set(key, []);
      }
      
      recordsMap.get(key).push(record);
    }

    // البحث عن المكررات (أكثر من سجل واحد لكل مفتاح)
    for (const [key, recordsList] of recordsMap.entries()) {
      if (recordsList.length > 1) {
        // ترتيب حسب التاريخ (الأحدث أولاً)
        recordsList.sort((a, b) => {
          const dateA = new Date(a.submitted_at || a.created_at);
          const dateB = new Date(b.submitted_at || b.created_at);
          return dateB - dateA;
        });

        // الاحتفاظ بالأحدث، والباقي للحذف
        const toKeep = recordsList[0];
        const toDelete = recordsList.slice(1);

        duplicates.push({
          key,
          accountNumber: toKeep.account_number,
          meterNumber: toKeep.meter_number,
          keep: toKeep,
          delete: toDelete,
          count: recordsList.length
        });
      }
    }

    console.log(`\n📋 تم العثور على ${duplicates.length} مجموعة مكررة`);
    
    let totalDuplicates = 0;
    duplicates.forEach(dup => {
      totalDuplicates += dup.delete.length;
      console.log(`   - ${dup.accountNumber} / ${dup.meterNumber}: ${dup.count} سجل (سيتم حذف ${dup.delete.length})`);
    });

    console.log(`\n📊 إجمالي السجلات المكررة للحذف: ${totalDuplicates}\n`);

    return duplicates;
  } catch (error) {
    console.error('❌ خطأ في البحث عن المكررات:', error.message);
    return [];
  }
}

/**
 * حذف السجلات المكررة
 */
async function deleteDuplicateRecords(duplicates) {
  if (duplicates.length === 0) {
    console.log('✅ لا توجد سجلات مكررة للحذف');
    return;
  }

  console.log('🗑️  بدء حذف السجلات المكررة...\n');

  let deletedCount = 0;
  let errorCount = 0;
  const deletedIds = [];

  for (let i = 0; i < duplicates.length; i++) {
    const duplicate = duplicates[i];
    const idsToDelete = duplicate.delete.map(r => r.id);

    console.log(`\n[${i + 1}/${duplicates.length}] معالجة: ${duplicate.accountNumber} / ${duplicate.meterNumber}`);
    console.log(`   📌 الاحتفاظ بـ: ${duplicate.keep.id} (${new Date(duplicate.keep.submitted_at || duplicate.keep.created_at).toLocaleDateString('ar')})`);
    console.log(`   🗑️  حذف ${idsToDelete.length} سجل...`);

    for (const id of idsToDelete) {
      try {
        // حذف السجلات المرتبطة أولاً
        // حذف سجلات التغييرات
        await supabase
          .from('record_changes_log')
          .delete()
          .eq('record_id', id);

        // حذف الصور الإضافية
        await supabase
          .from('record_photos')
          .delete()
          .eq('record_id', id);

        // حذف سجل النشاط
        await supabase
          .from('activity_logs')
          .delete()
          .eq('target_id', id);

        // حذف السجل الرئيسي
        const { error } = await supabase
          .from('collection_records')
          .delete()
          .eq('id', id);

        if (error) {
          console.error(`   ❌ خطأ في حذف السجل ${id}:`, error.message);
          errorCount++;
        } else {
          deletedCount++;
          deletedIds.push(id);
        }
      } catch (error) {
        console.error(`   ❌ خطأ غير متوقع في حذف السجل ${id}:`, error.message);
        errorCount++;
      }
    }

    // تأخير صغير لتجنب الضغط على قاعدة البيانات
    if ((i + 1) % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n📈 ملخص العملية:`);
  console.log(`   ✅ تم حذف: ${deletedCount} سجل مكرر`);
  console.log(`   ❌ أخطاء: ${errorCount} سجل`);
  console.log(`   📊 إجمالي المجموعات المكررة: ${duplicates.length}\n`);

  return { deletedCount, errorCount, deletedIds };
}

/**
 * الدالة الرئيسية
 */
async function main() {
  console.log('🚀 بدء عملية حذف السجلات المكررة...\n');

  try {
    // البحث عن السجلات المكررة
    const duplicates = await findDuplicateRecords();

    if (duplicates.length === 0) {
      console.log('✅ لا توجد سجلات مكررة في قاعدة البيانات');
      return;
    }

    // عرض ملخص قبل الحذف
    const totalToDelete = duplicates.reduce((sum, dup) => sum + dup.delete.length, 0);
    console.log(`\n⚠️  تحذير: سيتم حذف ${totalToDelete} سجل مكرر`);
    console.log(`   سيتم الاحتفاظ بـ ${duplicates.length} سجل (الأحدث من كل مجموعة)\n`);

    // حذف السجلات المكررة
    const result = await deleteDuplicateRecords(duplicates);

    if (result && result.deletedCount > 0) {
      console.log('✅ اكتملت عملية حذف السجلات المكررة بنجاح!');
      console.log(`\n📊 النتيجة النهائية:`);
      console.log(`   ✅ تم حذف: ${result.deletedCount} سجل مكرر`);
      console.log(`   ❌ أخطاء: ${result.errorCount} سجل`);
    } else {
      console.log('⚠️  لم يتم حذف أي سجلات');
    }
  } catch (error) {
    console.error('❌ خطأ في البرنامج:', error);
    process.exit(1);
  }
}

// تشغيل البرنامج
main().catch(error => {
  console.error('❌ خطأ في البرنامج:', error);
  process.exit(1);
});

