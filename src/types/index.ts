export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: 'admin' | 'field_agent' | 'employee';
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
  category: 'منزلي' | 'تجاري' | 'صناعي' | 'زراعي' | 'حكومي' | 'انارة' | 'محولة خاصة' | null;
  // نوع المقياس
  phase: 'احادي' | 'ثلاثي' | 'سي تي' | null;
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
}

export interface CreateRecordData {
  field_agent_id: string;
  gps_latitude: number | null;
  gps_longitude: number | null;
  meter_photo_url: string | null;
  invoice_photo_url: string | null;
  notes: string | null;
  is_refused: boolean;
}

export interface UpdateRecordData {
  subscriber_name: string;
  account_number: string;
  meter_number: string;
  region: string;
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
  status: string;
  // الترميز الجديد
  new_zone: string;
  new_block: string;
  // التدقيق
  verification_status: string;
  // فلاتر إضافية
  category: string;
  phase: string;
  // الصور المرفوضة
  rejected_photos?: 'any' | 'none' | '';
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
}