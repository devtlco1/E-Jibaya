import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  
  // If it's a localStorage error, try to clear corrupted data
  if (event.error?.message?.includes('localStorage') || 
      event.error?.message?.includes('QuotaExceededError')) {
    try {
      localStorage.clear();
      console.log('Cleared localStorage due to error');
    } catch (clearError) {
      console.error('Failed to clear localStorage:', clearError);
    }
  }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Check if root element exists
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('Root element not found!');
  document.body.innerHTML = `
    <div style="
      display: flex; 
      justify-content: center; 
      align-items: center; 
      height: 100vh; 
      font-family: Arial, sans-serif;
      background: #f3f4f6;
      color: #374151;
    ">
      <div style="text-align: center;">
        <h1>خطأ في تحميل التطبيق</h1>
        <p>يرجى إعادة تحميل الصفحة أو مسح بيانات المتصفح</p>
        <button onclick="window.location.reload()" style="
          background: #3b82f6; 
          color: white; 
          border: none; 
          padding: 10px 20px; 
          border-radius: 5px; 
          cursor: pointer;
          margin-top: 10px;
        ">
          إعادة تحميل
        </button>
      </div>
    </div>
  `;
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
