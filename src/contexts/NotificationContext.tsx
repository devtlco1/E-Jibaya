import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, XCircle, X, Bell } from 'lucide-react';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  createdAt: number;
}

export interface AddNotificationOptions {
  /** إظهار الإشعار كـ toast عائم (مثل صفحة تسجيل الدخول) */
  showAsToast?: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unseenCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>, options?: AddNotificationOptions) => void;
  removeNotification: (id: string) => void;
  markAllAsSeen: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

const MAX_NOTIFICATIONS = 100;

interface NotificationProviderProps {
  children: React.ReactNode;
}

const TOAST_DURATION = 5000;

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const [toastNotifications, setToastNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'createdAt'>, options?: AddNotificationOptions) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification: Notification = {
      ...notification,
      id,
      createdAt: Date.now()
    };

    setNotifications(prev => {
      const next = [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS);
      return next;
    });
    setUnseenCount(c => c + 1);

    if (options?.showAsToast) {
      setToastNotifications(prev => [...prev, newNotification]);
      const duration = notification.duration ?? TOAST_DURATION;
      setTimeout(() => {
        setToastNotifications(prev => prev.filter(n => n.id !== id));
      }, duration);
    }
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const markAllAsSeen = useCallback(() => {
    setUnseenCount(0);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unseenCount,
        addNotification,
        removeNotification,
        markAllAsSeen
      }}
    >
      {children}
      <ToastContainer toasts={toastNotifications} onRemove={id => setToastNotifications(prev => prev.filter(n => n.id !== id))} />
    </NotificationContext.Provider>
  );
}

function ToastContainer({ toasts, onRemove }: { toasts: Notification[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed z-[9999] space-y-2 inset-x-3 top-3 max-w-[calc(100vw-1.5rem)] sm:inset-x-auto sm:right-4 sm:left-auto sm:top-4 sm:w-[min(90vw,22rem)]"
      dir="rtl"
      aria-label="إشعارات"
    >
      {toasts.map(n => (
        <ToastItem key={n.id} notification={n} onRemove={() => onRemove(n.id)} />
      ))}
    </div>
  );
}

function ToastItem({ notification, onRemove }: { notification: Notification; onRemove: () => void }) {
  const getIcon = () => {
    switch (notification.type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />;
      case 'info': return <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />;
    }
  };
  const getBg = () => {
    switch (notification.type) {
      case 'success': return 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700';
      case 'error': return 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700';
      case 'warning': return 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700';
      case 'info': return 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700';
    }
  };
  return (
    <div className={`${getBg()} border rounded-xl shadow-lg p-3 sm:p-4 flex items-start gap-2 sm:gap-3 min-w-0`}>
      <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-white break-words">{notification.title}</p>
        {notification.message && (
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300 break-words line-clamp-4">{notification.message}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="flex-shrink-0 p-2 -m-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 touch-manipulation"
        aria-label="إغلاق"
      >
        <X className="w-5 h-5 sm:w-4 sm:h-4" />
      </button>
    </div>
  );
}

/** نمط الشارة: رقم (عدد الإشعارات) أو نقطة حمراء فقط كما في تطبيقات الموبايل */
export type NotificationBadgeStyle = 'number' | 'dot';

/** أيقونة الإشعارات مع العدد/النقطة الحمراء والقائمة — ضعها في الهيدر حيث تريد */
export function NotificationBell({ badgeStyle = 'number' }: { badgeStyle?: NotificationBadgeStyle }) {
  const { notifications, unseenCount, removeNotification, markAllAsSeen } = useNotifications();
  const [open, setOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) markAllAsSeen();
  };

  return (
    <div className="relative" ref={dropdownRef} dir="rtl">
      <button
        type="button"
        onClick={handleToggle}
        className="relative flex items-center justify-center p-2.5 sm:p-2 rounded-lg sm:rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation min-h-[44px] min-w-[44px]"
        aria-label="الإشعارات"
        title="الإشعارات"
      >
        <Bell className="w-6 h-6 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-300" />
        {unseenCount > 0 && (
          badgeStyle === 'dot' ? (
            <span className="absolute top-0.5 right-0.5 sm:top-0 sm:right-0 block h-2.5 w-2.5 sm:h-2 sm:w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-800" aria-label={`${unseenCount} إشعار جديد`} />
          ) : (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[1.25rem] sm:h-4 sm:min-w-[1rem] items-center justify-center rounded-full bg-red-500 text-[10px] sm:text-[10px] font-bold text-white px-1">
              {unseenCount > 99 ? '99+' : unseenCount}
            </span>
          )
        )}
      </button>

      {open && (
        <div className="fixed left-2 right-2 top-14 sm:absolute sm:left-0 sm:right-auto sm:top-full sm:mt-1 sm:w-[min(90vw,22rem)] w-auto max-h-[min(70vh,24rem)] sm:max-h-[70vh] overflow-hidden rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-xl z-[300] flex flex-col">
          <div className="flex items-center justify-between p-3 sm:p-3 border-b border-gray-200 dark:border-gray-600">
            <h3 className="text-sm sm:text-sm font-semibold text-gray-900 dark:text-white">الإشعارات</h3>
            {notifications.length > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {notifications.length} إشعار
              </span>
            )}
          </div>
          <div className="overflow-y-auto flex-1 overscroll-contain">
            {notifications.length === 0 ? (
              <div className="p-4 sm:p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                لا توجد إشعارات
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {notifications.map(n => (
                  <NotificationListItem
                    key={n.id}
                    notification={n}
                    onRemove={() => removeNotification(n.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationListItem({
  notification,
  onRemove
}: {
  notification: Notification;
  onRemove: () => void;
}) {
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />;
      case 'info':
        return <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    }
  };

  const getBg = () => {
    switch (notification.type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20';
      case 'info':
        return 'bg-blue-50 dark:bg-blue-900/20';
    }
  };

  return (
    <li className={`px-3 py-3 sm:py-2.5 ${getBg()} flex items-start gap-2 min-w-0`}>
      <div className="mt-0.5 flex-shrink-0">{getIcon()}</div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="text-sm font-medium text-gray-900 dark:text-white break-words">{notification.title}</p>
        {notification.message && (
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 break-words line-clamp-3">{notification.message}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="flex-shrink-0 p-2 -m-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="إغلاق"
      >
        <X className="w-4 h-4" />
      </button>
    </li>
  );
}
