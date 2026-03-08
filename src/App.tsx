import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { LoginForm } from './components/LoginForm';

// Lazy load المكونات الكبيرة لتحسين الأداء
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const FieldAgentApp = lazy(() => import('./components/mobile/FieldAgentApp').then(module => ({ default: module.FieldAgentApp })));

function AppFooter() {
  return (
    <footer className="mt-auto py-3 px-4 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
      <div className="flex flex-wrap items-center justify-between gap-3 max-w-6xl mx-auto">
        {/* يسار: نسخة النظام */}
        <div className="flex-shrink-0 text-end">
          <p>نسخة النظام 1.26.4</p>
        </div>
        {/* المنتصف: الشعار بجانب النص */}
        <div className="flex-1 min-w-0 flex flex-col items-center text-center">
          <p className="font-medium text-gray-700 dark:text-gray-300">نظام الجباية الإلكتروني</p>
          <p className="flex flex-wrap items-center justify-center gap-1 mt-0.5">
            جميع الحقوق محفوظة ©
            <img src="/logo-abraj.png" alt="أبراج الأنوار" className="h-6 w-auto object-contain inline-block align-middle" />
            شركة أبراج الأنوار للمقاولات والتجارة العامة والوكالات التجارية 2026
          </p>
        </div>
      </div>
    </footer>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  
  try {

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">جاري التحميل...</p>
          </div>
        </div>
        <AppFooter />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <div className="flex-1 flex items-center justify-center">
          <LoginForm />
        </div>
        <AppFooter />
      </div>
    );
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
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="flex-1 min-h-0">
        <Suspense fallback={<LoadingSpinner />}>
          {user.role === 'field_agent' ? <FieldAgentApp /> : <AdminDashboard />}
        </Suspense>
      </div>
      <AppFooter />
    </div>
  );
  } catch (error) {
    console.error('Error in AppContent:', error);
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <div className="flex-1 flex items-center justify-center">
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
        <AppFooter />
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