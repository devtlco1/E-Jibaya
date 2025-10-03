import { useState, useEffect } from 'react';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        // إشعار المستخدم بعودة الاتصال
        console.log('تم استعادة الاتصال بالإنترنت');
        setWasOffline(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      console.log('انقطع الاتصال بالإنترنت');
    };

    // فحص الاتصال بشكل دوري
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/health', {
          method: 'HEAD',
          cache: 'no-cache',
          timeout: 5000
        });
        if (response.ok && !isOnline) {
          setIsOnline(true);
          setWasOffline(false);
        }
      } catch (error) {
        if (isOnline) {
          setIsOnline(false);
          setWasOffline(true);
        }
      }
    };

    // إضافة مستمعي الأحداث
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // فحص الاتصال كل 30 ثانية
    const interval = setInterval(checkConnection, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [isOnline, wasOffline]);

  return { isOnline, wasOffline };
};
