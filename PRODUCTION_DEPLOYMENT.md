# 🚀 دليل نشر النظام للإنتاج

## 📋 **الخطوات المطلوبة:**

### **1. إعداد متغيرات البيئة للإنتاج:**

أنشئ ملف `.env.production` في المجلد الرئيسي:

```env
# Production Environment Variables
VITE_SUPABASE_URL=https://lrcbjzrmyfkhktcrqzcn.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyY2JqenJteWZraGt0Y3JxemNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTY1ODgsImV4cCI6MjA3NDk5MjU4OH0.iCmD03odYhhbg2lFQC1LifB5vCcgtMkYq2VFdlCTWjw
```

### **2. بناء المشروع للإنتاج:**

```bash
npm run build
```

### **3. خيارات النشر:**

#### **أ) Netlify (مجاني وسهل):**
1. اذهب إلى [netlify.com](https://netlify.com)
2. سجل دخول أو أنشئ حساب
3. اضغط "New site from Git"
4. اختر GitHub repository
5. إعدادات البناء:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Environment variables: أضف المتغيرات من `.env.production`

#### **ب) Vercel (مجاني وسريع):**
1. اذهب إلى [vercel.com](https://vercel.com)
2. سجل دخول مع GitHub
3. اضغط "New Project"
4. اختر repository
5. إعدادات البناء:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Environment Variables: أضف المتغيرات

#### **ج) GitHub Pages (مجاني):**
1. في GitHub repository، اذهب إلى Settings
2. اختر Pages من القائمة الجانبية
3. Source: GitHub Actions
4. أنشئ ملف `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v3
      
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Build
      run: npm run build
      env:
        VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
        VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
        
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist
```

### **4. إعداد قاعدة البيانات للإنتاج:**

#### **أ) إنشاء bucket للصور:**
1. اذهب إلى Supabase Dashboard
2. اختر Storage
3. أنشئ bucket جديد باسم `photos`
4. فعّل Public access

#### **ب) إعداد RLS Policies:**
```sql
-- تفعيل RLS للجداول
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_photos ENABLE ROW LEVEL SECURITY;

-- سياسات للمستخدمين
CREATE POLICY "Users can read all users" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update their own data" ON users FOR UPDATE TO authenticated USING (auth.uid()::text = id);

-- سياسات للسجلات
CREATE POLICY "Authenticated users can read records" ON collection_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert records" ON collection_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update records" ON collection_records FOR UPDATE TO authenticated USING (true);

-- سياسات للصور
CREATE POLICY "Authenticated users can read photos" ON record_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert photos" ON record_photos FOR INSERT TO authenticated WITH CHECK (true);

-- سياسات لسجل الأنشطة
CREATE POLICY "Authenticated users can read activity logs" ON activity_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert activity logs" ON activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- سياسات للـ Storage
CREATE POLICY "Public read access for photos" ON storage.objects FOR SELECT USING (bucket_id = 'photos');
CREATE POLICY "Authenticated users can upload photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'photos');
```

### **5. اختبار الإنتاج:**

#### **أ) اختبار الوظائف الأساسية:**
- [ ] تسجيل الدخول
- [ ] إضافة سجل جديد
- [ ] رفع الصور
- [ ] عرض السجلات
- [ ] النسخ الاحتياطي
- [ ] الاستعادة

#### **ب) اختبار الأمان:**
- [ ] RLS يعمل بشكل صحيح
- [ ] المستخدمون لا يمكنهم الوصول لبيانات الآخرين
- [ ] الصور محمية

### **6. مراقبة الأداء:**

#### **أ) Supabase Dashboard:**
- مراقبة استخدام قاعدة البيانات
- مراقبة Storage usage
- مراقبة API calls

#### **ب) مراقبة الأخطاء:**
- تفعيل error tracking (Sentry)
- مراقبة console errors
- مراقبة network errors

## 🎯 **نصائح مهمة:**

### **الأمان:**
- استخدم HTTPS دائماً
- فعّل RLS policies
- راقب API usage
- استخدم strong passwords

### **الأداء:**
- فعّل compression
- استخدم CDN
- راقب bundle size
- استخدم lazy loading

### **النسخ الاحتياطي:**
- فعّل automatic backups في Supabase
- أنشئ نسخ احتياطية دورية
- اختبر عملية الاستعادة

## 📞 **الدعم:**

إذا واجهت أي مشاكل:
1. تحقق من console errors
2. تحقق من network tab
3. تحقق من Supabase logs
4. راجع هذا الدليل

---

**🎉 مبروك! نظام الجباية الإلكترونية جاهز للإنتاج!**
