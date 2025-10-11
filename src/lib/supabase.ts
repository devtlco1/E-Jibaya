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

// Singleton pattern for Supabase client to avoid multiple instances
let supabaseInstance: any = null;

const getSupabaseClient = () => {
  if (!isSupabaseConfigured) {
    return null;
  }
  
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  
  return supabaseInstance;
};

export const supabase = getSupabaseClient();

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
  // Expose supabase client for direct access
  supabase,
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
      const { data: users, error } = await client
        .from('users')
        .select('*')
        .eq('username', username);

      if (error) {
        console.error('Login query error:', error.message);
        return null;
      }

      if (!users || users.length === 0) {
        console.log('No user found with username:', username);
        return null;
      }

      if (users.length > 1) {
        console.log('Multiple users found with username:', username);
        return null;
      }

      const user = users[0];

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
      
      // مسح التخزين المؤقت نهائياً
      cacheService.clearRecordsCache();
      cacheService.clearUsersCache();
      localStorage.removeItem('ejibaya_cache');
      console.log('Record created successfully - cache cleared');
      
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
      
      // مسح التخزين المؤقت نهائياً
      cacheService.clearRecordsCache();
      cacheService.clearUsersCache();
      localStorage.removeItem('ejibaya_cache');
      
      console.log('Fetching fresh data from database (cache completely disabled)');
      
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

      console.log('Updating record:', { id, updates });
      console.log('Verification status being sent:', updates.verification_status);
      console.log('Meter photo verified:', updates.meter_photo_verified);
      console.log('Invoice photo verified:', updates.invoice_photo_verified);

      const { data, error } = await client
        .from('collection_records')
        .update(updates)
        .eq('id', id)
        .select();

      if (error) {
        console.error('Update record error:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw new Error(`فشل في تحديث السجل: ${error.message}`);
      }

      console.log('Record updated successfully:', data);
      console.log('Updated fields:', Object.keys(updates));
      console.log('Update result:', data);
      
      // التحقق من أن التحديث حدث فعلياً
      if (data && data.length > 0) {
        const updatedRecord = data[0];
        console.log('Verification of updated fields:');
        Object.keys(updates).forEach(key => {
          console.log(`${key}: expected=${(updates as any)[key]}, actual=${updatedRecord[key]}`);
        });
      } else {
        console.warn('No data returned from update operation');
      }
      
      // مسح التخزين المؤقت نهائياً
      cacheService.clearRecordsCache();
      cacheService.clearUsersCache();
      localStorage.removeItem('ejibaya_cache');
      console.log('Record updated successfully - cache cleared');
      
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

      // حذف السجلات المرتبطة أولاً
      console.log('Deleting related records for:', id);
      
      // حذف سجلات التغييرات
      const { error: changesError } = await client
        .from('record_changes_log')
        .delete()
        .eq('record_id', id);
      
      if (changesError) {
        console.error('Error deleting record changes:', changesError);
        throw new Error(`فشل في حذف سجلات التغييرات: ${changesError.message}`);
      }

      // حذف الصور الإضافية
      const { error: photosError } = await client
        .from('record_photos')
        .delete()
        .eq('record_id', id);
      
      if (photosError) {
        console.error('Error deleting record photos:', photosError);
        throw new Error(`فشل في حذف الصور: ${photosError.message}`);
      }

      // حذف سجل النشاط
      const { error: activityError } = await client
        .from('activity_logs')
        .delete()
        .eq('target_id', id);
      
      if (activityError) {
        console.error('Error deleting activity logs:', activityError);
        // لا نوقف العملية إذا فشل حذف سجل النشاط
        console.warn('Warning: Could not delete activity logs, continuing...');
      }

      // حذف السجل الرئيسي
      const { error } = await client
        .from('collection_records')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Delete record error:', error);
        throw new Error(`فشل في حذف السجل: ${error.message}`);
      }
      
      // مسح التخزين المؤقت نهائياً
      cacheService.clearRecordsCache();
      cacheService.clearUsersCache();
      localStorage.removeItem('ejibaya_cache');
      console.log('Record and related data deleted successfully - cache cleared');
      
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
    verified: number;
    refused: number;
  }> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        return { total: 0, pending: 0, completed: 0, verified: 0, refused: 0 };
      }
      
      const { data, error } = await client
        .from('collection_records')
        .select('status, is_refused');

      if (error) {
        console.error('Get records stats error:', error);
        return { total: 0, pending: 0, completed: 0, verified: 0, refused: 0 };
      }

      const stats = {
        total: data.length,
        pending: data.filter((r: any) => r.status === 'pending').length,
        completed: data.filter((r: any) => r.status === 'completed').length,
        verified: 0, // السجلات المدققة
        refused: data.filter((r: any) => r.status === 'refused').length
      };

      return stats;
    } catch (error) {
      console.error('Get records stats error:', error);
      return { total: 0, pending: 0, completed: 0, verified: 0, refused: 0 };
    }
  },

  // Activity Logs
  async createActivityLog(logData: CreateActivityLogData): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      if (!client) return false;

      // التحقق من وجود المستخدم قبل إنشاء سجل النشاط
      if (logData.user_id) {
        const { data: user, error: userError } = await client
          .from('users')
          .select('id')
          .eq('id', logData.user_id)
          .single();

        if (userError || !user) {
          console.warn('User not found for activity log, skipping:', logData.user_id);
          return false;
        }
      }

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
        return { data: [], total: 0, totalPages: 0 };
      }

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
      
      console.log('Available buckets:', buckets?.map((b: any) => b.name) || []);
      
      const photosBucket = buckets?.find((bucket: any) => bucket.name === 'photos');
      if (!photosBucket) {
        console.warn('Photos bucket not found in API response. Available buckets:', buckets?.map((b: any) => b.name) || []);
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

      console.log('Adding photo to record:', { recordId, photoType, photoUrl, userId, notes });

      const insertData: any = {
        record_id: recordId,
        photo_type: photoType,
        photo_url: photoUrl,
        notes: notes || null
      };

      // إضافة created_by فقط إذا كان موجود في الجدول
      if (userId) {
        insertData.created_by = userId;
      }

      const { data, error } = await client
        .from('record_photos')
        .insert(insertData)
        .select();

      if (error) {
        console.error('Add photo error:', error);
        console.error('Error details:', error.message, error.details, error.hint);
        return false;
      }

      console.log('Photo added successfully:', data);
      
      // Reset verification status to "غير مدقق" when new photos are added
      try {
        await client
          .from('collection_records')
          .update({ verification_status: 'غير مدقق' })
          .eq('id', recordId);
        
        console.log('Verification status reset to "غير مدقق" due to new photo');
      } catch (verificationError) {
        console.error('Error resetting verification status:', verificationError);
        // Don't fail the photo upload if verification status update fails
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
        .order('created_at', { ascending: false });

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

  async updatePhotoVerification(photoId: string, verified: boolean): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      if (!client) return false;

      const { error } = await client
        .from('record_photos')
        .update({ verified })
        .eq('id', photoId);

      if (error) {
        console.error('Update photo verification error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Update photo verification error:', error);
      return false;
    }
  },

  // Get active field agents count
  async getActiveFieldAgentsCount(): Promise<number> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        return 0;
      }
      
      const { data, error } = await client
        .from('users')
        .select('id')
        .eq('role', 'field_agent')
        .eq('is_active', true);

      if (error) {
        console.error('Get active field agents count error:', error);
        return 0;
      }

      return data.length;
    } catch (error) {
      console.error('Get active field agents count error:', error);
      return 0;
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
          description: backupInfo.description
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
      
      // مسح الجلسات أولاً (لأنها تعتمد على المستخدمين)
      try {
        await supabase.from('user_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (error) {
        console.warn('Could not clear user_sessions:', error);
      }
      
      // مسح سجل الأنشطة (لأنها تعتمد على المستخدمين)
      try {
        await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (error) {
        console.warn('Could not clear activity_logs:', error);
      }
      
      // مسح الصور (لأنها تعتمد على السجلات)
      try {
        await supabase.from('record_photos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (error) {
        console.warn('Could not clear record_photos:', error);
      }
      
      // مسح السجلات (لأنها تعتمد على المستخدمين)
      try {
        await supabase.from('collection_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (error) {
        console.warn('Could not clear collection_records:', error);
      }
      
      // مسح المستخدمين (بعد مسح جميع الجداول التي تعتمد عليهم)
      try {
        await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (error) {
        console.warn('Could not clear users:', error);
      }

      // 1. استعادة المستخدمين
      if (backupData.users && backupData.users.length > 0) {
        try {
          // استخدام upsert لتجنب التضارب
          const { error: usersError } = await supabase
            .from('users')
            .upsert(backupData.users, { 
              onConflict: 'id',
              ignoreDuplicates: false 
            });
          
          if (usersError) {
            console.error('Error restoring users:', usersError);
            throw usersError;
          }
          restoredCounts.users = backupData.users.length;
        } catch (error) {
          console.error('Failed to restore users:', error);
          // لا نرمي الخطأ، نكمل مع باقي البيانات
        }
      }

      // 2. استعادة السجلات
      if (backupData.collection_records && backupData.collection_records.length > 0) {
        try {
          const { error: recordsError } = await supabase
            .from('collection_records')
            .upsert(backupData.collection_records, { 
              onConflict: 'id',
              ignoreDuplicates: false 
            });
          
          if (recordsError) {
            console.error('Error restoring records:', recordsError);
            throw recordsError;
          }
          restoredCounts.records = backupData.collection_records.length;
        } catch (error) {
          console.error('Failed to restore records:', error);
          // لا نرمي الخطأ، نكمل مع باقي البيانات
        }
      }

      // 3. استعادة الصور
      if (backupData.record_photos && backupData.record_photos.length > 0) {
        try {
          const { error: photosError } = await supabase
            .from('record_photos')
            .upsert(backupData.record_photos, { 
              onConflict: 'id',
              ignoreDuplicates: false 
            });
          
          if (photosError) {
            console.error('Error restoring photos:', photosError);
            throw photosError;
          }
          restoredCounts.photos = backupData.record_photos.length;
        } catch (error) {
          console.error('Failed to restore photos:', error);
          // لا نرمي الخطأ، نكمل مع باقي البيانات
        }
      }

      // 4. استعادة سجل الأنشطة
      if (backupData.activity_logs && backupData.activity_logs.length > 0) {
        try {
          const { error: logsError } = await supabase
            .from('activity_logs')
            .upsert(backupData.activity_logs, { 
              onConflict: 'id',
              ignoreDuplicates: false 
            });
          
          if (logsError) {
            console.error('Error restoring activity logs:', logsError);
            throw logsError;
          }
          restoredCounts.activityLogs = backupData.activity_logs.length;
        } catch (error) {
          console.error('Failed to restore activity logs:', error);
          // لا نرمي الخطأ، نكمل مع باقي البيانات
        }
      }

      // 5. استعادة الجلسات
      if (backupData.user_sessions && backupData.user_sessions.length > 0) {
        try {
          const { error: sessionsError } = await supabase
            .from('user_sessions')
            .upsert(backupData.user_sessions, { 
              onConflict: 'id',
              ignoreDuplicates: false 
            });
          
          if (sessionsError) {
            console.error('Error restoring sessions:', sessionsError);
            throw sessionsError;
          }
          restoredCounts.sessions = backupData.user_sessions.length;
        } catch (error) {
          console.error('Failed to restore sessions:', error);
          // لا نرمي الخطأ، نكمل مع باقي البيانات
        }
      }

      // حساب إجمالي البيانات المستعادة
      const totalRestored = Object.values(restoredCounts).reduce((sum, count) => sum + count, 0);
      
      return {
        success: true,
        message: `تم استعادة النسخة الاحتياطية بنجاح (${totalRestored} عنصر)`,
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
  },

  // نظام القفل للسجلات
  async lockRecord(recordId: string, userId: string): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        throw new Error('فشل في الاتصال بقاعدة البيانات');
      }

      // التحقق من أن السجل غير مقفل من قبل مستخدم آخر
      const { data: existingRecord, error: fetchError } = await client
        .from('collection_records')
        .select('locked_by, locked_at, lock_expires_at')
        .eq('id', recordId)
        .single();

      if (fetchError) {
        console.error('Error fetching record for lock:', fetchError);
        throw new Error(`فشل في جلب بيانات السجل: ${fetchError.message}`);
      }

      // التحقق من القفل الحالي
      if (existingRecord.locked_by && existingRecord.locked_by !== userId) {
        const lockExpiry = new Date(existingRecord.lock_expires_at);
        const now = new Date();
        
        // إذا كان القفل لا يزال صالحاً
        if (lockExpiry > now) {
          throw new Error('السجل مقفل حالياً من قبل مستخدم آخر');
        }
      }

      // تعيين قفل جديد لمدة 30 دقيقة
      const lockExpiry = new Date();
      lockExpiry.setMinutes(lockExpiry.getMinutes() + 30);

      const { error } = await client
        .from('collection_records')
        .update({
          locked_by: userId,
          locked_at: new Date().toISOString(),
          lock_expires_at: lockExpiry.toISOString()
        })
        .eq('id', recordId);

      if (error) {
        console.error('Error locking record:', error);
        throw new Error(`فشل في قفل السجل: ${error.message}`);
      }

      return true;
    } catch (error) {
      console.error('Lock record error:', error);
      throw error;
    }
  },

  async unlockRecord(recordId: string, userId: string): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        throw new Error('فشل في الاتصال بقاعدة البيانات');
      }

      const { error } = await client
        .from('collection_records')
        .update({
          locked_by: null,
          locked_at: null,
          lock_expires_at: null
        })
        .eq('id', recordId)
        .eq('locked_by', userId); // التأكد من أن المستخدم الحالي هو من قفل السجل

      if (error) {
        console.error('Error unlocking record:', error);
        throw new Error(`فشل في إلغاء قفل السجل: ${error.message}`);
      }

      return true;
    } catch (error) {
      console.error('Unlock record error:', error);
      throw error;
    }
  },

  async checkRecordLock(recordId: string): Promise<{ isLocked: boolean; lockedBy?: string; lockExpiresAt?: string }> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        throw new Error('فشل في الاتصال بقاعدة البيانات');
      }

      const { data, error } = await client
        .from('collection_records')
        .select('locked_by, locked_at, lock_expires_at')
        .eq('id', recordId)
        .single();

      if (error) {
        console.error('Error checking record lock:', error);
        throw new Error(`فشل في التحقق من حالة القفل: ${error.message}`);
      }

      if (!data.locked_by) {
        return { isLocked: false };
      }

      const lockExpiry = new Date(data.lock_expires_at);
      const now = new Date();

      // إذا انتهت صلاحية القفل، إلغاؤه تلقائياً
      if (lockExpiry <= now) {
        await this.unlockRecord(recordId, data.locked_by);
        return { isLocked: false };
      }

      return {
        isLocked: true,
        lockedBy: data.locked_by,
        lockExpiresAt: data.lock_expires_at
      };
    } catch (error) {
      console.error('Check record lock error:', error);
      throw error;
    }
  },

  async extendRecordLock(recordId: string, userId: string): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        throw new Error('فشل في الاتصال بقاعدة البيانات');
      }

      // تمديد القفل لمدة 30 دقيقة إضافية
      const lockExpiry = new Date();
      lockExpiry.setMinutes(lockExpiry.getMinutes() + 30);

      const { error } = await client
        .from('collection_records')
        .update({
          lock_expires_at: lockExpiry.toISOString()
        })
        .eq('id', recordId)
        .eq('locked_by', userId);

      if (error) {
        console.error('Error extending record lock:', error);
        throw new Error(`فشل في تمديد قفل السجل: ${error.message}`);
      }

      return true;
    } catch (error) {
      console.error('Extend record lock error:', error);
      throw error;
    }
  }
};