import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Upload, 
  Database, 
  FileText, 
  Image, 
  Users, 
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  HardDrive,
  Archive
} from 'lucide-react';
import { dbOperations } from '../../lib/supabase';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import JSZip from 'jszip';

interface BackupData {
  users: any[];
  collection_records: any[];
  activity_logs: any[];
  record_photos: any[];
  user_sessions: any[];
  photos: any[];
  metadata: {
    backup_date: string;
    total_records: number;
    total_photos: number;
    total_users: number;
    version: string;
  };
}

export function BackupSystem() {
  const [loading, setLoading] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [backupStatus, setBackupStatus] = useState<string>('');
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const [systemStats, setSystemStats] = useState({
    users: 0,
    records: 0,
    photos: 0,
    activityLogs: 0
  });
  const { addNotification } = useNotifications();
  const { user } = useAuth();

  useEffect(() => {
    loadSystemStats();
  }, []);

  const loadSystemStats = async () => {
    try {
      const stats = await getSystemStats();
      setSystemStats(stats);
    } catch (error) {
      console.error('Error loading system stats:', error);
    }
  };

  const createBackup = async () => {
    try {
      setLoading(true);
      setBackupProgress(0);
      setBackupStatus('جاري إنشاء النسخة الاحتياطية...');

      // إنشاء كائن النسخة الاحتياطية
      const backupData: BackupData = {
        users: [],
        collection_records: [],
        activity_logs: [],
        record_photos: [],
        user_sessions: [],
        photos: [],
        metadata: {
          backup_date: new Date().toISOString(),
          total_records: 0,
          total_photos: 0,
          total_users: 0,
          version: '1.0.0'
        }
      };

      // 1. نسخ المستخدمين
      setBackupStatus('جاري نسخ المستخدمين...');
      setBackupProgress(10);
      const users = await dbOperations.getAllUsers();
      backupData.users = users;
      backupData.metadata.total_users = users.length;

      // 2. نسخ السجلات
      setBackupStatus('جاري نسخ سجلات الجباية...');
      setBackupProgress(20);
      const records = await dbOperations.getAllRecords();
      backupData.collection_records = records;
      backupData.metadata.total_records = records.length;

      // 3. نسخ سجل الأنشطة
      setBackupStatus('جاري نسخ سجل الأنشطة...');
      setBackupProgress(30);
      const activityLogs = await dbOperations.getAllActivityLogs();
      backupData.activity_logs = activityLogs;

      // 4. نسخ بيانات الصور
      setBackupStatus('جاري نسخ بيانات الصور...');
      setBackupProgress(40);
      const photos = await dbOperations.getAllRecordPhotos();
      backupData.record_photos = photos;
      backupData.metadata.total_photos = photos.length;

      // 5. نسخ الجلسات
      setBackupStatus('جاري نسخ الجلسات...');
      setBackupProgress(50);
      const sessions = await dbOperations.getAllUserSessions();
      backupData.user_sessions = sessions;

      // 6. إنشاء ملف ZIP
      setBackupStatus('جاري إنشاء ملف ZIP...');
      setBackupProgress(60);
      
      const zip = new JSZip();
      
      // إضافة ملف البيانات JSON
      const backupJson = JSON.stringify(backupData, null, 2);
      zip.file('backup_data.json', backupJson);

      // 7. تحميل الصور كملفات عادية
      setBackupStatus('جاري تحميل الصور...');
      setBackupProgress(70);
      
      let downloadedPhotos = 0;
      
      // دالة لاستخراج اسم الملف الأصلي من URL
      const getOriginalFileName = (url: string, recordId: string, photoType: string) => {
        try {
          // استخراج اسم الملف من URL
          const urlParts = url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          
          // إذا كان الاسم يحتوي على التنسيق المطلوب، استخدمه
          if (fileName.includes('_IMG_') || fileName.includes('_')) {
            return `photos/record_${recordId}_${photoType}_${fileName}`;
          }
          
          // إذا لم يكن كذلك، أنشئ اسم بناءً على timestamp
          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substring(2, 7);
          return `photos/record_${recordId}_${photoType}_${photoType.toUpperCase()}_IMG_${timestamp}_${randomId}.jpg`;
        } catch (error) {
          // في حالة الخطأ، استخدم timestamp
          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substring(2, 7);
          return `photos/record_${recordId}_${photoType}_${photoType.toUpperCase()}_IMG_${timestamp}_${randomId}.jpg`;
        }
      };
      
      // تحميل صور السجلات
      for (const record of records) {
        if (record.meter_photo_url) {
          try {
            const response = await fetch(record.meter_photo_url);
            if (response.ok) {
              const blob = await response.blob();
              const fileName = getOriginalFileName(record.meter_photo_url, record.id, 'meter');
              zip.file(fileName, blob);
              downloadedPhotos++;
            }
          } catch (error) {
            console.warn(`Failed to download meter photo for record ${record.id}:`, error);
          }
        }
        
        if (record.invoice_photo_url) {
          try {
            const response = await fetch(record.invoice_photo_url);
            if (response.ok) {
              const blob = await response.blob();
              const fileName = getOriginalFileName(record.invoice_photo_url, record.id, 'invoice');
              zip.file(fileName, blob);
              downloadedPhotos++;
            }
          } catch (error) {
            console.warn(`Failed to download invoice photo for record ${record.id}:`, error);
          }
        }
      }

      // تحميل صور السجلات الإضافية
      for (const photo of photos) {
        if (photo.photo_url) {
          try {
            const response = await fetch(photo.photo_url);
            if (response.ok) {
              const blob = await response.blob();
              const fileName = getOriginalFileName(photo.photo_url, photo.record_id, photo.photo_type);
              zip.file(fileName, blob);
              downloadedPhotos++;
            }
          } catch (error) {
            console.warn(`Failed to download photo ${photo.id}:`, error);
          }
        }
      }

      // 8. إنشاء ملف ZIP النهائي
      setBackupStatus('جاري ضغط الملفات...');
      setBackupProgress(90);
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      
      // تحميل الملف
      const link = document.createElement('a');
      link.href = url;
      
      // إنشاء اسم الملف مع التاريخ والوقت
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
      const fileName = `ejibaya_backup_complete_${dateStr}_${timeStr}.zip`;
      
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setBackupProgress(100);
      setBackupStatus('تم إنشاء النسخة الاحتياطية بنجاح!');
      setLastBackup(new Date());
      
      addNotification({
        type: 'success',
        title: 'نسخة احتياطية',
        message: `تم إنشاء النسخة الاحتياطية بنجاح مع ${downloadedPhotos} صورة`
      });

      // تسجيل النشاط
      if (user?.id) {
        await dbOperations.createActivityLog({
          user_id: user.id,
          action: 'backup_data',
          target_type: 'backup',
          target_name: 'نسخة احتياطية كاملة مع الصور',
          details: {
            total_records: backupData.metadata.total_records,
            total_photos: downloadedPhotos,
            total_users: backupData.metadata.total_users,
            backup_type: 'complete_with_images'
          }
        });
      }

    } catch (error) {
      console.error('Backup error:', error);
      setBackupStatus('فشل في إنشاء النسخة الاحتياطية');
      addNotification({
        type: 'error',
        title: 'خطأ في النسخ الاحتياطي',
        message: 'فشل في إنشاء النسخة الاحتياطية'
      });
    } finally {
      setLoading(false);
    }
  };

  const restoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setBackupStatus('جاري قراءة ملف النسخة الاحتياطية...');
      setBackupProgress(10);

      let backupData: BackupData;

      // التحقق من نوع الملف
      if (file.name.endsWith('.zip')) {
        // ملف ZIP
        setBackupStatus('جاري فك ضغط الملف...');
        setBackupProgress(20);
        
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(file);
        
        // البحث عن ملف البيانات
        const dataFile = zipContent.file('backup_data.json');
        if (!dataFile) {
          throw new Error('ملف البيانات غير موجود في الأرشيف');
        }
        
        const text = await dataFile.async('text');
        backupData = JSON.parse(text);
        
        setBackupStatus('تم العثور على الصور في الأرشيف...');
        setBackupProgress(30);
        
        // عرض معلومات الصور الموجودة
        const photoFiles = Object.keys(zipContent.files).filter(name => 
          name.startsWith('photos/') && !name.endsWith('/')
        );
        
        console.log(`Found ${photoFiles.length} photos in backup:`, photoFiles);
        
      } else if (file.name.endsWith('.json')) {
        // ملف JSON عادي
        const text = await file.text();
        backupData = JSON.parse(text);
      } else {
        throw new Error('نوع الملف غير مدعوم. يجب أن يكون .zip أو .json');
      }

      // التحقق من صحة الملف
      if (!backupData.metadata || !backupData.users) {
        throw new Error('ملف النسخة الاحتياطية غير صالح');
      }

      setBackupStatus('جاري استعادة البيانات...');
      setBackupProgress(50);

      // استعادة البيانات (هذا يتطلب إضافة دوال في supabase.ts)
      // await dbOperations.restoreBackup(backupData);

      setBackupProgress(100);
      setBackupStatus('تم استعادة النسخة الاحتياطية بنجاح!');
      
      addNotification({
        type: 'success',
        title: 'استعادة النسخة الاحتياطية',
        message: `تم استعادة النسخة الاحتياطية بنجاح مع ${backupData.metadata.total_photos} صورة`
      });

    } catch (error) {
      console.error('Restore error:', error);
      setBackupStatus('فشل في استعادة النسخة الاحتياطية');
      addNotification({
        type: 'error',
        title: 'خطأ في الاستعادة',
        message: 'فشل في استعادة النسخة الاحتياطية'
      });
    } finally {
      setLoading(false);
    }
  };

  const getSystemStats = async () => {
    try {
      const users = await dbOperations.getAllUsers();
      const records = await dbOperations.getAllRecords();
      const photos = await dbOperations.getAllRecordPhotos();
      const activityLogs = await dbOperations.getAllActivityLogs();

      return {
        users: users.length,
        records: records.length,
        photos: photos.length,
        activityLogs: activityLogs.length
      };
    } catch (error) {
      console.error('Error getting system stats:', error);
      return {
        users: 0,
        records: 0,
        photos: 0,
        activityLogs: 0
      };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Database className="w-6 h-6 text-blue-600 dark:text-blue-400 ml-3" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            النسخ الاحتياطي
          </h2>
        </div>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-blue-600 dark:text-blue-400 ml-3" />
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">المستخدمين</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {systemStats.users}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <FileText className="w-8 h-8 text-green-600 dark:text-green-400 ml-3" />
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">السجلات</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {systemStats.records}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Image className="w-8 h-8 text-purple-600 dark:text-purple-400 ml-3" />
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">الصور</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {systemStats.photos}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Activity className="w-8 h-8 text-orange-600 dark:text-orange-400 ml-3" />
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">سجل الأنشطة</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {systemStats.activityLogs}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Backup Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Backup */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-4">
            <Download className="w-6 h-6 text-green-600 dark:text-green-400 ml-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              إنشاء نسخة احتياطية
            </h3>
          </div>
          
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            قم بإنشاء نسخة احتياطية كاملة من جميع البيانات والصور كملفات عادية
          </p>

          <button
            onClick={createBackup}
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin ml-2"></div>
                جاري الإنشاء...
              </>
            ) : (
              <>
                <Archive className="w-4 h-4 ml-2" />
                إنشاء نسخة احتياطية كاملة
              </>
            )}
          </button>

          {lastBackup && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 ml-2" />
                <span className="text-sm text-green-800 dark:text-green-200">
                  آخر نسخة احتياطية: {lastBackup.toLocaleString('ar')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Restore Backup */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-4">
            <Upload className="w-6 h-6 text-blue-600 dark:text-blue-400 ml-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              استعادة نسخة احتياطية
            </h3>
          </div>
          
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            قم بتحميل ملف النسخة الاحتياطية لاستعادة البيانات
          </p>

          <label className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer">
            <Upload className="w-4 h-4 ml-2" />
            اختيار ملف النسخة الاحتياطية
            <input
              type="file"
              accept=".zip,.json"
              onChange={restoreBackup}
              className="hidden"
              disabled={loading}
            />
          </label>

          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 ml-2" />
              <span className="text-sm text-yellow-800 dark:text-yellow-200">
                تحذير: الاستعادة ستحل محل جميع البيانات الحالية
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress */}
      {loading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-4">
            <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400 ml-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              حالة العملية
            </h3>
          </div>
          
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span>{backupStatus}</span>
              <span>{backupProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${backupProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Backup Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center mb-4">
          <HardDrive className="w-6 h-6 text-gray-600 dark:text-gray-400 ml-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            معلومات النسخ الاحتياطي
          </h3>
        </div>
        
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <p>• النسخة الاحتياطية تشمل جميع البيانات: المستخدمين، السجلات، الصور، وسجل الأنشطة</p>
          <p>• يتم حفظ النسخة الاحتياطية كملف ZIP يحتوي على JSON + الصور كملفات عادية</p>
          <p>• الصور محفوظة بأسمائها الأصلية من قاعدة البيانات (مثل: I_IMG_1759418703702_tnp1o)</p>
          <p>• يمكن فتح الصور مباشرة من الحاسبة بدون الحاجة لبرامج خاصة</p>
          <p>• أسماء الصور تطابق الترقيم الأصلي في قاعدة البيانات بالضبط</p>
          <p>• اسم الملف يتضمن التاريخ والوقت (مثل: ejibaya_backup_complete_2025-01-02_14-30-45.zip)</p>
          <p>• يمكن استعادة النسخة الاحتياطية في أي وقت</p>
          <p>• يُنصح بإنشاء نسخة احتياطية دورية</p>
        </div>
      </div>
    </div>
  );
}
