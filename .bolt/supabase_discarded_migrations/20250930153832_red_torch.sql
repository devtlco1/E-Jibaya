/*
  # إنشاء جدول سجل الحركات وإضافة بيانات تجريبية

  1. جدول جديد
    - `activity_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `action` (text) - نوع العملية
      - `target_type` (text) - نوع الهدف
      - `target_id` (uuid) - معرف الهدف
      - `target_name` (text) - اسم الهدف
      - `details` (jsonb) - تفاصيل إضافية
      - `ip_address` (text) - عنوان IP
      - `user_agent` (text) - معلومات المتصفح
      - `created_at` (timestamp)

  2. الأمان
    - تفعيل RLS على جدول `activity_logs`
    - سياسات للقراءة للمديرين فقط

  3. بيانات تجريبية
    - 50 سجل جباية بحالات مختلفة
    - 15 قيد المراجعة، 15 مكتمل، 10 تمت المراجعة، 10 امتناع
*/

-- إنشاء جدول سجل الحركات
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  target_name text,
  details jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- إنشاء فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_target_type ON activity_logs(target_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- تفعيل RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- سياسة للقراءة للمديرين فقط
CREATE POLICY "Admins can read all activity logs"
  ON activity_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin' 
      AND users.is_active = true
    )
  );

-- سياسة للإدراج للمستخدمين المصادق عليهم
CREATE POLICY "Authenticated users can create activity logs"
  ON activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- إضافة بيانات تجريبية لسجلات الجباية
DO $$
DECLARE
  admin_id uuid;
  agent1_id uuid;
  agent2_id uuid;
  i integer;
  record_id uuid;
  status_val text;
  is_refused_val boolean;
  subscriber_names text[] := ARRAY[
    'أحمد محمد علي', 'فاطمة أحمد محمد', 'محمد علي حسن', 'زينب محمد أحمد',
    'علي حسن محمد', 'مريم أحمد علي', 'حسن محمد علي', 'نور فاطمة أحمد',
    'يوسف علي محمد', 'سارة محمد حسن', 'عمر أحمد علي', 'ليلى حسن محمد',
    'كريم محمد أحمد', 'هدى علي حسن', 'طارق أحمد محمد', 'رنا محمد علي',
    'سامي حسن أحمد', 'دينا علي محمد', 'ماجد محمد حسن', 'ريم أحمد علي',
    'خالد علي محمد', 'نادية محمد أحمد', 'وليد حسن علي', 'سلمى أحمد محمد',
    'باسم محمد علي', 'هالة علي أحمد', 'رامي أحمد حسن', 'لينا محمد علي',
    'عادل علي محمد', 'منى أحمد حسن', 'فيصل محمد علي', 'رغد علي أحمد',
    'نبيل حسن محمد', 'سهى محمد أحمد', 'جمال علي حسن', 'إيمان أحمد محمد',
    'صالح محمد علي', 'وفاء علي أحمد', 'مازن أحمد حسن', 'سمر محمد علي',
    'عبدالله علي محمد', 'هيفاء أحمد حسن', 'محمود محمد علي', 'رشا علي أحمد',
    'إبراهيم حسن محمد', 'نجلاء محمد أحمد', 'عثمان علي حسن', 'سناء أحمد محمد',
    'حمزة محمد علي', 'عبير علي أحمد'
  ];
  addresses text[] := ARRAY[
    'شارع الجمهورية - حي الكرادة', 'شارع فلسطين - حي الجادرية', 'شارع الكندي - حي الحارثية',
    'شارع المنصور - حي المنصور', 'شارع الرشيد - وسط البلد', 'شارع الجامعة - حي الجامعة',
    'شارع الأطباء - حي الطب', 'شارع التجاريين - حي التجار', 'شارع الصناعة - حي الصناعة',
    'شارع الزراعة - حي الزراعة', 'شارع الثقافة - حي الثقافة', 'شارع الرياضة - حي الرياضة',
    'شارع العلوم - حي العلوم', 'شارع الفنون - حي الفنون', 'شارع التكنولوجيا - حي التكنولوجيا',
    'شارع الإعلام - حي الإعلام', 'شارع القانون - حي القانون', 'شارع الطب - حي الطب',
    'شارع الهندسة - حي الهندسة', 'شارع الاقتصاد - حي الاقتصاد'
  ];
BEGIN
  -- الحصول على معرفات المستخدمين
  SELECT id INTO admin_id FROM users WHERE username = 'admin' LIMIT 1;
  SELECT id INTO agent1_id FROM users WHERE username = 'agent1' LIMIT 1;
  SELECT id INTO agent2_id FROM users WHERE username = 'agent2' LIMIT 1;

  -- إضافة 50 سجل جباية
  FOR i IN 1..50 LOOP
    -- تحديد الحالة والامتناع
    IF i <= 15 THEN
      status_val := 'pending';
      is_refused_val := false;
    ELSIF i <= 30 THEN
      status_val := 'completed';
      is_refused_val := false;
    ELSIF i <= 40 THEN
      status_val := 'reviewed';
      is_refused_val := false;
    ELSE
      status_val := 'pending';
      is_refused_val := true;
    END IF;

    -- إدراج السجل
    INSERT INTO collection_records (
      field_agent_id,
      subscriber_name,
      account_number,
      meter_number,
      address,
      last_reading,
      gps_latitude,
      gps_longitude,
      notes,
      status,
      is_refused,
      submitted_at,
      completed_by
    ) VALUES (
      CASE WHEN i % 2 = 0 THEN agent1_id ELSE agent2_id END,
      subscriber_names[((i - 1) % array_length(subscriber_names, 1)) + 1],
      'ACC' || LPAD(i::text, 6, '0'),
      'MTR' || LPAD(i::text, 6, '0'),
      addresses[((i - 1) % array_length(addresses, 1)) + 1],
      (1000 + (i * 50))::text,
      33.3152 + (random() - 0.5) * 0.1, -- خط عرض بغداد مع تنويع
      44.3661 + (random() - 0.5) * 0.1, -- خط طول بغداد مع تنويع
      CASE 
        WHEN is_refused_val THEN 'العميل امتنع عن الدفع'
        WHEN status_val = 'completed' THEN 'تم الدفع بنجاح'
        WHEN status_val = 'reviewed' THEN 'تمت المراجعة والموافقة'
        ELSE 'في انتظار المراجعة'
      END,
      status_val,
      is_refused_val,
      now() - (random() * interval '30 days'), -- تواريخ عشوائية خلال الشهر الماضي
      CASE WHEN status_val IN ('completed', 'reviewed') THEN admin_id ELSE NULL END
    ) RETURNING id INTO record_id;

    -- إضافة سجل حركة لإنشاء السجل
    INSERT INTO activity_logs (
      user_id,
      action,
      target_type,
      target_id,
      target_name,
      details,
      ip_address,
      user_agent,
      created_at
    ) VALUES (
      CASE WHEN i % 2 = 0 THEN agent1_id ELSE agent2_id END,
      'create_record',
      'record',
      record_id,
      subscriber_names[((i - 1) % array_length(subscriber_names, 1)) + 1],
      jsonb_build_object(
        'account_number', 'ACC' || LPAD(i::text, 6, '0'),
        'meter_number', 'MTR' || LPAD(i::text, 6, '0'),
        'is_refused', is_refused_val,
        'status', status_val
      ),
      '192.168.1.' || (100 + (i % 50))::text,
      'Mozilla/5.0 (Mobile; rv:91.0) Gecko/91.0 Firefox/91.0',
      now() - (random() * interval '30 days')
    );

    -- إضافة سجل حركة للتحديث إذا كان مكتمل أو تمت مراجعته
    IF status_val IN ('completed', 'reviewed') THEN
      INSERT INTO activity_logs (
        user_id,
        action,
        target_type,
        target_id,
        target_name,
        details,
        ip_address,
        user_agent,
        created_at
      ) VALUES (
        admin_id,
        'update_record',
        'record',
        record_id,
        subscriber_names[((i - 1) % array_length(subscriber_names, 1)) + 1],
        jsonb_build_object(
          'old_status', 'pending',
          'new_status', status_val,
          'completed_by', 'admin'
        ),
        '192.168.1.10',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        now() - (random() * interval '25 days')
      );
    END IF;
  END LOOP;

  -- إضافة بعض سجلات الحركة للمستخدمين
  INSERT INTO activity_logs (user_id, action, target_type, target_name, details, ip_address, user_agent, created_at) VALUES
  (admin_id, 'login', 'system', 'النظام', '{"username": "admin", "role": "admin"}', '192.168.1.10', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', now() - interval '1 hour'),
  (agent1_id, 'login', 'system', 'النظام', '{"username": "agent1", "role": "field_agent"}', '192.168.1.101', 'Mozilla/5.0 (Mobile; rv:91.0) Gecko/91.0 Firefox/91.0', now() - interval '2 hours'),
  (agent2_id, 'login', 'system', 'النظام', '{"username": "agent2", "role": "field_agent"}', '192.168.1.102', 'Mozilla/5.0 (Mobile; rv:91.0) Gecko/91.0 Firefox/91.0', now() - interval '3 hours');

END $$;