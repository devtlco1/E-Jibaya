import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  MapPin, 
  Camera, 
  FileText, 
  X, 
  Send, 
  LogOut, 
  Moon, 
  Sun,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { CreateRecordData } from '../../types';
import { dbOperations } from '../../lib/supabase';

export function FieldAgentApp() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  
  const [gpsData, setGpsData] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [meterPhoto, setMeterPhoto] = useState<string | null>(null);
  const [invoicePhoto, setInvoicePhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isRefused, setIsRefused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const meterPhotoRef = useRef<HTMLInputElement>(null);
  const invoicePhotoRef = useRef<HTMLInputElement>(null);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('الموقع الجغرافي غير مدعوم في هذا المتصفح');
      return;
    }

    setGpsLoading(true);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsData({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setGpsLoading(false);
      },
      (error) => {
        console.error('خطأ في الحصول على الموقع:', error);
        alert('تعذر الحصول على الموقع الحالي');
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

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'meter' | 'invoice') => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('يرجى اختيار ملف صورة صحيح');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('حجم الصورة كبير جداً. يرجى اختيار صورة أصغر من 2 ميجابايت');
        return;
      }

      // Store file temporarily for upload
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        
        // Compress image if needed
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Calculate new dimensions (max 800px width/height)
          let { width, height } = img;
          const maxSize = 800;
          
          if (width > height && width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Convert to compressed JPEG
          const compressedResult = canvas.toDataURL('image/jpeg', 0.8);
          
          if (type === 'meter') {
            setMeterPhoto(compressedResult);
          } else {
            setInvoicePhoto(compressedResult);
          }
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRefused = () => {
    setIsRefused(true);
    setGpsData(null);
    setMeterPhoto(null);
    setInvoicePhoto(null);
    setNotes('');
  };

  const handleSubmit = async () => {
    if (!isRefused && (!gpsData || !meterPhoto)) {
      alert('يرجى التأكد من تحديد الموقع والتقاط صورة المقياس');
      return;
    }

    if (!user?.id) {
      alert('خطأ في تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let meterPhotoUrl = null;
      let invoicePhotoUrl = null;

      // Initialize storage first and wait for it
      const storageInitialized = await dbOperations.initializeStorage();
      if (!storageInitialized) {
        throw new Error('فشل في تهيئة نظام التخزين. تأكد من تشغيل migration التخزين أولاً');
      }

      // Upload meter photo if exists
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

      // Upload invoice photo if exists
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
        field_agent_id: user.id,
        gps_latitude: gpsData?.lat || null,
        gps_longitude: gpsData?.lng || null,
        meter_photo_url: meterPhotoUrl,
        invoice_photo_url: invoicePhotoUrl,
        notes: notes || null,
        is_refused: isRefused
      };

      const result = await dbOperations.createRecord(record);
      
      if (result) {
        // Log record creation activity
        const logResult = await dbOperations.createActivityLog({
          user_id: user.id,
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
        
        setSubmitted(true);
        
        // Reset form after 3 seconds
        setTimeout(() => {
          setSubmitted(false);
          setIsSubmitting(false);
          setGpsData(null);
          setMeterPhoto(null);
          setInvoicePhoto(null);
          setNotes('');
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
    } finally {
      // Remove this finally block since we handle setIsSubmitting in each case above
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
                disabled={isRefused}
                className="text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleGetLocation}
              disabled={gpsLoading || isRefused}
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
            صورة المقياس
          </h3>
          
          {meterPhoto ? (
            <div className="relative">
              <img 
                src={meterPhoto} 
                alt="صورة المقياس" 
                className="w-full h-48 object-cover rounded-lg"
              />
              <button
                onClick={() => setMeterPhoto(null)}
                disabled={isRefused}
                className="absolute top-2 left-2 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => handlePhotoCapture('meter')}
              disabled={isRefused}
              className="w-full flex items-center justify-center px-4 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
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
            صورة الفاتورة
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

        {/* Notes */}
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

        {/* Refused Button */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <button
            onClick={handleRefused}
            disabled={isRefused}
            className="w-full flex items-center justify-center px-4 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
          >
            <AlertCircle className="w-5 h-5 ml-2" />
            {isRefused ? 'تم تسجيل الامتناع' : 'امتنع عن الدفع'}
          </button>
          
          {isRefused && (
            <p className="text-center text-red-600 dark:text-red-400 text-sm mt-2">
              تم تعطيل جميع الحقول بسبب امتناع العميل
            </p>
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
            {isSubmitting ? 'جاري الإرسال...' : 'إرسال البيانات'}
          </button>
        </div>
      </div>
    </div>
  );
}