import { createClient } from '@supabase/supabase-js';
import { User, CollectionRecord, CreateRecordData, UpdateRecordData, ActivityLog, CreateActivityLogData, RecordPhoto } from '../types';
import { hashPassword, verifyPassword } from '../utils/hash';
import { rateLimiter } from '../utils/rateLimiter';
import { cacheService } from '../utils/cache';

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
      
      // Rate limiting للحماية من هجمات Brute Force
      const rateLimitKey = `login_${username}`;
      if (!rateLimiter.isAllowed(rateLimitKey, 5, 15 * 60 * 1000)) {
        console.log('Too many login attempts for user:', username);
        return { ...{} as User, loginError: 'TOO_MANY_ATTEMPTS' } as any;
      }
      
      console.log('Attempting login for username:', username);
      
      // التحقق من صحة البيانات المدخلة
      if (!username || !password) {
        console.log('Missing username or password');
        return null;
      }
      
      // Get user from database
      const { data: user, error } = await client
        .from('users')
        .select('*')
        .eq('username', username)
        .maybeSingle();

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

      // التحقق من كلمة المرور المشفرة
      const isValidPassword = await verifyPassword(password, user.password_hash);
      if (!isValidPassword) {
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
      
      // مسح محاولات تسجيل الدخول الفاشلة
      rateLimiter.clearUser(rateLimitKey);
      
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
      
      // تم تعطيل التخزين المؤقت مؤقتاً
      console.log('Record created successfully');
      
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
      
      // تعطيل التخزين المؤقت مؤقتاً لحل مشكلة البيانات
      console.log('Fetching fresh data from database (cache disabled)');
      
      const { data, error } = await client
        .from('collection_records')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (error) {
        console.error('Get records error:', error);
        return [];
      }
      
      const records = data || [];
      console.log(`Fetched ${records.length} records from database`);
      
      return records;
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
      
      // تم تعطيل التخزين المؤقت مؤقتاً
      console.log('Record updated successfully');
      
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
      
      // تم تعطيل التخزين المؤقت مؤقتاً
      console.log('Record deleted successfully');
      
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

      // تشفير كلمة المرور
      const hashedPassword = await hashPassword(user.password_hash);
      
      const userData = {
        ...user,
        password_hash: hashedPassword
      };

      const { data, error } = await client
        .from('users')
        .insert(userData)
        .select()
        .single();

      if (error) {
        console.error('Create user error:', error);
        throw new Error(`فشل في إنشاء المستخدم: ${error.message}`);
      }

      // مسح التخزين المؤقت بعد إنشاء مستخدم جديد
      cacheService.clearUsersCache();

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

      const updateData = { ...updates };
      
      // تشفير كلمة المرور إذا تم تحديثها
      if (updates.password_hash) {
        updateData.password_hash = await hashPassword(updates.password_hash);
      }

      const { error } = await client
        .from('users')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Update user error:', error);
        throw new Error(`فشل في تحديث المستخدم: ${error.message}`);
      }
      
      // مسح التخزين المؤقت بعد تحديث المستخدم
      cacheService.clearUsersCache();
      
      return true;
    } catch (error) {
      console.error('Update user error:', error);
      throw error;
    }
  },

  async deleteUser(id: string): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        throw new Error('فشل في الاتصال بقاعدة البيانات');
      }
      
      const { error } = await client
        .from('users')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Delete user error:', error);
        return false;
      }
      
      // مسح التخزين المؤقت بعد حذف المستخدم
      cacheService.clearUsersCache();
      
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
  async addPhotoToRecord(recordId: string, photoType: 'meter' | 'invoice', photoUrl: string, userId: string, notes?: string): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      if (!client) return false;

      const { error } = await client
        .from('record_photos')
        .insert({
          record_id: recordId,
          photo_type: photoType,
          photo_url: photoUrl,
          created_by: userId,
          notes: notes || null
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
  },

  // ==============================================
  // Backup Functions
  // ==============================================

  async getAllUsers(): Promise<any[]> {
    try {
      if (!supabase) throw new Error('Supabase not configured');
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching all users:', error);
      throw error;
    }
  },

  async getAllRecords(): Promise<any[]> {
    try {
      if (!supabase) throw new Error('Supabase not configured');
      
      const { data, error } = await supabase
        .from('collection_records')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching all records:', error);
      throw error;
    }
  },

  async getAllActivityLogs(): Promise<any[]> {
    try {
      if (!supabase) throw new Error('Supabase not configured');
      
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching all activity logs:', error);
      throw error;
    }
  },

  async getAllRecordPhotos(): Promise<any[]> {
    try {
      if (!supabase) throw new Error('Supabase not configured');
      
      const { data, error } = await supabase
        .from('record_photos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching all record photos:', error);
      throw error;
    }
  },

  async getAllUserSessions(): Promise<any[]> {
    try {
      if (!supabase) throw new Error('Supabase not configured');
      
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching all user sessions:', error);
      throw error;
    }
  },

  // ==============================================
  // Backup Info Functions
  // ==============================================

  async saveBackupInfo(backupInfo: {
    backup_date: string;
    total_records: number;
    total_photos: number;
    total_users: number;
    backup_type: string;
    file_name: string;
    backup_name?: string;
    file_size?: number;
    file_path?: string;
    description?: string;
  }): Promise<void> {
    try {
      if (!supabase) throw new Error('Supabase not configured');
      
      console.log('Attempting to save backup info...');
      
      const { error } = await supabase
        .from('backup_info')
        .insert({
          backup_name: backupInfo.backup_name || `Backup_${new Date().toISOString().split('T')[0]}`,
          backup_type: backupInfo.backup_type,
          file_name: backupInfo.file_name,
          file_size: backupInfo.file_size,
          file_path: backupInfo.file_path,
          backup_date: backupInfo.backup_date,
          total_records: backupInfo.total_records,
          total_photos: backupInfo.total_photos,
          total_users: backupInfo.total_users,
          status: 'completed',
          description: backupInfo.description,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error saving backup info:', error);
        // إذا فشل الحفظ، لا نرمي الخطأ بل نطبع تحذير فقط
        console.warn('Backup info could not be saved to database, but backup file was created successfully');
        return;
      }
      
      console.log('Backup info saved successfully');
    } catch (error) {
      console.error('Error saving backup info:', error);
      // لا نرمي الخطأ، فقط نطبع تحذير
      console.warn('Backup info could not be saved to database, but backup file was created successfully');
    }
  },

  async getBackupInfo(): Promise<any | null> {
    try {
      if (!supabase) throw new Error('Supabase not configured');
      
      const { data, error } = await supabase
        .from('backup_info')
        .select('*')
        .order('backup_date', { ascending: false })
        .limit(1);

      if (error) {
        console.warn('Backup info table not accessible:', error.message);
        return null;
      }
      
      // إرجاع أول سجل أو null إذا لم توجد سجلات
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.warn('Error fetching backup info:', error);
      return null;
    }
  },

  // ==============================================
  // Restore Backup Functions
  // ==============================================

  async restoreBackup(backupData: any): Promise<{ success: boolean; message: string; restoredCounts: any }> {
    try {
      if (!supabase) throw new Error('Supabase not configured');

      const restoredCounts = {
        users: 0,
        records: 0,
        photos: 0,
        activityLogs: 0,
        sessions: 0
      };

      // مسح جميع البيانات الموجودة لتجنب التضارب
      console.log('Clearing existing data before restore...');
      
      // مسح الجلسات
      await supabase.from('user_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // مسح سجل الأنشطة
      await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // مسح الصور
      await supabase.from('record_photos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // مسح السجلات
      await supabase.from('collection_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // مسح المستخدمين (بما في ذلك المحذوفين)
      await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // 1. استعادة المستخدمين
      if (backupData.users && backupData.users.length > 0) {
        const { error: usersError } = await supabase
          .from('users')
          .insert(backupData.users);
        
        if (usersError) throw usersError;
        restoredCounts.users = backupData.users.length;
      }

      // 2. استعادة السجلات
      if (backupData.collection_records && backupData.collection_records.length > 0) {
        const { error: recordsError } = await supabase
          .from('collection_records')
          .insert(backupData.collection_records);
        
        if (recordsError) throw recordsError;
        restoredCounts.records = backupData.collection_records.length;
      }

      // 3. استعادة الصور
      if (backupData.record_photos && backupData.record_photos.length > 0) {
        const { error: photosError } = await supabase
          .from('record_photos')
          .insert(backupData.record_photos);
        
        if (photosError) throw photosError;
        restoredCounts.photos = backupData.record_photos.length;
      }

      // 4. استعادة سجل الأنشطة
      if (backupData.activity_logs && backupData.activity_logs.length > 0) {
        const { error: logsError } = await supabase
          .from('activity_logs')
          .insert(backupData.activity_logs);
        
        if (logsError) throw logsError;
        restoredCounts.activityLogs = backupData.activity_logs.length;
      }

      // 5. استعادة الجلسات
      if (backupData.user_sessions && backupData.user_sessions.length > 0) {
        const { error: sessionsError } = await supabase
          .from('user_sessions')
          .insert(backupData.user_sessions);
        
        if (sessionsError) throw sessionsError;
        restoredCounts.sessions = backupData.user_sessions.length;
      }

      return {
        success: true,
        message: 'تم استعادة النسخة الاحتياطية بنجاح',
        restoredCounts
      };

    } catch (error) {
      console.error('Error restoring backup:', error);
      
      let errorMessage = 'فشل في استعادة النسخة الاحتياطية';
      
      if (error instanceof Error) {
        errorMessage = `فشل في استعادة النسخة الاحتياطية: ${error.message}`;
      } else if (typeof error === 'object' && error !== null) {
        // Handle Supabase errors
        const supabaseError = error as any;
        if (supabaseError.message) {
          errorMessage = `فشل في استعادة النسخة الاحتياطية: ${supabaseError.message}`;
        } else if (supabaseError.details) {
          errorMessage = `فشل في استعادة النسخة الاحتياطية: ${supabaseError.details}`;
        }
      }
      
      return {
        success: false,
        message: errorMessage,
        restoredCounts: {}
      };
    }
  }
};