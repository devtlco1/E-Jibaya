/*
  # إصلاح سياسات RLS لجدول سجل الحركات

  1. حذف السياسات القديمة
  2. إنشاء سياسات جديدة تسمح للمديرين بالقراءة
  3. السماح لجميع المستخدمين المصادق عليهم بإنشاء سجلات
*/

-- حذف السياسات القديمة إن وجدت
DROP POLICY IF EXISTS "Admins can read activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Authenticated users can create activity logs" ON activity_logs;

-- سياسة للقراءة - المديرين فقط
CREATE POLICY "Admins can read activity logs"
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

-- سياسة للإنشاء - جميع المستخدمين المصادق عليهم
CREATE POLICY "Authenticated users can create activity logs"
  ON activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.is_active = true
    )
  );