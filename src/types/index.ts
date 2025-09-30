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
  address: string | null;
  last_reading: string | null;
  status: 'pending' | 'completed';
  submitted_at: string;
  updated_at: string;
  completed_by: string | null;
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
  address: string;
  last_reading: string;
  status: 'pending' | 'completed';
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
  address: string;
  status: string;
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
}