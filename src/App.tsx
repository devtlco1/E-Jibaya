import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { LoginForm } from './components/LoginForm';

// Lazy load المكونات الكبيرة لتحسين الأداء
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const FieldAgentApp = lazy(() => import('./components/mobile/FieldAgentApp').then(module => ({ default: module.FieldAgentApp })));

function AppContent() {
  const { user, loading } = useAuth();
  
  try {

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
    <Suspense fallback={<LoadingSpinner />}>
      {user.role === 'field_agent' ? <FieldAgentApp /> : <AdminDashboard />}
    </Suspense>
  );
  } catch (error) {
    console.error('Error in AppContent:', error);
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 mb-4">
            <h2 className="text-xl font-bold">خطأ في التطبيق</h2>
            <p className="text-sm">حدث خطأ غير متوقع. يرجى إعادة تحميل الصفحة.</p>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            إعادة تحميل الصفحة
          </button>
        </div>
      </div>
    );
  }
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