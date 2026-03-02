import { createClient } from '@supabase/supabase-js';
import { User, CollectionRecord, CreateRecordData, CreateRecordFromDashboardData, UpdateRecordData, UserAchievement, ActivityLog, CreateActivityLogData, RecordPhoto } from '../types';
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

  // Check if user is still active in database
  async checkUserStatus(userId: string): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        console.warn('Supabase not configured - assuming user is active');
        return true;
      }
      
      const { data: user, error } = await client
        .from('users')
        .select('is_active')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error checking user status:', error);
        return true; // Assume active if we can't check
      }
      
      return user?.is_active || false;
    } catch (error) {
      console.error('Error checking user status:', error);
      return true; // Assume active if we can't check
    }
  },

  // Branch Manager Operations
  async getBranchManagerFieldAgents(branchManagerId: string): Promise<string[]> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        console.warn('Supabase not configured - returning empty array');
        return [];
      }
      
      const { data, error } = await client
        .from('branch_manager_field_agents')
        .select('field_agent_id')
        .eq('branch_manager_id', branchManagerId);
      
      if (error) {
        console.error('Get branch manager field agents error:', error);
        return [];
      }
      
      return (data || []).map((item: any) => item.field_agent_id);
    } catch (error) {
      console.error('Get branch manager field agents error:', error);
      return [];
    }
  },

  // محصلي وموظفين ومدير الفرع نفسه - لفلترة السجلات والإحصائيات
  async getBranchManagerSubordinateIds(branchManagerId: string, includeManager = true): Promise<string[]> {
    try {
      const [fieldAgentIds, employeeIds] = await Promise.all([
        this.getBranchManagerFieldAgents(branchManagerId),
        this.getBranchManagerEmployees(branchManagerId)
      ]);
      const ids = [...new Set([
        ...fieldAgentIds,
        ...employeeIds,
        ...(includeManager ? [branchManagerId] : [])
      ])];
      return ids;
    } catch (error) {
      console.error('Get branch manager subordinates error:', error);
      return [];
    }
  },

  async addFieldAgentToBranchManager(branchManagerId: string, fieldAgentId: string, createdBy?: string): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        throw new Error('فشل في الاتصال بقاعدة البيانات');
      }
      
      const insertData: any = {
        branch_manager_id: branchManagerId,
        field_agent_id: fieldAgentId
      };
      
      if (createdBy) {
        insertData.created_by = createdBy;
      }
      
      const { error } = await client
        .from('branch_manager_field_agents')
        .insert(insertData);
      
      if (error) {
        console.error('Add field agent to branch manager error:', error);
        throw new Error(`فشل في إضافة المحصل: ${error.message}`);
      }
      
      return true;
    } catch (error) {
      console.error('Add field agent to branch manager error:', error);
      throw error;
    }
  },

  async removeFieldAgentFromBranchManager(branchManagerId: string, fieldAgentId: string): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        throw new Error('فشل في الاتصال بقاعدة البيانات');
      }
      
      const { error } = await client
        .from('branch_manager_field_agents')
        .delete()
        .eq('branch_manager_id', branchManagerId)
        .eq('field_agent_id', fieldAgentId);
      
      if (error) {
        console.error('Remove field agent from branch manager error:', error);
        throw new Error(`فشل في حذف المحصل: ${error.message}`);
      }
      
      return true;
    } catch (error) {
      console.error('Remove field agent from branch manager error:', error);
      throw error;
    }
  },

  async getBranchManagerEmployees(branchManagerId: string): Promise<string[]> {
    try {
      const client = checkSupabaseConnection();
      if (!client) return [];
      
      const { data, error } = await client
        .from('branch_manager_employees')
        .select('employee_id')
        .eq('branch_manager_id', branchManagerId);
      
      if (error) {
        console.error('Get branch manager employees error:', error);
        return [];
      }
      
      return (data || []).map((item: any) => item.employee_id);
    } catch (error) {
      console.error('Get branch manager employees error:', error);
      return [];
    }
  },

  async addEmployeeToBranchManager(branchManagerId: string, employeeId: string, createdBy?: string): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      if (!client) throw new Error('فشل في الاتصال بقاعدة البيانات');
      
      const insertData: any = { branch_manager_id: branchManagerId, employee_id: employeeId };
      if (createdBy) insertData.created_by = createdBy;
      
      const { error } = await client.from('branch_manager_employees').insert(insertData);
      if (error) throw new Error(`فشل في إضافة الموظف: ${error.message}`);
      return true;
    } catch (error) {
      console.error('Add employee to branch manager error:', error);
      throw error;
    }
  },

  async removeEmployeeFromBranchManager(branchManagerId: string, employeeId: string): Promise<boolean> {
    try {
      const client = checkSupabaseConnection();
      if (!client) throw new Error('فشل في الاتصال بقاعدة البيانات');
      
      const { error } = await client
        .from('branch_manager_employees')
        .delete()
        .eq('branch_manager_id', branchManagerId)
        .eq('employee_id', employeeId);
      
      if (error) throw new Error(`فشل في حذف الموظف: ${error.message}`);
      return true;
    } catch (error) {
      console.error('Remove employee from branch manager error:', error);
      throw error;
    }
  },

  // Collection Records
  async getRecordsWithPagination(page: number = 1, limit: number = 10, filters: any = {}, currentUser?: User | null): Promise<{
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

      // فلترة السجلات حسب صلاحيات مدير الفرع (محصلين + موظفين)
      if (currentUser?.role === 'branch_manager') {
        const subordinateIds = await this.getBranchManagerSubordinateIds(currentUser.id);
        if (subordinateIds.length > 0) {
          query = query.in('field_agent_id', subordinateIds);
        } else {
          // إذا لم يكن لديه محصلين أو موظفين، لا يعرض أي سجلات
          return { data: [], total: 0, totalPages: 0 };
        }
      }

      // فلترة حسب مدير الفرع المحدد في الفلاتر
      if (filters.branch_manager_id) {
        const subordinateIds = await this.getBranchManagerSubordinateIds(filters.branch_manager_id);
        if (subordinateIds.length > 0) {
          query = query.in('field_agent_id', subordinateIds);
        } else {
          return { data: [], total: 0, totalPages: 0 };
        }
      }

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          // تخطي branch_manager_id لأنه تم معالجته أعلاه
          if (key === 'branch_manager_id') {
            return;
          }
          if (key === 'status') {
            if (value === 'refused') {
              query = query.eq('is_refused', true);
            } else {
              query = query.eq('is_refused', false).eq('status', value);
            }
          } else if (key === 'verification_status') {
            query = query.eq('verification_status', value);
          } else if (key === 'rejected_photos') {
            if (value === 'any') {
              query = query.or('meter_photo_rejected.eq.true,invoice_photo_rejected.eq.true');
            } else if (value === 'none') {
              query = query.eq('meter_photo_rejected', false).eq('invoice_photo_rejected', false);
            }
          } else if (['new_zone','new_block','category','phase','region','district','field_agent_id','land_status'].includes(key)) {
            query = query.eq(key, value);
          } else if (['subscriber_name','account_number','meter_number'].includes(key)) {
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

      // تحويل tags من JSONB إلى array لكل سجل
      const processedData = (data || []).map((record: any) => {
        if (record.tags) {
          if (typeof record.tags === 'string') {
            try {
              record.tags = JSON.parse(record.tags);
            } catch (e) {
              console.warn('Failed to parse tags for record:', record.id, e);
              record.tags = [];
            }
          }
        }
        return record;
      });

      return {
        data: processedData,
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

      // تحويل tags إلى JSONB format إذا كانت موجودة
      const recordData: any = { ...record };
      if (recordData.tags && Array.isArray(recordData.tags)) {
        recordData.tags = JSON.stringify(recordData.tags);
      }

      const { data, error } = await client
        .from('collection_records')
        .insert(recordData)
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
      
      // تحويل tags من JSONB إلى array إذا لزم الأمر
      if (data && data.tags) {
        if (typeof data.tags === 'string') {
          try {
            data.tags = JSON.parse(data.tags);
          } catch (e) {
            console.warn('Failed to parse tags:', e);
            data.tags = [];
          }
        }
      }
      
      return data;
    } catch (error) {
      console.error('Create record error:', error);
      throw error;
    }
  },

  // إنشاء سجل من الداشبورد (بدون صور وبدون GPS - المحصل يضيفها لاحقاً)
  async createRecordFromDashboard(data: CreateRecordFromDashboardData): Promise<CollectionRecord | null> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        throw new Error('فشل في الاتصال بقاعدة البيانات');
      }

      const recordData: any = {
        subscriber_name: data.subscriber_name || null,
        account_number: data.account_number || null,
        meter_number: data.meter_number || null,
        region: data.region || null,
        district: data.district || null,
        last_reading: data.last_reading || null,
        new_zone: data.new_zone || null,
        new_block: data.new_block || null,
        new_home: data.new_home || null,
        category: data.category,
        phase: data.phase,
        multiplier: data.multiplier || null,
        total_amount: data.total_amount ?? null,
        current_amount: data.current_amount ?? null,
        land_status: data.land_status ?? null,
        status: data.status || 'pending',
        field_agent_id: data.field_agent_id ?? null,
        gps_latitude: null,
        gps_longitude: null,
        meter_photo_url: null,
        invoice_photo_url: null,
        is_refused: false,
        meter_photo_verified: false,
        invoice_photo_verified: false,
        verification_status: 'غير مدقق'
      };

      const { data: result, error } = await client
        .from('collection_records')
        .insert(recordData)
        .select()
        .single();

      if (error) {
        console.error('Create record from dashboard error:', error);
        throw new Error(`فشل في إنشاء السجل: ${error.message}`);
      }

      cacheService.clearRecordsCache();
      cacheService.clearUsersCache();
      localStorage.removeItem('ejibaya_cache');

      return result;
    } catch (error) {
      console.error('Create record from dashboard error:', error);
      throw error;
    }
  },

  // إنشاء سجل فارغ يحتوي فقط على رقم الحساب ورقم المقياس
  async createEmptyRecord(accountNumber: string, meterNumber: string): Promise<CollectionRecord | null> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        throw new Error('فشل في الاتصال بقاعدة البيانات');
      }

      const recordData: any = {
        account_number: accountNumber,
        meter_number: meterNumber,
        status: 'pending',
        is_refused: false,
        meter_photo_verified: false,
        invoice_photo_verified: false,
        verification_status: 'غير مدقق'
      };

      const { data, error } = await client
        .from('collection_records')
        .insert(recordData)
        .select()
        .single();

      if (error) {
        console.error('Create empty record error:', error);
        throw new Error(`فشل في إنشاء السجل: ${error.message}`);
      }
      
      // مسح التخزين المؤقت نهائياً
      cacheService.clearRecordsCache();
      cacheService.clearUsersCache();
      localStorage.removeItem('ejibaya_cache');
      console.log('Empty record created successfully - cache cleared');
      
      return data;
    } catch (error) {
      console.error('Create empty record error:', error);
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
      
      console.log('Fetching all records from database (cache completely disabled)');
      
      // جلب جميع السجلات على دفعات لتجاوز حد 1000 سجل في Supabase
      let allRecords: CollectionRecord[] = [];
      let from = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const to = from + limit - 1;
        const { data, error } = await client
          .from('collection_records')
          .select('*')
          .order('submitted_at', { ascending: false })
          .range(from, to);

        if (error) {
          console.error('Get records error:', error);
          break;
        }

        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }

        // تحويل tags من JSONB إلى array لكل سجل
        const processedData = data.map((record: any) => {
          if (record.tags) {
            if (typeof record.tags === 'string') {
              try {
                record.tags = JSON.parse(record.tags);
              } catch (e) {
                console.warn('Failed to parse tags for record:', record.id, e);
                record.tags = [];
              }
            }
          }
          return record;
        });

        allRecords.push(...processedData);
        from += limit;

        if (data.length < limit) {
          hasMore = false;
        }

        console.log(`Fetched ${allRecords.length} records so far...`);
      }
      
      console.log(`Total fetched ${allRecords.length} records from database`);
      
      return allRecords;
    } catch (error) {
      console.error('Get records error:', error);
      return [];
    }
  },

  // البحث عن السجلات برقم الحساب (محسّن للأداء)
  async searchRecordsByAccountNumber(accountNumber: string, limit: number = 50): Promise<CollectionRecord[]> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        console.warn('Supabase not configured - returning empty records array');
        return [];
      }

      if (!accountNumber || accountNumber.trim().length === 0) {
        return [];
      }

      // استخدام ilike للبحث الجزئي (case-insensitive)
      // استخدام limit لتقليل عدد النتائج
      const { data, error } = await client
        .from('collection_records')
        .select('*')
        .ilike('account_number', `%${accountNumber.trim()}%`)
        .order('submitted_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Search records by account number error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Search records by account number error:', error);
      return [];
    }
  },

  // جلب السجلات المفلترة للتقرير مباشرة من قاعدة البيانات (بدون تحميل جميع السجلات)
  async getFilteredRecordsForReport(filters: any, reportType?: 'standard' | 'delivery', currentUser?: User | null): Promise<CollectionRecord[]> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        console.warn('Supabase not configured - returning empty records array');
        return [];
      }
      
      let query = client
        .from('collection_records')
        .select('*');

      // فلترة السجلات حسب صلاحيات مدير الفرع (محصلين + موظفين)
      if (currentUser?.role === 'branch_manager') {
        const subordinateIds = await this.getBranchManagerSubordinateIds(currentUser.id);
        if (subordinateIds.length > 0) {
          query = query.in('field_agent_id', subordinateIds);
        } else {
          return [];
        }
      }

      // لتقرير الارسالية: فلتر فقط السجلات التي لديها مبلغ مستلم (في قاعدة البيانات مباشرة)
      if (reportType === 'delivery') {
        query = query.not('current_amount', 'is', null)
                     .gt('current_amount', 0);
      }

      // تطبيق الفلاتر
      if (filters.startDate) {
        query = query.gte('submitted_at', filters.startDate);
      }

      if (filters.endDate) {
        query = query.lte('submitted_at', filters.endDate + 'T23:59:59');
      }

      if (filters.status) {
        if (filters.status === 'refused') {
          query = query.eq('is_refused', true);
        } else {
          query = query.eq('is_refused', false).eq('status', filters.status);
        }
      }

      // فلتر مدير الفرع: إذا تم اختيار مدير فرع، نفلتر فقط محصليه
      if (filters.branchManager && currentUser?.role === 'branch_manager' && currentUser.id === filters.branchManager) {
        // إذا كان المستخدم الحالي هو مدير الفرع المحدد، استخدم الفلتر الموجود
        // (تم تطبيقه بالفعل في السطور السابقة)
      } else if (filters.branchManager) {
        const subordinateIds = await this.getBranchManagerSubordinateIds(filters.branchManager);
        if (subordinateIds.length > 0) {
          query = query.in('field_agent_id', subordinateIds);
        } else {
          return [];
        }
      }

      if (filters.fieldAgent) {
        query = query.eq('field_agent_id', filters.fieldAgent);
      }

      if (filters.new_zone) {
        query = query.eq('new_zone', filters.new_zone);
      }

      if (filters.new_block) {
        query = query.eq('new_block', filters.new_block);
      }

      if (filters.region) {
        query = query.eq('region', filters.region);
      }

      if (filters.verification_status) {
        query = query.eq('verification_status', filters.verification_status);
      }

      if (filters.category) {
        query = query.eq('category', filters.category);
      }

      if (filters.phase) {
        query = query.eq('phase', filters.phase);
      }

      if (filters.land_status) {
        query = query.eq('land_status', filters.land_status);
      }

      if (filters.rejected_photos === 'any') {
        query = query.or('meter_photo_rejected.eq.true,invoice_photo_rejected.eq.true');
      } else if (filters.rejected_photos === 'none') {
        query = query.eq('meter_photo_rejected', false).eq('invoice_photo_rejected', false);
      }

      // جلب جميع السجلات المفلترة على دفعات
      let allRecords: CollectionRecord[] = [];
      let from = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const to = from + limit - 1;
        const { data, error } = await query
          .order('submitted_at', { ascending: false })
          .range(from, to);

        if (error) {
          console.error('Get filtered records error:', error);
          break;
        }

        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }

        allRecords.push(...data);
        from += limit;

        if (data.length < limit) {
          hasMore = false;
        }
      }
      
      console.log(`Fetched ${allRecords.length} filtered records from database (reportType: ${reportType || 'standard'})`);
      
      return allRecords;
    } catch (error) {
      console.error('Get filtered records error:', error);
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

      // تحويل tags من JSONB إلى array إذا لزم الأمر
      if (data && data.length > 0) {
        data.forEach((record: any) => {
          if (record.tags) {
            if (typeof record.tags === 'string') {
              try {
                record.tags = JSON.parse(record.tags);
              } catch (e) {
                console.warn('Failed to parse tags:', e);
                record.tags = [];
              }
            }
          }
        });
      }
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

  // إنجازات المستخدمين (للمدير فقط) - عبر RPC للتجميع في DB بدون حد صفوف
  async getUsersAchievements(startDate: string, endDate: string): Promise<UserAchievement[]> {
    try {
      const client = checkSupabaseConnection();
      if (!client) return [];

      const { data, error } = await client.rpc('get_users_achievements', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Get users achievements RPC error:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        user_id: row.user_id,
        full_name: row.full_name || '',
        username: row.username || '',
        role: row.role || '',
        records_added: Number(row.records_added) || 0,
        records_added_dashboard: Number(row.records_added_dashboard) || 0,
        records_completed: Number(row.records_completed) || 0,
        records_refused: Number(row.records_refused) || 0,
        records_updated: Number(row.records_updated) || 0,
        total_actions: Number(row.total_actions) || 0,
        last_activity: row.last_activity || null
      }));
    } catch (error) {
      console.error('Get users achievements error:', error);
      return [];
    }
  },

  // User Management - مع تخزين مؤقت (60 ثانية) لتقليل الطلبات في بيئات متقطعة (مثل Bolt)
  async getUsers(bypassCache = false): Promise<User[]> {
    const CACHE_KEY = 'all_users';
    const CACHE_TTL = 60 * 1000; // 60 ثانية
    if (!bypassCache) {
      const cached = cacheService.get(CACHE_KEY);
      if (cached && Array.isArray(cached)) return cached;
    }
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
      const result = data || [];
      cacheService.set(CACHE_KEY, result, CACHE_TTL);
      return result;
    } catch (error) {
      console.error('Get users error:', error);
      // إرجاع النسخة المخزنة عند الفشل لتجنب شاشة فارغة
      const cached = cacheService.get(CACHE_KEY);
      if (cached && Array.isArray(cached)) return cached;
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
        // ترجمة رسالة الخطأ إلى العربية
        let errorMessage = 'فشل في إنشاء المستخدم';
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('duplicate key') || errorMsg.includes('username_key') || errorMsg.includes('unique constraint')) {
          errorMessage = 'اسم المستخدم موجود مسبقاً. يرجى اختيار اسم مستخدم آخر';
        } else {
          errorMessage = `فشل في إنشاء المستخدم: ${error.message}`;
        }
        throw new Error(errorMessage);
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

      // منع تعطيل أو حذف المدير الأساسي (username: admin)
      if (updates.is_active === false || (typeof updates.username === 'string' && updates.username.includes('(محذوف)'))) {
        const { data: user } = await client.from('users').select('username').eq('id', id).single();
        if (user && (user.username?.replace?.(' (محذوف)', '') === 'admin' || id === '1')) {
          throw new Error('لا يمكن حذف أو تعطيل حساب المدير الأساسي');
        }
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
  async getRecordsStats(currentUser?: User | null): Promise<{
    total: number;
    pending: number;
    completed: number;
    verified: number;
    refused: number;
    locked?: number;
  }> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        return { total: 0, pending: 0, completed: 0, verified: 0, refused: 0 };
      }
      
      // فلترة السجلات حسب صلاحيات مدير الفرع (محصلين + موظفين)
      let allowedFieldAgentIds: string[] | null = null;
      if (currentUser?.role === 'branch_manager') {
        allowedFieldAgentIds = await this.getBranchManagerSubordinateIds(currentUser.id);
        if (allowedFieldAgentIds.length === 0) {
          return { total: 0, pending: 0, completed: 0, verified: 0, refused: 0, locked: 0 };
        }
      }
      
      // استخدام دالة SQL للحصول على الإحصائيات بدقة
      // لكن نحتاج fallback لأن RPC قد لا يدعم الفلترة
      if (!allowedFieldAgentIds && !currentUser) {
        const { data, error } = await client
          .rpc('get_system_stats');

        if (!error && data && data.length > 0) {
          const stats = data[0];
          return {
            total: Number(stats.total_records) || 0,
            pending: Number(stats.pending_records) || 0,
            completed: Number(stats.completed_records) || 0,
            verified: Number(stats.verified_records) || 0,
            refused: Number(stats.refused_records) || 0,
            locked: Number(stats.locked_records) || 0
          };
        }
      }

      // Fallback: استخدام الاستعلام المباشر مع الفلترة
      return await this.getRecordsStatsFallback(allowedFieldAgentIds);
    } catch (error) {
      console.error('Get records stats error:', error);
      // Fallback: استخدام الاستعلام المباشر
      const allowedFieldAgentIds = currentUser?.role === 'branch_manager' 
        ? await this.getBranchManagerSubordinateIds(currentUser.id)
        : null;
      return await this.getRecordsStatsFallback(allowedFieldAgentIds);
    }
  },

  // Fallback method للحصول على الإحصائيات
  async getRecordsStatsFallback(allowedFieldAgentIds?: string[] | null): Promise<{
    total: number;
    pending: number;
    completed: number;
    verified: number;
    refused: number;
    locked?: number;
  }> {
    try {
      const client = checkSupabaseConnection();
      if (!client) {
        return { total: 0, pending: 0, completed: 0, verified: 0, refused: 0 };
      }
      
      // بناء الاستعلامات مع فلترة المحصلين الميدانيين إذا لزم الأمر
      const buildQuery = (baseQuery: any) => {
        if (allowedFieldAgentIds && allowedFieldAgentIds.length > 0) {
          return baseQuery.in('field_agent_id', allowedFieldAgentIds);
        }
        return baseQuery;
      };
      
      // استخدام count للحصول على الإحصائيات بدقة
      const [totalResult, pendingResult, completedResult, verifiedResult, refusedResult, lockedResult] = await Promise.all([
        buildQuery(client.from('collection_records').select('id', { count: 'exact', head: true })),
        buildQuery(client.from('collection_records').select('id', { count: 'exact', head: true }).eq('status', 'pending').eq('is_refused', false)),
        buildQuery(client.from('collection_records').select('id', { count: 'exact', head: true }).eq('status', 'completed').eq('is_refused', false)),
        buildQuery(client.from('collection_records').select('id', { count: 'exact', head: true }).eq('verification_status', 'مدقق')),
        buildQuery(client.from('collection_records').select('id', { count: 'exact', head: true }).eq('is_refused', true)),
        buildQuery(client.from('collection_records').select('id', { count: 'exact', head: true }).not('locked_by', 'is', null))
      ]);

      return {
        total: totalResult.count || 0,
        pending: pendingResult.count || 0,
        completed: completedResult.count || 0,
        verified: verifiedResult.count || 0,
        refused: refusedResult.count || 0,
        locked: lockedResult.count || 0
      };
    } catch (error) {
      console.error('Get records stats fallback error:', error);
      return { total: 0, pending: 0, completed: 0, verified: 0, refused: 0, locked: 0 };
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
      
      // جلب جميع السجلات على دفعات لتجاوز حد 1000 سجل في Supabase
      let allRecords: any[] = [];
      let from = 0;
      const limit = 1000;
      let hasMore = true;

      console.log('Fetching all records for backup (with pagination)...');

      while (hasMore) {
        const to = from + limit - 1;
        const { data, error } = await supabase
          .from('collection_records')
          .select('*')
          .order('submitted_at', { ascending: false })
          .range(from, to);

        if (error) {
          console.error('Get all records error:', error);
          throw error;
        }

        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }

        allRecords.push(...data);
        from += limit;

        if (data.length < limit) {
          hasMore = false;
        }

        console.log(`Fetched ${allRecords.length} records so far for backup...`);
      }
      
      console.log(`Total fetched ${allRecords.length} records for backup`);
      
      return allRecords;
    } catch (error) {
      console.error('Error fetching all records:', error);
      throw error;
    }
  },

  async getAllActivityLogs(): Promise<any[]> {
    try {
      if (!supabase) throw new Error('Supabase not configured');
      
      // جلب جميع سجلات الأنشطة على دفعات
      let allLogs: any[] = [];
      let from = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const to = from + limit - 1;
        const { data, error } = await supabase
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) throw error;

        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }

        allLogs.push(...data);
        from += limit;

        if (data.length < limit) {
          hasMore = false;
        }
      }
      
      return allLogs;
    } catch (error) {
      console.error('Error fetching all activity logs:', error);
      throw error;
    }
  },

  async getAllRecordPhotos(): Promise<any[]> {
    try {
      if (!supabase) throw new Error('Supabase not configured');
      
      // جلب جميع الصور على دفعات
      let allPhotos: any[] = [];
      let from = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const to = from + limit - 1;
        const { data, error } = await supabase
          .from('record_photos')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) throw error;

        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }

        allPhotos.push(...data);
        from += limit;

        if (data.length < limit) {
          hasMore = false;
        }
      }
      
      return allPhotos;
    } catch (error) {
      console.error('Error fetching all record photos:', error);
      throw error;
    }
  },

  async getAllUserSessions(): Promise<any[]> {
    try {
      if (!supabase) throw new Error('Supabase not configured');
      
      // جلب جميع الجلسات على دفعات
      let allSessions: any[] = [];
      let from = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const to = from + limit - 1;
        const { data, error } = await supabase
          .from('user_sessions')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) throw error;

        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }

        allSessions.push(...data);
        from += limit;

        if (data.length < limit) {
          hasMore = false;
        }
      }
      
      return allSessions;
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