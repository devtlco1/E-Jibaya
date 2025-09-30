import { createClient } from '@supabase/supabase-js';
import { User, CollectionRecord, CreateRecordData, UpdateRecordData, ActivityLog, CreateActivityLogData } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if Supabase is configured
const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && 
  supabaseUrl !== 'your-supabase-url' && 
  supabaseAnonKey !== 'your-supabase-anon-key';

if (!isSupabaseConfigured) {
  console.warn('Supabase not configured. Please set up Supabase connection.');
}

// Create Supabase client only if configured, otherwise use null
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Helper function to check if Supabase is available
const checkSupabaseConnection = () => {
  if (!supabase) {
    console.error('Supabase not configured. Please click the Supabase button in settings to set up your database connection.');
    return null;
  }
  return supabase;
};

// Database operations
export const dbOperations = {
  // Authentication
  async login(username: string, password: string): Promise<User | null> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        console.warn('Supabase not configured - cannot authenticate');
        return null;
      }
      
      console.log('Attempting login for username:', username);
      
      // Direct database authentication (bypass Supabase Auth)
      const { data: users, error } = await client
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password_hash', password)
        .single();

      if (error) {
        console.error('Login query error:', error.message);
        return null;
      }

      if (!users) {
        console.log('No user found with username:', username);
        return null;
      }

      // Check if user is active
      if (!users.is_active) {
        console.log('User account is deactivated:', username);
        // Return a special error indicator
        return { ...users, loginError: 'ACCOUNT_DISABLED' } as any;
      }
      
      console.log('Authentication successful for user:', { id: users.id, username: users.username, role: users.role });
      
      localStorage.setItem('ejibaya_user', JSON.stringify(users));
      
      // Log login activity
      await this.createActivityLog({
        user_id: users.id,
        action: 'login',
        target_type: 'system',
        target_name: 'النظام',
        details: { username: users.username, role: users.role }
      });
      
      console.log('Login successful, user stored in localStorage');
      return users;
    } catch (error) {
      console.error('Login error:', error);
      return null;
    }
  },

  
  async logout(): Promise<void> {
    localStorage.removeItem('ejibaya_user');
  },

  getCurrentUser(): User | null {
    const user = localStorage.getItem('ejibaya_user');
    return user ? JSON.parse(user) : null;
  },

  // Collection Records
  async getRecordsWithPagination(page: number = 1, limit: number = 10, filters: any = {}): Promise<{
    data: CollectionRecord[];
    total: number;
    totalPages: number;
  }> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        console.warn('Supabase not configured - returning empty records array');
        return { data: [], total: 0, totalPages: 0 };
      }
      
      let query = client
        .from('collection_records')
        .select('*', { count: 'exact' });

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          if (key === 'status') {
            // Handle special case for "refused" status
            if (value === 'refused') {
              query = query.eq('is_refused', true);
            } else {
              // For other statuses, check that it's not refused AND matches the status
              query = query.eq('is_refused', false).eq('status', value);
            }
          } else {
            query = query.ilike(key, `%${value}%`);
          }
        }
      });

      // Add pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      query = query
        .order('submitted_at', { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error('Get records with pagination error:', error);
        return { data: [], total: 0, totalPages: 0 };
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        data: data || [],
        total,
        totalPages
      };
    } catch (error) {
      console.error('Get records with pagination error:', error);
      return { data: [], total: 0, totalPages: 0 };
    }
  },

  async createRecord(record: CreateRecordData): Promise<CollectionRecord | null> {
    try {
      const client = checkSupabaseConnection();
      const { data, error } = await client
        .from('collection_records')
        .insert(record)
        .select()
        .single();

      if (error) {
        console.error('Create record error:', error);
        return null;
      }
      return data;
    } catch (error) {
      console.error('Create record error:', error);
      return null;
    }
  },

  async getRecords(): Promise<CollectionRecord[]> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        console.warn('Supabase not configured - returning empty records array');
        return [];
      }
      
      const { data, error } = await client
        .from('collection_records')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (error) {
        console.error('Get records error:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('Get records error:', error);
      return [];
    }
  },

  async updateRecord(id: string, updates: UpdateRecordData): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      const { error } = await client
        .from('collection_records')
        .update(updates)
        .eq('id', id);

      if (error) {
        console.error('Update record error:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Update record error:', error);
      return false;
    }
  },

  async deleteRecord(id: string): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      const { error } = await client
        .from('collection_records')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Delete record error:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Delete record error:', error);
      return false;
    }
  },

  // User Management
  async getUsers(): Promise<User[]> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        console.warn('Supabase not configured - returning empty users array');
        return [];
      }
      
      const { data, error } = await client
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Get users error:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('Get users error:', error);
      return [];
    }
  },

  async createUser(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User | null> {
    try {
      const client = checkSupabaseConnection();
      const { data, error } = await client
        .from('users')
        .insert(user)
        .select()
        .single();

      if (error) {
        console.error('Create user error:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Create user error:', error);
      return null;
    }
  },

  async updateUser(id: string, updates: Partial<User>): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      const { error } = await client
        .from('users')
        .update(updates)
        .eq('id', id);

      if (error) {
        console.error('Update user error:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Update user error:', error);
      return false;
    }
  },

  async deleteUser(id: string): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      const { error } = await client
        .from('users')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Delete user error:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Delete user error:', error);
      return false;
    }
  },

  // Generate unique image identifier
  generateImageId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5);
    return `IMG_${timestamp}_${random}`;
  },

  // Activity Logs
  async createActivityLog(logData: CreateActivityLogData): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      if (!client) return false;

      console.log('Creating activity log:', logData);

      // Try to get real IP address
      let ipAddress = logData.ip_address;
      if (!ipAddress) {
        try {
          // Try to get IP from a public service
          ipAddress = await this.getPublicIP();
        } catch (error) {
          console.warn('Could not fetch IP address:', error);
          ipAddress = null;
        }
      }

      const { error } = await client
        .from('activity_logs')
        .insert({
          ...logData,
          ip_address: ipAddress || 'غير متاح',
          user_agent: logData.user_agent || navigator.userAgent || null
        });

      if (error) {
        console.error('Create activity log error:', error);
        return false;
      }
      
      console.log('Activity log created successfully');
      return true;
    } catch (error) {
      console.error('Create activity log error:', error);
      return false;
    }
  },

  // Helper function to get public IP
  async getPublicIP(): Promise<string | null> {
    try {
      // Try to get IP from a public service with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
      
      const response = await fetch('https://api.ipify.org?format=json', {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      return data.ip || null;
    } catch (error) {
      return null;
    }
  },

  async getActivityLogs(page: number = 1, limit: number = 50): Promise<{
    data: ActivityLog[];
    total: number;
    totalPages: number;
  }> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        console.warn('Supabase not configured - returning empty activity logs');
        return { data: [], total: 0, totalPages: 0 };
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      console.log('Fetching activity logs:', { page, limit, from, to });

      // First, let's try to get data without RLS to test
      const { data: testData, error: testError } = await client
        .from('activity_logs')
        .select('*')
        .limit(5);

      console.log('Test query result:', { testData, testError });

      const { data, error, count } = await client
        .from('activity_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Get activity logs error:', error);
        console.error('Error details:', error.message, error.details, error.hint);
        console.error('Error details:', error.message, error.details, error.hint);
        return { data: [], total: 0, totalPages: 0 };
      }

      console.log('Activity logs fetched successfully:', { 
        dataCount: data?.length || 0, 
        total: count,
        firstRecord: data?.[0] 
      });

      console.log('Activity logs fetched successfully:', { 
        dataCount: data?.length || 0, 
        total: count,
        firstRecord: data?.[0] 
      });

      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        data: data || [],
        total,
        totalPages
      };
    } catch (error) {
      console.error('Get activity logs error:', error);
      return { data: [], total: 0, totalPages: 0 };
    }
  },

  // Photo upload helper
  async uploadPhoto(file: File, path: string): Promise<string | null> {
    try {
      const client = checkSupabaseConnection();
      if (!client) return null;
      
      // Ensure storage is initialized
      const storageReady = await this.initializeStorage();
      if (!storageReady) {
        return null;
      }
      
      const { data, error } = await client.storage
        .from('photos')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });

      if (error) {
        return null;
      }


      const { data: { publicUrl } } = client.storage
        .from('photos')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      return null;
    }
  },

  // Create storage buckets and folders
  async initializeStorage(): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      if (!client) return false;

      // Assume the 'photos' bucket is already created administratively

      return true;
    } catch (error) {
      return false;
    }
  }
};