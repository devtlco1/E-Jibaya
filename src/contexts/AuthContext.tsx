import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthContextType } from '../types';
import { dbOperations } from '../lib/supabase';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const currentUser = dbOperations.getCurrentUser();
    setUser(currentUser);
    setLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    setLoading(true);
    try {
      const loggedInUser = await dbOperations.login(username, password);
      if (loggedInUser && !(loggedInUser as any).loginError) {
        setUser(loggedInUser);
        setLoading(false);
        return true;
      } else if ((loggedInUser as any)?.loginError === 'ACCOUNT_DISABLED') {
        // Handle disabled account case
        setLoading(false);
        return false;
      }
      setLoading(false);
      return false;
    } catch (error) {
      console.error('Login error:', error);
      setLoading(false);
      return false;
    }
  };

  const logout = async () => {
    setLoading(true);
    const currentUser = dbOperations.getCurrentUser();
    
    // Log logout activity before clearing user data
    if (currentUser) {
      try {
        await dbOperations.createActivityLog({
          user_id: currentUser.id,
          action: 'logout',
          target_type: 'system',
          target_name: 'النظام',
          details: { username: currentUser.username }
        });
      } catch (error) {
        console.error('Error logging logout activity:', error);
      }
    }
    
    await dbOperations.logout();
    setUser(null);
    setLoading(false);
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}