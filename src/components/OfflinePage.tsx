import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, Wifi } from 'lucide-react';

const OfflinePage: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // إعادة تحميل الصفحة عند عودة الاتصال
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    if (navigator.onLine) {
      window.location.reload();
    } else {
      // محاولة فحص الاتصال
      fetch('/api/health', { 
        method: 'HEAD',
        cache: 'no-cache'
      }).then(() => {
        window.location.reload();
      }).catch(() => {
        // لا يزال غير متصل
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* الشعار */}
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto mb-4 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <WifiOff className="w-12 h-12 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        {/* مؤشر الحالة */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">غير متصل</span>
        </div>

        {/* العنوان */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          انقطاع الإنترنت
        </h1>

        {/* الرسالة */}
        <div className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
          <p className="mb-2">لا يوجد اتصال بالإنترنت</p>
          <p>يرجى التحقق من الاتصال والمحاولة مرة أخرى</p>
        </div>

        {/* زر إعادة المحاولة */}
        <button
          onClick={handleRetry}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 flex items-center gap-2 mx-auto mb-8"
        >
          <RefreshCw className={`w-4 h-4 ${retryCount > 0 ? 'animate-spin' : ''}`} />
          إعادة المحاولة
        </button>

        {/* نصائح */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-right">
            نصائح لحل المشكلة:
          </h3>
          <ul className="text-right space-y-2 text-gray-600 dark:text-gray-300">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
              تحقق من اتصال Wi-Fi أو البيانات
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
              أعد تشغيل الراوتر
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
              تحقق من إعدادات الشبكة
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
              اتصل بمزود الخدمة
            </li>
          </ul>
        </div>

        {/* معلومات إضافية */}
        {retryCount > 0 && (
          <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            <p>عدد المحاولات: {retryCount}</p>
            {isOnline && (
              <div className="flex items-center justify-center gap-2 mt-2 text-green-600">
                <Wifi className="w-4 h-4" />
                <span>تم استعادة الاتصال!</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OfflinePage;
