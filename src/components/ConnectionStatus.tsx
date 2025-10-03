import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, X } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const ConnectionStatus: React.FC = () => {
  const { isOnline, wasOffline } = useOnlineStatus();
  const [showNotification, setShowNotification] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isOnline) {
      setMessage('انقطع الاتصال بالإنترنت');
      setShowNotification(true);
    } else if (wasOffline) {
      setMessage('تم استعادة الاتصال بالإنترنت');
      setShowNotification(true);
      
      // إخفاء الإشعار بعد 3 ثوان
      setTimeout(() => {
        setShowNotification(false);
      }, 3000);
    }
  }, [isOnline, wasOffline]);

  const handleClose = () => {
    setShowNotification(false);
  };

  if (!showNotification) {
    return null;
  }

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-sm w-full mx-4 transition-all duration-300 ${
      showNotification ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
    }`}>
      <div className={`p-4 rounded-lg shadow-lg border-l-4 ${
        isOnline 
          ? 'bg-green-50 border-green-500 text-green-800 dark:bg-green-900/20 dark:text-green-300' 
          : 'bg-red-50 border-red-500 text-red-800 dark:bg-red-900/20 dark:text-red-300'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isOnline ? (
              <Wifi className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-600 dark:text-red-400" />
            )}
            <span className="font-medium">{message}</span>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectionStatus;
