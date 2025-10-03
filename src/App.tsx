import { lazy, Suspense, useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { LoginForm } from './components/LoginForm';
import OfflinePage from './components/OfflinePage';
import ConnectionStatus from './components/ConnectionStatus';

// Lazy load المكونات الكبيرة لتحسين الأداء
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const FieldAgentApp = lazy(() => import('./components/mobile/FieldAgentApp').then(module => ({ default: module.FieldAgentApp })));

function AppContent() {
  const { user, loading } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // عرض صفحة انقطاع الإنترنت إذا لم يكن هناك اتصال
  if (!isOnline) {
    return <OfflinePage />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  // Loading component للمكونات المحملة بشكل كسول
  const LoadingSpinner = () => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">جاري تحميل التطبيق...</p>
      </div>
    </div>
  );

  return (
    <>
      <ConnectionStatus />
      <Suspense fallback={<LoadingSpinner />}>
        {user.role === 'field_agent' ? <FieldAgentApp /> : <AdminDashboard />}
      </Suspense>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;