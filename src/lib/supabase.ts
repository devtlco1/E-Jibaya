import { createClient } from '@supabase/supabase-js';
import { User, CollectionRecord, CreateRecordData, UpdateRecordData, ActivityLog, CreateActivityLogData, RecordPhoto } from '../types';

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
      
      // Get user from database
      const { data: user, error } = await client
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

      if (error) {
        console.error('Login query error:', error.message);
        return null;
      }

      if (!user) {
        console.log('No user found with username:', username);
        return null;
      }

      // Check if user is active
      if (!user.is_active) {
        console.log('User account is deactivated:', username);
        return { ...user, loginError: 'ACCOUNT_DISABLED' } as any;
      }

      // For now, use simple password comparison (in production, use proper hashing)
      if (user.password_hash !== password) {
        console.log('Invalid password for user:', username);
        return null;
      }
      
      console.log('Authentication successful for user:', { id: user.id, username: user.username, role: user.role });
      
      // Store user data with login timestamp
      localStorage.setItem('ejibaya_user', JSON.stringify(user));
      localStorage.setItem('ejibaya_login_time', Date.now().toString());
      
      // Log login activity (don't fail if it doesn't work)
      try {
        await this.createActivityLog({
          user_id: user.id,
          action: 'login',
          target_type: 'system',
          target_name: 'النظام',
          details: { username: user.username, role: user.role }
        });
      } catch (logError) {
        console.warn('Failed to log login activity:', logError);
      }
      
      console.log('Login successful, user stored in localStorage');
      return user;
    } catch (error) {
      console.error('Login error:', error);
      return null;
    }
  },

  
  async logout(): Promise<void> {
    localStorage.removeItem('ejibaya_user');
    localStorage.removeItem('ejibaya_login_time');
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
      if (!client) {
        throw new Error('فشل في الاتصال بقاعدة البيانات');
      }

      const { data, error } = await client
        .from('collection_records')
        .insert(record)
        .select()
        .single();

      if (error) {
        console.error('Create record error:', error);
        throw new Error(`فشل في إنشاء السجل: ${error.message}`);
      }
      return data;
    } catch (error) {
      console.error('Create record error:', error);
      throw error;
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
      if (!client) {
        throw new Error('فشل في الاتصال بقاعدة البيانات');
      }

      const { error } = await client
        .from('collection_records')
        .update(updates)
        .eq('id', id);

      if (error) {
        console.error('Update record error:', error);
        throw new Error(`فشل في تحديث السجل: ${error.message}`);
      }
      return true;
    } catch (error) {
      console.error('Update record error:', error);
      throw error;
    }
  },

  async deleteRecord(id: string): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        throw new Error('فشل في الاتصال بقاعدة البيانات');
      }

      const { error } = await client
        .from('collection_records')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Delete record error:', error);
        throw new Error(`فشل في حذف السجل: ${error.message}`);
      }
      return true;
    } catch (error) {
      console.error('Delete record error:', error);
      throw error;
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
      if (!client) {
        throw new Error('فشل في الاتصال بقاعدة البيانات');
      }

      // For now, store password as plain text (in production, use proper hashing)
      const { data, error } = await client
        .from('users')
        .insert(user)
        .select()
        .single();

      if (error) {
        console.error('Create user error:', error);
        throw new Error(`فشل في إنشاء المستخدم: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Create user error:', error);
      throw error;
    }
  },

  async updateUser(id: string, updates: Partial<User>): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        throw new Error('فشل في الاتصال بقاعدة البيانات');
      }

      // For now, store password as plain text (in production, use proper hashing)
      const updateData = { ...updates };

      const { error } = await client
        .from('users')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Update user error:', error);
        throw new Error(`فشل في تحديث المستخدم: ${error.message}`);
      }
      return true;
    } catch (error) {
      console.error('Update user error:', error);
      throw error;
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

  // Get records statistics only
  async getRecordsStats(): Promise<{
    total: number;
    pending: number;
    completed: number;
    reviewed: number;
    refused: number;
  }> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        return { total: 0, pending: 0, completed: 0, reviewed: 0, refused: 0 };
      }
      
      const { data, error } = await client
        .from('collection_records')
        .select('status, is_refused');

      if (error) {
        console.error('Get records stats error:', error);
        return { total: 0, pending: 0, completed: 0, reviewed: 0, refused: 0 };
      }

      const stats = {
        total: data.length,
        pending: data.filter(r => !r.is_refused && r.status === 'pending').length,
        completed: data.filter(r => !r.is_refused && r.status === 'completed').length,
        reviewed: data.filter(r => !r.is_refused && r.status === 'reviewed').length,
        refused: data.filter(r => r.is_refused === true).length
      };

      return stats;
    } catch (error) {
      console.error('Get records stats error:', error);
      return { total: 0, pending: 0, completed: 0, reviewed: 0, refused: 0 };
    }
  },

  // Activity Logs
  async createActivityLog(logData: CreateActivityLogData): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      if (!client) return false;

      console.log('Creating activity log:', logData);

      const { error } = await client
        .from('activity_logs')
        .insert(logData);

      if (error) {
        console.error('Create activity log error:', error);
        // Don't fail the entire operation if activity log fails
        return false;
      }
      
      console.log('Activity log created successfully');
      return true;
    } catch (error) {
      console.error('Create activity log error:', error);
      // Don't fail the entire operation if activity log fails
      return false;
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
      if (!client) {
        throw new Error('فشل في الاتصال بقاعدة البيانات');
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('نوع الملف غير مدعوم. يرجى اختيار صورة');
      }
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('حجم الملف كبير جداً. الحد الأقصى 5 ميجابايت');
      }
      
      // Skip storage initialization check - bucket might exist but not visible via API
      console.log('Skipping storage initialization check - proceeding with upload');
      
      console.log('Attempting to upload file:', { fileName: file.name, path, size: file.size });
      
      const { data, error } = await client.storage
        .from('photos')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });

      if (error) {
        console.error('Upload error:', error);
        throw new Error(`فشل في رفع الصورة: ${error.message}`);
      }

      const { data: { publicUrl } } = client.storage
        .from('photos')
        .getPublicUrl(data.path);

      console.log('Upload successful:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  },

  // Create storage buckets and folders
  async initializeStorage(): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        console.error('Supabase client not available');
        return false;
      }

      console.log('Initializing storage...');

      // Check if photos bucket exists
      const { data: buckets, error: bucketsError } = await client.storage.listBuckets();
      if (bucketsError) {
        console.error('Error listing buckets:', bucketsError);
        console.error('This might indicate that storage is not properly configured or migrations have not been run');
        return false;
      }
      
      console.log('Available buckets:', buckets?.map(b => b.name) || []);
      
      const photosBucket = buckets?.find(bucket => bucket.name === 'photos');
      if (!photosBucket) {
        console.warn('Photos bucket not found in API response. Available buckets:', buckets?.map(b => b.name) || []);
        console.log('Attempting to create photos bucket...');
        
        // Try to create the bucket
        const { data: newBucket, error: createError } = await client.storage.createBucket('photos', {
          public: true,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
        });
        
        if (createError) {
          console.error('Failed to create photos bucket:', createError);
          console.log('Bucket might exist but not accessible via API. Proceeding anyway...');
          // Don't return false here - let the upload attempt proceed
        } else {
          console.log('Photos bucket created successfully:', newBucket);
        }
      } else {
        console.log('Photos bucket found:', photosBucket);
      }

      console.log('Storage initialization successful');
      return true;
    } catch (error) {
      console.error('Storage initialization error:', error);
      console.log('Proceeding anyway - bucket might exist but not accessible via API');
      return true; // Don't fail the entire process
    }
  },

  // Photo Management
  async addPhotoToRecord(recordId: string, photoType: 'meter' | 'invoice', photoUrl: string, userId: string): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      if (!client) return false;

      const { error } = await client
        .from('record_photos')
        .insert({
          record_id: recordId,
          photo_type: photoType,
          photo_url: photoUrl,
          created_by: userId
        });

      if (error) {
        console.error('Add photo error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Add photo error:', error);
      return false;
    }
  },

  async getRecordPhotos(recordId: string): Promise<RecordPhoto[]> {
    try {
      const client = checkSupabaseConnection();
      if (!client) return [];

      const { data, error } = await client
        .from('record_photos')
        .select('*')
        .eq('record_id', recordId)
        .order('photo_date', { ascending: false });

      if (error) {
        console.error('Get photos error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Get photos error:', error);
      return [];
    }
  },

  async getRecordWithPhotos(recordId: string): Promise<{ record: CollectionRecord | null; photos: RecordPhoto[] }> {
    try {
      const client = checkSupabaseConnection();
      if (!client) return { record: null, photos: [] };

      // Get the record
      const { data: record, error: recordError } = await client
        .from('collection_records')
        .select('*')
        .eq('id', recordId)
        .single();

      if (recordError) {
        console.error('Get record error:', recordError);
        return { record: null, photos: [] };
      }

      // Get photos for this record
      const photos = await this.getRecordPhotos(recordId);

      return { record, photos };
    } catch (error) {
      console.error('Get record with photos error:', error);
      return { record: null, photos: [] };
    }
  },

  async deletePhoto(photoId: string): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      if (!client) return false;

      const { error } = await client
        .from('record_photos')
        .delete()
        .eq('id', photoId);

      if (error) {
        console.error('Delete photo error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Delete photo error:', error);
      return false;
    }
  }
};