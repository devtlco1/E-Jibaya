export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: 'admin' | 'field_agent' | 'employee' | 'branch_manager';
  full_name: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface CollectionRecord {
  id: string;
  field_agent_id: string | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  meter_photo_url: string | null;
  invoice_photo_url: string | null;
  notes: string | null;
  is_refused: boolean;
  subscriber_name: string | null;
  account_number: string | null;
  meter_number: string | null;
  region: string | null;
  district: string | null;
  last_reading: string | null;
  status: 'pending' | 'completed' | 'refused';
  submitted_at: string;
  updated_at: string;
  completed_by: string | null;
  // الترميز الجديد
  new_zone: string | null;
  new_block: string | null;
  new_home: string | null;
  // نظام القفل
  locked_by: string | null;
  locked_at: string | null;
  lock_expires_at: string | null;
  // الصنف
  category: 'منزلي' | 'تجاري' | 'صناعي' | 'زراعي' | 'حكومي' | null;
  // نوع المقياس
  phase: 'احادي' | 'ثلاثي' | 'سي تي' | 'المحولة الخاصة' | 'مقياس الكتروني' | null;
  // معامل الضرب (يظهر فقط عند اختيار سي تي)
  multiplier: string | null;
  // تدقيق الصور
  meter_photo_verified: boolean;
  invoice_photo_verified: boolean;
  // رفض الصور
  meter_photo_rejected?: boolean;
  invoice_photo_rejected?: boolean;
  // حالة التدقيق
  verification_status: 'غير مدقق' | 'مدقق' | null;
  // المبالغ
  total_amount: number | null;
  current_amount: number | null;
  // حالة الارض
  land_status: 'متروك' | 'مهدوم' | 'لم اعثر عليه' | 'ممتنع' | 'تجاوز' | 'قيد الانشاء' | 'مبدل' | 'مغلق' | 'لايوجد مقياس' | 'فحص مقياس' | 'فارغ' | 'خطاء في القرادة' | null;
  // تاغات المشاكل
  tags: string[] | null;
}

export interface CreateRecordData {
  field_agent_id: string;
  gps_latitude: number | null;
  gps_longitude: number | null;
  meter_photo_url: string | null;
  invoice_photo_url: string | null;
  notes: string | null;
  is_refused: boolean;
  total_amount: number | null;
  current_amount: number | null;
  category?: 'منزلي' | 'تجاري' | 'صناعي' | 'زراعي' | 'حكومي' | null;
  tags?: string[] | null;
}

export interface CreateRecordFromDashboardData {
  subscriber_name: string;
  account_number: string;
  meter_number: string;
  region: string;
  district: string;
  last_reading: string;
  new_zone?: string | null;
  new_block?: string | null;
  new_home?: string | null;
  category: 'منزلي' | 'تجاري' | 'صناعي' | 'زراعي' | 'حكومي' | null;
  phase: 'احادي' | 'ثلاثي' | 'سي تي' | 'المحولة الخاصة' | 'مقياس الكتروني' | null;
  multiplier?: string | null;
  total_amount?: number | null;
  current_amount?: number | null;
  land_status?: 'متروك' | 'مهدوم' | 'لم اعثر عليه' | 'ممتنع' | 'تجاوز' | 'قيد الانشاء' | 'مبدل' | 'مغلق' | 'لايوجد مقياس' | 'فحص مقياس' | 'فارغ' | 'خطاء في القرادة' | null;
  status?: 'pending' | 'completed' | 'refused';
}

export interface UpdateRecordData {
  subscriber_name: string;
  account_number: string;
  meter_number: string;
  region: string;
  district: string;
  last_reading: string;
  status: 'pending' | 'completed' | 'refused';
  // الترميز الجديد
  new_zone: string | null;
  new_block: string | null;
  new_home: string | null;
  // حقول التحقق من الصور
  meter_photo_verified?: boolean;
  invoice_photo_verified?: boolean;
  verification_status?: 'غير مدقق' | 'مدقق' | null;
  // المبالغ
  total_amount?: number | null;
  current_amount?: number | null;
  // حالة الارض
  land_status?: 'متروك' | 'مهدوم' | 'لم اعثر عليه' | 'ممتنع' | 'تجاوز' | 'قيد الانشاء' | 'مبدل' | 'مغلق' | 'لايوجد مقياس' | 'فحص مقياس' | 'فارغ' | 'خطاء في القرادة' | null;
  // تاغات المشاكل
  tags?: string[] | null;
}

export interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

export interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

export interface FilterState {
  subscriber_name: string;
  account_number: string;
  meter_number: string;
  region: string;
  district: string;
  status: string;
  // الترميز الجديد
  new_zone: string;
  new_block: string;
  // التدقيق
  verification_status: string;
  // فلاتر إضافية
  category: string;
  phase: string;
  // حالة الارض
  land_status: string;
  // الصور المرفوضة
  rejected_photos?: 'any' | 'none' | '';
  // المحصل الميداني
  field_agent_id: string;
  // مدير الفرع
  branch_manager_id: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  target_name: string | null;
  details: Record<string, any>;
  created_at: string;
}

export interface CreateActivityLogData {
  user_id: string;
  action: string;
  target_type: string;
  target_id?: string | null;
  target_name?: string | null;
  details?: Record<string, any>;
}

export interface RecordPhoto {
  id: string;
  record_id: string;
  photo_type: 'meter' | 'invoice';
  photo_url: string;
  photo_date: string;
  created_by: string | null;
  created_at: string;
  notes: string | null;
  verified: boolean;
  rejected?: boolean;
}