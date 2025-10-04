import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../LoginForm';
import { AuthProvider } from '../../contexts/AuthContext';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { NotificationProvider } from '../../contexts/NotificationContext';

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  dbOperations: {
    login: vi.fn(),
    getCurrentUser: vi.fn(() => null),
    logout: vi.fn(),
  },
}));

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      <NotificationProvider>
        <AuthProvider>
          {component}
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
};

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('يجب أن يعرض حقول تسجيل الدخول', () => {
    renderWithProviders(<LoginForm />);
    
    expect(screen.getByLabelText(/اسم المستخدم/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/كلمة المرور/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /تسجيل الدخول/i })).toBeInTheDocument();
  });

  it('يجب أن يتحقق من صحة البيانات المطلوبة', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);
    
    const submitButton = screen.getByRole('button', { name: /تسجيل الدخول/i });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/يرجى إدخال اسم المستخدم/i)).toBeInTheDocument();
    });
  });

  it('يجب أن يسمح بإدخال البيانات', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);
    
    const usernameInput = screen.getByLabelText(/اسم المستخدم/i);
    const passwordInput = screen.getByLabelText(/كلمة المرور/i);
    
    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'testpass');
    
    expect(usernameInput).toHaveValue('testuser');
    expect(passwordInput).toHaveValue('testpass');
  });

  it('يجب أن يعرض أزرار تسجيل الدخول السريع', () => {
    renderWithProviders(<LoginForm />);
    
    expect(screen.getByText(/تسجيل دخول سريع/i)).toBeInTheDocument();
    expect(screen.getByText(/👨‍💼 مدير/i)).toBeInTheDocument();
    expect(screen.getByText(/👨‍🔧 محصل/i)).toBeInTheDocument();
  });

  it('يجب أن يملأ البيانات عند النقر على زر سريع', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);
    
    const adminButton = screen.getByText(/👨‍💼 مدير/i);
    await user.click(adminButton);
    
    const usernameInput = screen.getByLabelText(/اسم المستخدم/i);
    const passwordInput = screen.getByLabelText(/كلمة المرور/i);
    
    expect(usernameInput).toHaveValue('admin');
    expect(passwordInput).toHaveValue('admin123');
  });

  it('يجب أن يعرض زر تبديل الوضع الليلي/النهاري', () => {
    renderWithProviders(<LoginForm />);
    
    const themeButton = screen.getByLabelText(/تبديل إلى الوضع الليلي/i);
    expect(themeButton).toBeInTheDocument();
  });

  it('يجب أن يعرض زر إظهار/إخفاء كلمة المرور', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);
    
    const passwordInput = screen.getByLabelText(/كلمة المرور/i);
    const toggleButton = passwordInput.parentElement?.querySelector('button');
    
    expect(toggleButton).toBeInTheDocument();
    
    // النقر على زر إظهار كلمة المرور
    await user.click(toggleButton!);
    expect(passwordInput).toHaveAttribute('type', 'text');
    
    // النقر مرة أخرى لإخفاء كلمة المرور
    await user.click(toggleButton!);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
