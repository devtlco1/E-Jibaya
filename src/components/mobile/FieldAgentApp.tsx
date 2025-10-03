import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { 
  MapPin, 
  Camera, 
  X, 
  Send, 
  LogOut, 
  Moon, 
  Sun,
  CheckCircle,
  AlertCircle,
  Search,
  History
} from 'lucide-react';
import { CreateRecordData } from '../../types';
import { dbOperations } from '../../lib/supabase';
import { compressImage, validateImageSize, validateImageType } from '../../utils/imageCompression';

export function FieldAgentApp() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { addNotification } = useNotifications();
  
  const [gpsData, setGpsData] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [meterPhoto, setMeterPhoto] = useState<string | null>(null);
  const [invoicePhoto, setInvoicePhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [additionalPhotosNotes, setAdditionalPhotosNotes] = useState('');
  const [isRefused, setIsRefused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  // Search functionality
  const [searchAccount, setSearchAccount] = useState('');
  const [existingRecords, setExistingRecords] = useState<any[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  const meterPhotoRef = useRef<HTMLInputElement>(null);
  const invoicePhotoRef = useRef<HTMLInputElement>(null);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      addNotification({
        type: 'error',
        title: 'خطأ في الموقع',
        message: 'الموقع الجغرافي غير مدعوم في هذا المتصفح'
      });
      return;
    }

    // التحقق من إذن الموقع
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'denied') {
          addNotification({
            type: 'error',
            title: 'خطأ في الموقع',
            message: 'تم رفض إذن الموقع. يرجى تفعيله من إعدادات المتصفح'
          });
          return;
        }
      });
    }

    setGpsLoading(true);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsData({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setGpsLoading(false);
        addNotification({
          type: 'success',
          title: 'تم تحديد الموقع',
          message: 'تم تحديد الموقع الجغرافي بنجاح'
        });
      },
      (error) => {
        console.error('خطأ في الحصول على الموقع:', error);
        addNotification({
          type: 'error',
          title: 'خطأ في الموقع',
          message: 'تعذر الحصول على الموقع الحالي'
        });
        setGpsLoading(false);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 0 
      }
    );
  };

  const handlePhotoCapture = (type: 'meter' | 'invoice') => {
    const input = type === 'meter' ? meterPhotoRef.current : invoicePhotoRef.current;
    if (input) {
      input.click();
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'meter' | 'invoice') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // التحقق من نوع الملف
    if (!validateImageType(file)) {
      addNotification({
        type: 'error',
        title: 'نوع ملف غير صحيح',
        message: 'يرجى اختيار ملف صورة صحيح (JPG, PNG, WebP, GIF)'
      });
      return;
    }
    
    // التحقق من حجم الملف
    if (!validateImageSize(file, 5)) {
      addNotification({
        type: 'error',
        title: 'حجم ملف كبير',
        message: 'يرجى اختيار صورة أصغر من 5 ميجابايت'
      });
      return;
    }

    try {
      // ضغط الصورة
      const compressedFile = await compressImage(file, {
        maxWidth: 800,
        maxHeight: 600,
        quality: 0.8,
        format: 'jpeg'
      });

      // تحويل إلى base64 للعرض
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        
        if (type === 'meter') {
          setMeterPhoto(result);
        } else {
          setInvoicePhoto(result);
        }
      };
      reader.readAsDataURL(compressedFile);

      addNotification({
        type: 'success',
        title: 'تم تحسين الصورة',
        message: `تم ضغط الصورة من ${(file.size / 1024 / 1024).toFixed(2)}MB إلى ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`
      });

    } catch (error) {
      console.error('Error compressing image:', error);
      addNotification({
        type: 'error',
        title: 'خطأ في معالجة الصورة',
        message: 'حدث خطأ أثناء ضغط الصورة'
      });
    }
  };

  const handleRefused = () => {
    setIsRefused(true);
    // Clear only meter photo when refusing (keep GPS and invoice photo)
    setMeterPhoto(null);
    addNotification({
      type: 'info',
      title: 'تم تسجيل الامتناع',
      message: 'تم تعطيل صورة المقياس - صورة الفاتورة إجبارية'
    });
  };

  const handleUnrefuse = () => {
    setIsRefused(false);
    addNotification({
      type: 'info',
      title: 'تم إلغاء الامتناع',
      message: 'تم إعادة تفعيل جميع الحقول'
    });
  };

  const handleSearch = async () => {
    if (!searchAccount.trim()) {
      addNotification({
        type: 'warning',
        title: 'خطأ في البحث',
        message: 'يرجى إدخال رقم الحساب'
      });
      return;
    }

    setIsSearching(true);
    try {
      const records = await dbOperations.getRecords();
      const filteredRecords = records.filter(record => 
        record.account_number && record.account_number.includes(searchAccount.trim())
      );
      setExistingRecords(filteredRecords);
      
      if (filteredRecords.length === 0) {
        addNotification({
          type: 'info',
          title: 'لا توجد سجلات',
          message: 'لم يتم العثور على سجلات لهذا رقم الحساب'
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      addNotification({
        type: 'error',
        title: 'خطأ في البحث',
        message: 'حدث خطأ أثناء البحث عن السجلات'
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectRecord = (record: any) => {
    setSelectedRecord(record);
    setSearchAccount('');
    setExistingRecords([]);
    addNotification({
      type: 'success',
      title: 'تم اختيار السجل',
      message: `تم اختيار سجل ${record.subscriber_name || record.account_number}`
    });
  };

  const handleClearSelection = () => {
    setSelectedRecord(null);
    setSearchAccount('');
    setExistingRecords([]);
  };

  const validateForm = () => {
    if (!user?.id) {
      addNotification({
        type: 'error',
        title: 'خطأ في المصادقة',
        message: 'خطأ في تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى'
      });
      return false;
    }

    // الموقع الجغرافي إجباري في جميع الحالات
    if (!gpsData) {
      addNotification({
        type: 'warning',
        title: 'خطأ في البيانات',
        message: 'يرجى تحديد الموقع الجغرافي'
      });
      return false;
    }

    // صورة الفاتورة إجبارية في جميع الحالات
    if (!invoicePhoto) {
      addNotification({
        type: 'warning',
        title: 'خطأ في البيانات',
        message: 'يرجى التقاط صورة الفاتورة'
      });
      return false;
    }

    if (!isRefused) {
      // الحالة العادية: صورة المقياس إجبارية
      if (!meterPhoto) {
        addNotification({
          type: 'warning',
          title: 'خطأ في البيانات',
          message: 'يرجى التقاط صورة المقياس'
        });
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // If we have a selected record, add photos to it instead of creating new record
      if (selectedRecord) {
        await handleAddPhotosToExistingRecord();
        return;
      }

      let meterPhotoUrl = null;
      let invoicePhotoUrl = null;

      // Try to initialize storage (but don't fail if it doesn't work)
      try {
        await dbOperations.initializeStorage();
      } catch (storageError) {
        console.warn('Storage initialization failed, proceeding anyway:', storageError);
      }

      // Upload meter photo if exists (only in normal case, not in refused case)
      if (meterPhoto && !isRefused) {
        const imageId = dbOperations.generateImageId();
        const fileName = `M_${imageId}.jpg`;
        const filePath = `meter_photos/${fileName}`;
        
        // Convert base64 to file
        const response = await fetch(meterPhoto);
        const blob = await response.blob();
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        
        meterPhotoUrl = await dbOperations.uploadPhoto(file, filePath);
        
        if (!meterPhotoUrl) {
          throw new Error('فشل في رفع صورة المقياس');
        }
      }

      // Upload invoice photo if exists (required in refused case, optional in normal case)
      if (invoicePhoto) {
        const imageId = dbOperations.generateImageId();
        const fileName = `I_${imageId}.jpg`;
        const filePath = `invoice_photos/${fileName}`;
        
        // Convert base64 to file
        const response = await fetch(invoicePhoto);
        const blob = await response.blob();
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        
        invoicePhotoUrl = await dbOperations.uploadPhoto(file, filePath);
        
        if (!invoicePhotoUrl) {
          throw new Error('فشل في رفع صورة الفاتورة');
        }
      }

      const record: CreateRecordData = {
        field_agent_id: user!.id,
        gps_latitude: gpsData?.lat || null,
        gps_longitude: gpsData?.lng || null,
        meter_photo_url: meterPhotoUrl,
        invoice_photo_url: invoicePhotoUrl,
        notes: notes || null,
        is_refused: isRefused
      };

      const result = await dbOperations.createRecord(record);
      
      if (result) {
        // Log record creation activity (don't fail if it doesn't work)
        try {
          await dbOperations.createActivityLog({
            user_id: user!.id,
            action: 'create_record',
            target_type: 'record',
            target_id: result.id,
            target_name: result.subscriber_name || result.account_number || 'سجل جديد',
            details: { 
              is_refused: isRefused,
              has_gps: !!gpsData,
              has_meter_photo: !!meterPhotoUrl,
              has_invoice_photo: !!invoicePhotoUrl
            }
          });
        } catch (logError) {
          console.warn('Failed to log record creation activity:', logError);
        }
        
        setSubmitted(true);
        
        // Reset form after 3 seconds
        setTimeout(() => {
          setSubmitted(false);
          setIsSubmitting(false);
          setGpsData(null);
          setMeterPhoto(null);
          setInvoicePhoto(null);
          setNotes('');
          setAdditionalPhotosNotes('');
          setIsRefused(false);
        }, 2000);
      } else {
        setSubmitError('فشل في إرسال البيانات. يرجى المحاولة مرة أخرى');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('خطأ في إرسال البيانات:', error);
      setSubmitError(error instanceof Error ? error.message : 'حدث خطأ أثناء إرسال البيانات');
      setIsSubmitting(false);
    }
  };

  const handleAddPhotosToExistingRecord = async () => {
    if (!user?.id || !selectedRecord) return;

    let meterPhotoUrl = null;
    let invoicePhotoUrl = null;

    // Try to initialize storage
    try {
      await dbOperations.initializeStorage();
    } catch (storageError) {
      console.warn('Storage initialization failed, proceeding anyway:', storageError);
    }

    // Upload meter photo if exists (only in normal case, not in refused case)
    if (meterPhoto && !isRefused) {
      const imageId = dbOperations.generateImageId();
      const fileName = `M_${imageId}.jpg`;
      const filePath = `meter_photos/${fileName}`;
      
      const response = await fetch(meterPhoto);
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      
      meterPhotoUrl = await dbOperations.uploadPhoto(file, filePath);
      
      if (meterPhotoUrl) {
        await dbOperations.addPhotoToRecord(selectedRecord.id, 'meter', meterPhotoUrl, user.id, additionalPhotosNotes);
      }
    }

    // Upload invoice photo if exists
    if (invoicePhoto) {
      const imageId = dbOperations.generateImageId();
      const fileName = `I_${imageId}.jpg`;
      const filePath = `invoice_photos/${fileName}`;
      
      const response = await fetch(invoicePhoto);
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      
      invoicePhotoUrl = await dbOperations.uploadPhoto(file, filePath);
      
      if (invoicePhotoUrl) {
        await dbOperations.addPhotoToRecord(selectedRecord.id, 'invoice', invoicePhotoUrl, user.id, additionalPhotosNotes);
      }
    }

    // Update the record with new data
    const updateData = {
      subscriber_name: selectedRecord.subscriber_name,
      account_number: selectedRecord.account_number,
      meter_number: selectedRecord.meter_number,
      address: selectedRecord.address,
      last_reading: selectedRecord.last_reading,
      status: selectedRecord.status,
      gps_latitude: gpsData?.lat || selectedRecord.gps_latitude,
      gps_longitude: gpsData?.lng || selectedRecord.gps_longitude,
      notes: notes || selectedRecord.notes,
      is_refused: isRefused
    };

    const success = await dbOperations.updateRecord(selectedRecord.id, updateData);
    
    if (success) {
      // Log activity
      try {
        await dbOperations.createActivityLog({
          user_id: user.id,
          action: 'add_photos_to_record',
          target_type: 'record',
          target_id: selectedRecord.id,
          target_name: selectedRecord.subscriber_name || selectedRecord.account_number || 'سجل محدث',
          details: { 
            added_meter_photo: !!meterPhotoUrl,
            added_invoice_photo: !!invoicePhotoUrl,
            is_refused: isRefused
          }
        });
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }
      
      setSubmitted(true);
      
      // Reset form after 3 seconds
      setTimeout(() => {
        setSubmitted(false);
        setGpsData(null);
        setMeterPhoto(null);
        setInvoicePhoto(null);
        setNotes('');
        setAdditionalPhotosNotes('');
        setIsRefused(false);
        setSelectedRecord(null);
      }, 2000);
    } else {
      setSubmitError('فشل في إضافة الصور. يرجى المحاولة مرة أخرى');
      setIsSubmitting(false);
    }
  };

  // Show error message if submission failed
  if (submitError) {
    return (
      <div className="min-h-screen bg-red-50 dark:bg-red-900 flex items-center justify-center p-4" dir="rtl">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-600 dark:text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-800 dark:text-red-200 mb-2">
            خطأ في الإرسال
          </h2>
          <p className="text-red-600 dark:text-red-300 mb-4">
            {submitError}
          </p>
          <button
            onClick={() => setSubmitError(null)}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            المحاولة مرة أخرى
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-green-50 dark:bg-green-900 flex items-center justify-center p-4" dir="rtl">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-green-800 dark:text-green-200 mb-2">
            تم الإرسال بنجاح!
          </h2>
          <p className="text-green-600 dark:text-green-300">
            تم حفظ البيانات وإرسالها للمدير
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300" dir="rtl">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                تطبيق المحصل الميداني
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                مرحباً، {user?.full_name}
              </p>
            </div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
                aria-label={isDark ? 'تبديل إلى الوضع النهاري' : 'تبديل إلى الوضع الليلي'}
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-600" />
                )}
              </button>
              <button
                onClick={logout}
                className="p-2 rounded-lg bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                title="تسجيل الخروج"
              >
                <LogOut className="w-5 h-5 text-red-600 dark:text-red-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-6">
        {/* Search for Existing Records */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            البحث عن سجلات موجودة
          </h3>
          
          {!selectedRecord ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchAccount}
                  onChange={(e) => setSearchAccount(e.target.value)}
                  placeholder="أدخل رقم الحساب للبحث..."
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium flex items-center"
                >
                  <Search className="w-4 h-4 ml-2" />
                  {isSearching ? 'جاري البحث...' : 'بحث'}
                </button>
              </div>
              
              {existingRecords.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    السجلات الموجودة:
                  </h4>
                  {existingRecords.map((record) => (
                    <div
                      key={record.id}
                      className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      onClick={() => handleSelectRecord(record)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {record.subscriber_name || 'غير محدد'}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            رقم الحساب: {record.account_number}
                          </p>
                          {record.meter_number && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              رقم المقياس: {record.meter_number}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            آخر تحديث: {new Date(record.updated_at).toLocaleDateString('en-GB')}
                          </p>
                        </div>
                        <History className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-200">
                    السجل المحدد: {selectedRecord.subscriber_name || 'غير محدد'}
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    رقم الحساب: {selectedRecord.account_number}
                  </p>
                </div>
                <button
                  onClick={handleClearSelection}
                  className="p-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* GPS Location */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            تحديد الموقع الحالي
          </h3>
          
          {gpsData ? (
            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
              <div className="flex items-center">
                <MapPin className="w-5 h-5 text-green-600 dark:text-green-400 ml-2" />
                <span className="text-green-800 dark:text-green-200 text-sm">
                  تم تحديد الموقع بنجاح
                </span>
              </div>
              <button
                onClick={() => setGpsData(null)}
                className="text-red-600 hover:text-red-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleGetLocation}
              disabled={gpsLoading}
              className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
            >
              <MapPin className="w-5 h-5 ml-2" />
              {gpsLoading ? 'جاري تحديد الموقع...' : 'تحديد الموقع الحالي'}
            </button>
          )}
        </div>

        {/* Meter Photo */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            صورة المقياس {!isRefused && <span className="text-red-500">*</span>}
          </h3>
          
          {isRefused ? (
            <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg text-center">
              <p className="text-gray-600 dark:text-gray-400">
                صورة المقياس غير مطلوبة في حالة الامتناع
              </p>
            </div>
          ) : meterPhoto ? (
            <div className="relative">
              <img 
                src={meterPhoto} 
                alt="صورة المقياس" 
                className="w-full h-48 object-cover rounded-lg"
              />
              <button
                onClick={() => setMeterPhoto(null)}
                className="absolute top-2 left-2 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => handlePhotoCapture('meter')}
              className="w-full flex items-center justify-center px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
            >
              <Camera className="w-5 h-5 ml-2" />
              التقاط صورة المقياس
            </button>
          )}
          
          <input
            ref={meterPhotoRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handlePhotoChange(e, 'meter')}
            className="hidden"
          />
          
        </div>

        {/* Invoice Photo */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            صورة الفاتورة <span className="text-red-500">*</span>
          </h3>
          
          {invoicePhoto ? (
            <div className="relative">
              <img 
                src={invoicePhoto} 
                alt="صورة الفاتورة" 
                className="w-full h-48 object-cover rounded-lg"
              />
              <button
                onClick={() => setInvoicePhoto(null)}
                className="absolute top-2 left-2 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => handlePhotoCapture('invoice')}
              className="w-full flex items-center justify-center px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
            >
              <Camera className="w-5 h-5 ml-2" />
              التقاط صورة الفاتورة
            </button>
          )}
          
          <input
            ref={invoicePhotoRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handlePhotoChange(e, 'invoice')}
            className="hidden"
          />
          
        </div>

        {/* Notes - Only show when creating new record */}
        {!selectedRecord && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <label className="block text-lg font-semibold text-gray-900 dark:text-white mb-4">
              الملاحظات
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-white transition-colors"
              placeholder="أضف أي ملاحظات..."
            />
          </div>
        )}

        {/* Additional Photos Notes - Only show when adding photos to existing record */}
        {selectedRecord && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 shadow-sm border border-blue-200 dark:border-blue-800">
            <label className="block text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4">
              ملاحظات الصور الإضافية
            </label>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
              هذه الملاحظة ستظهر مع جميع الصور الجديدة التي ستضيفها
            </p>
            <textarea
              value={additionalPhotosNotes}
              onChange={(e) => setAdditionalPhotosNotes(e.target.value)}
              placeholder="اكتب ملاحظة واحدة ستظهر مع جميع الصور الجديدة..."
              className="w-full px-4 py-3 border border-blue-300 dark:border-blue-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-white transition-colors"
              rows={3}
            />
          </div>
        )}

        {/* Refused Button */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          {!isRefused ? (
            <button
              onClick={handleRefused}
              className="w-full flex items-center justify-center px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
            >
              <AlertCircle className="w-5 h-5 ml-2" />
              امتنع عن الدفع
            </button>
          ) : (
            <button
              onClick={handleUnrefuse}
              className="w-full flex items-center justify-center px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
            >
              <CheckCircle className="w-5 h-5 ml-2" />
              إلغاء الامتناع
            </button>
          )}
        </div>

        {/* Submit Button */}
        <div className="pb-6">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center px-4 py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors font-semibold text-lg"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin ml-2"></div>
            ) : (
              <Send className="w-5 h-5 ml-2" />
            )}
            {isSubmitting ? 'جاري الإرسال...' : selectedRecord ? 'إضافة الصور للسجل الموجود' : 'إرسال البيانات'}
          </button>
        </div>
      </div>
    </div>
  );
}