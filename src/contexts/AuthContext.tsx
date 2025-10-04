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

  // Session timeout: 3 days
  const SESSION_TIMEOUT = 3 * 24 * 60 * 60 * 1000;

  // Function to clear corrupted localStorage data
  const clearCorruptedData = () => {
    try {
      console.log('Clearing corrupted localStorage data...');
      localStorage.removeItem('ejibaya_user');
      localStorage.removeItem('ejibaya_login_time');
      // Clear any other app-related localStorage items
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('ejibaya_')) {
          localStorage.removeItem(key);
        }
      });
      console.log('Corrupted data cleared successfully');
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  };

  // Function to validate user data structure
  const validateUserData = (userData: any): boolean => {
    try {
      if (!userData || typeof userData !== 'object') {
        return false;
      }
      
      // Check required fields
      const requiredFields = ['id', 'username', 'role', 'is_active'];
      for (const field of requiredFields) {
        if (!(field in userData)) {
          console.warn(`Missing required field: ${field}`);
          return false;
        }
      }
      
      // Check data types
      if (typeof userData.id !== 'string' || 
          typeof userData.username !== 'string' || 
          typeof userData.role !== 'string' ||
          typeof userData.is_active !== 'boolean') {
        console.warn('Invalid data types in user object');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error validating user data:', error);
      return false;
    }
  };

  useEffect(() => {
    setLoading(true);
    
    try {
      const currentUser = dbOperations.getCurrentUser();
      const loginTime = localStorage.getItem('ejibaya_login_time');
      
      // Validate user data structure
      if (currentUser && !validateUserData(currentUser)) {
        console.warn('Invalid user data structure detected, clearing data...');
        clearCorruptedData();
        setUser(null);
        setLoading(false);
        return;
      }
      
      // Check if session has expired
      if (currentUser && loginTime) {
        const timeDiff = Date.now() - parseInt(loginTime);
        if (timeDiff > SESSION_TIMEOUT) {
          // Session expired, logout user
          console.log('Session expired, logging out user');
          dbOperations.logout();
          setUser(null);
          setLoading(false);
          return;
        }
      }
      
      setUser(currentUser);
    } catch (error) {
      console.error('Error during authentication check:', error);
      // If there's any error, clear potentially corrupted data
      clearCorruptedData();
      setUser(null);
    }
    
    setLoading(false);
  }, []);

  // Check session validity periodically
  useEffect(() => {
    const checkSession = () => {
      try {
        const currentUser = dbOperations.getCurrentUser();
        const loginTime = localStorage.getItem('ejibaya_login_time');
        
        if (currentUser && loginTime) {
          const timeDiff = Date.now() - parseInt(loginTime);
          if (timeDiff > SESSION_TIMEOUT) {
            logout();
          }
        }
      } catch (error) {
        console.error('Error during session check:', error);
        // Clear corrupted data if session check fails
        clearCorruptedData();
        setUser(null);
      }
    };

    const interval = setInterval(checkSession, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    setLoading(true);
    try {
      const loggedInUser = await dbOperations.login(username, password);
      if (loggedInUser && !(loggedInUser as any).loginError) {
        // Validate the logged in user data
        if (validateUserData(loggedInUser)) {
          setUser(loggedInUser);
          setLoading(false);
          return true;
        } else {
          console.error('Invalid user data received from login');
          clearCorruptedData();
          setLoading(false);
          return false;
        }
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
        console.warn('Failed to log logout activity:', error);
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