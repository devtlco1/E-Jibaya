import React, { useState } from 'react';
import { CollectionRecord } from '../../types';
import { useNotifications } from '../../contexts/NotificationContext';
import { dbOperations } from '../../lib/supabase';
import { 
  FileBarChart, 
  Download, 
  Calendar, 
  Filter,
  Users,
  MapPin,
  Camera,
  FileText,
  Printer,
  Eye,
  Image as ImageIcon
} from 'lucide-react';

interface ReportsProps {
  records: CollectionRecord[];
}

interface ReportFilters {
  startDate: string;
  endDate: string;
  status: string;
  fieldAgent: string;
  includeImages: boolean;
}

export function Reports({ records }: ReportsProps) {
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: '',
    endDate: '',
    status: '',
    fieldAgent: '',
    includeImages: true
  });
  const [users, setUsers] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [filteredRecords, setFilteredRecords] = useState<CollectionRecord[]>([]);

  const { addNotification } = useNotifications();

  // Load users for filter dropdown
  React.useEffect(() => {
    const loadUsers = async () => {
      try {
        const userData = await dbOperations.getUsers();
        setUsers(userData.filter(u => u.role === 'field_agent'));
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };
    loadUsers();
  }, []);

  // Apply filters to records
  React.useEffect(() => {
    let filtered = records;

    if (filters.startDate) {
      filtered = filtered.filter(r => 
        new Date(r.submitted_at) >= new Date(filters.startDate)
      );
    }

    if (filters.endDate) {
      filtered = filtered.filter(r => 
        new Date(r.submitted_at) <= new Date(filters.endDate + 'T23:59:59')
      );
    }

    if (filters.status) {
      if (filters.status === 'refused') {
        filtered = filtered.filter(r => r.is_refused === true);
      } else {
        filtered = filtered.filter(r => r.is_refused !== true && r.status === filters.status);
      }
    }

    if (filters.fieldAgent) {
      filtered = filtered.filter(r => r.field_agent_id === filters.fieldAgent);
    }

    setFilteredRecords(filtered);
  }, [records, filters]);

  const getUserName = (userId: string | null) => {
    if (!userId) return 'غير محدد';
    const user = users.find(u => u.id === userId);
    if (!user) return 'مستخدم محذوف';
    
    if (user.username.includes('(محذوف)')) {
      return `${user.full_name} (محذوف)`;
    }
    
    return user.full_name;
  };

  const getStatusText = (record: CollectionRecord) => {
    if (record.is_refused) return 'امتنع';
    switch (record.status) {
      case 'pending': return 'قيد المراجعة';
      case 'completed': return 'مكتمل';
      case 'reviewed': return 'تمت المراجعة';
      default: return record.status;
    }
  };

  const generateImageNumber = (recordIndex: number, imageType: 'meter' | 'invoice') => {
    const prefix = imageType === 'meter' ? 'M' : 'I';
    return `${prefix}${String(recordIndex + 1).padStart(3, '0')}`;
  };

  const extractImageId = (imageUrl: string): string => {
    try {
      if (imageUrl && imageUrl.includes('/')) {
        // Extract filename from Supabase Storage URL
        const parts = imageUrl.split('/');
        const filename = parts[parts.length - 1];
        return filename.replace('.jpg', '').replace('.png', '').replace('.webp', '');
      }
      return 'غير محدد';
    } catch (error) {
      return 'غير محدد';
    }
  };

  const generateReport = async () => {
    if (filteredRecords.length === 0) {
      addNotification({
        type: 'warning',
        title: 'لا توجد بيانات',
        message: 'لا توجد سجلات تطابق المرشحات المحددة'
      });
      return;
    }

    setGenerating(true);
    
    try {
      // Generate HTML report
      const reportHtml = generateReportHTML();
      
      // Create and download the report
      const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `تقرير_الجباية_${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addNotification({
        type: 'success',
        title: 'تم إنشاء التقرير',
        message: `تم إنشاء تقرير يحتوي على ${filteredRecords.length} سجل`
      });
    } catch (error) {
      console.error('Error generating report:', error);
      addNotification({
        type: 'error',
        title: 'خطأ في إنشاء التقرير',
        message: 'حدث خطأ أثناء إنشاء التقرير'
      });
    } finally {
      setGenerating(false);
    }
  };

  const generateReportHTML = () => {
    const currentDate = new Date().toLocaleDateString('ar', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      calendar: 'gregory'
    });

    const stats = {
      total: filteredRecords.length,
      pending: filteredRecords.filter(r => !r.is_refused && r.status === 'pending').length,
      completed: filteredRecords.filter(r => !r.is_refused && r.status === 'completed').length,
      reviewed: filteredRecords.filter(r => !r.is_refused && r.status === 'reviewed').length,
      refused: filteredRecords.filter(r => r.is_refused).length
    };

    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>تقرير الجباية الإلكترونية</title>
    <style>
        * { font-family: 'Arial', sans-serif; }
        body { margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #1e40af; margin: 0; font-size: 28px; }
        .header p { color: #6b7280; margin: 10px 0 0 0; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .stat-card { background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; border-right: 4px solid #2563eb; }
        .stat-card h3 { margin: 0; color: #1e40af; font-size: 24px; }
        .stat-card p { margin: 5px 0 0 0; color: #6b7280; }
        .filters-info { background: #eff6ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .filters-info h3 { margin: 0 0 10px 0; color: #1e40af; }
        .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .table th, .table td { border: 1px solid #d1d5db; padding: 12px; text-align: right; }
        .table th { background: #f3f4f6; font-weight: bold; color: #374151; }
        .table tr:nth-child(even) { background: #f9fafb; }
        .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .status-pending { background: #fef3c7; color: #92400e; }
        .status-completed { background: #d1fae5; color: #065f46; }
        .status-reviewed { background: #dbeafe; color: #1e40af; }
        .status-refused { background: #fee2e2; color: #991b1b; }
        .image-ref { background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 11px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #d1d5db; text-align: center; color: #6b7280; font-size: 14px; }
        @media print { body { background: white; } .container { box-shadow: none; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>تقرير الجباية الإلكترونية</h1>
            <p>تاريخ إنشاء التقرير: ${currentDate}</p>
        </div>

        <div class="stats">
            <div class="stat-card">
                <h3>${stats.total}</h3>
                <p>إجمالي السجلات</p>
            </div>
            <div class="stat-card">
                <h3>${stats.pending}</h3>
                <p>قيد المراجعة</p>
            </div>
            <div class="stat-card">
                <h3>${stats.completed}</h3>
                <p>مكتملة</p>
            </div>
            <div class="stat-card">
                <h3>${stats.reviewed}</h3>
                <p>تمت المراجعة</p>
            </div>
            <div class="stat-card">
                <h3>${stats.refused}</h3>
                <p>امتناع</p>
            </div>
        </div>

        ${filters.startDate || filters.endDate || filters.status || filters.fieldAgent ? `
        <div class="filters-info">
            <h3>مرشحات التقرير:</h3>
            ${filters.startDate ? `<p><strong>من تاريخ:</strong> ${new Date(filters.startDate).toLocaleDateString('ar', { calendar: 'gregory' })}</p>` : ''}
            ${filters.endDate ? `<p><strong>إلى تاريخ:</strong> ${new Date(filters.endDate).toLocaleDateString('ar', { calendar: 'gregory' })}</p>` : ''}
            ${filters.status ? `<p><strong>الحالة:</strong> ${filters.status === 'refused' ? 'امتنع' : filters.status === 'pending' ? 'قيد المراجعة' : filters.status === 'completed' ? 'مكتمل' : 'تمت المراجعة'}</p>` : ''}
            ${filters.fieldAgent ? `<p><strong>المحصل الميداني:</strong> ${getUserName(filters.fieldAgent)}</p>` : ''}
        </div>
        ` : ''}

        <table class="table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>تاريخ الإنشاء</th>
                    <th>المحصل الميداني</th>
                    <th>اسم المشترك</th>
                    <th>رقم الحساب</th>
                    <th>رقم المقياس</th>
                    <th>العنوان</th>
                    <th>آخر قراءة</th>
                    <th>الحالة</th>
                    ${filters.includeImages ? '<th>صورة المقياس</th><th>صورة الفاتورة</th>' : ''}
                    <th>الملاحظات</th>
                </tr>
            </thead>
            <tbody>
                ${filteredRecords.map((record, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${new Date(record.submitted_at).toLocaleDateString('ar', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric',
                      calendar: 'gregory'
                    })}</td>
                    <td>${getUserName(record.field_agent_id)}</td>
                    <td>${record.subscriber_name || 'غير محدد'}</td>
                    <td>${record.account_number || 'غير محدد'}</td>
                    <td>${record.meter_number || 'غير محدد'}</td>
                    <td>${record.address || 'غير محدد'}</td>
                    <td>${record.last_reading || 'غير محدد'}</td>
                    <td><span class="status status-${record.is_refused ? 'refused' : record.status}">${getStatusText(record)}</span></td>
                    ${filters.includeImages ? `
                    <td>${record.meter_photo_url ? `<span class="image-ref">${extractImageId(record.meter_photo_url)}</span>` : 'لا توجد'}</td>
                    <td>${record.invoice_photo_url ? `<span class="image-ref">${extractImageId(record.invoice_photo_url)}</span>` : 'لا توجد'}</td>
                    ` : ''}
                    <td>${record.notes || 'لا توجد'}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="footer">
            <p>تم إنشاء هذا التقرير بواسطة نظام الجباية الإلكترونية</p>
            <p>عدد السجلات في التقرير: ${filteredRecords.length} سجل</p>
        </div>
    </div>
</body>
</html>
    `;
  };

  const previewReport = () => {
    if (filteredRecords.length === 0) {
      addNotification({
        type: 'warning',
        title: 'لا توجد بيانات',
        message: 'لا توجد سجلات تطابق المرشحات المحددة'
      });
      return;
    }
    setShowPreview(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'reviewed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'refused': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getRecordStatus = (record: CollectionRecord) => {
    if (record.is_refused) {
      return 'refused';
    }
    return record.status;
  };

  const getRecordStatusText = (record: CollectionRecord) => {
    if (record.is_refused) {
      return 'امتنع';
    }
    return getStatusText(record);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <FileBarChart className="w-6 h-6 text-blue-600 dark:text-blue-400 ml-3" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            التقارير
          </h2>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Filter className="w-5 h-5 ml-2" />
          مرشحات التقرير
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              من تاريخ
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              إلى تاريخ
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              الحالة
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">جميع الحالات</option>
              <option value="pending">قيد المراجعة</option>
              <option value="completed">مكتمل</option>
              <option value="reviewed">تمت المراجعة</option>
              <option value="refused">امتنع</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              المحصل الميداني
            </label>
            <select
              value={filters.fieldAgent}
              onChange={(e) => setFilters({ ...filters, fieldAgent: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">جميع المحصلين</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="includeImages"
              checked={filters.includeImages}
              onChange={(e) => setFilters({ ...filters, includeImages: e.target.checked })}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <label htmlFor="includeImages" className="mr-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              تضمين أرقام الصور
            </label>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg ml-3">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">إجمالي السجلات</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{filteredRecords.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg ml-3">
              <MapPin className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">تحتوي على موقع</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {filteredRecords.filter(r => r.gps_latitude && r.gps_longitude).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg ml-3">
              <Camera className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">تحتوي على صور</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {filteredRecords.filter(r => r.meter_photo_url || r.invoice_photo_url).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg ml-3">
              <Users className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">امتناع</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {filteredRecords.filter(r => r.is_refused).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          إجراءات التقرير
        </h3>
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={previewReport}
            disabled={filteredRecords.length === 0}
            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
          >
            <Eye className="w-4 h-4 ml-2" />
            معاينة التقرير
          </button>
          
          <button
            onClick={generateReport}
            disabled={generating || filteredRecords.length === 0}
            className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
          >
            {generating ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin ml-2"></div>
            ) : (
              <Download className="w-4 h-4 ml-2" />
            )}
            {generating ? 'جاري الإنشاء...' : 'تحميل التقرير'}
          </button>
        </div>

        {filteredRecords.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-3">
            لا توجد سجلات تطابق المرشحات المحددة
          </p>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  معاينة التقرير
                </h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-4">
                <div className="text-center">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    تقرير الجباية الإلكترونية
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    عدد السجلات: {filteredRecords.length}
                  </p>
                </div>

                {filters.includeImages && (
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2 flex items-center">
                      <ImageIcon className="w-4 h-4 ml-2" />
                      أرقام الصور الموحدة
                    </h4>
                    <p className="text-blue-800 dark:text-blue-300 text-sm">
                      كل صورة لها رقم موحد يتم إنشاؤه عند الرفع (مثل: M_IMG_1234567890_abc12)
                    </p>
                  </div>
                )}

                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">#</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">المشترك</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">الحساب</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">الحالة</th>
                        {filters.includeImages && (
                          <>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">صورة المقياس</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">صورة الفاتورة</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredRecords.slice(0, 10).map((record, index) => (
                        <tr key={record.id}>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{index + 1}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                            {record.subscriber_name || 'غير محدد'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                            {record.account_number || 'غير محدد'}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(getRecordStatus(record))}`}>
                              {getRecordStatusText(record)}
                            </span>
                          </td>
                          {filters.includeImages && (
                            <>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                {record.meter_photo_url ? (
                                  <span className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-xs font-mono">
                                    {extractImageId(record.meter_photo_url)}
                                  </span>
                                ) : (
                                  'لا توجد'
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                {record.invoice_photo_url ? (
                                  <span className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-xs font-mono">
                                    {extractImageId(record.invoice_photo_url)}
                                  </span>
                                ) : (
                                  'لا توجد'
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredRecords.length > 10 && (
                  <p className="text-center text-gray-500 dark:text-gray-400 text-sm">
                    ... و {filteredRecords.length - 10} سجل آخر
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}