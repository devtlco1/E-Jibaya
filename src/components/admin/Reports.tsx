import React, { useState } from 'react';
import { CollectionRecord } from '../../types';
import { useNotifications } from '../../contexts/NotificationContext';
import { dbOperations } from '../../lib/supabase';
import { 
  FileBarChart, 
  Download, 
  Filter,
  Users,
  MapPin,
  Camera,
  FileText,
  Eye,
  Image as ImageIcon
} from 'lucide-react';
import { formatDate, formatDateTimeForFilename } from '../../utils/dateFormatter';

interface ReportsProps {
  records: CollectionRecord[];
}

interface ReportFilters {
  startDate: string;
  endDate: string;
  status: string;
  fieldAgent: string;
  includeImages: boolean;
  // الترميز الجديد
  new_zone: string;
  new_block: string;
  // الفلاتر الجديدة
  region: string;
  verification_status: string;
  category: string;
  phase: string;
  // الصور المرفوضة
  rejected_photos?: 'any' | 'none' | '';
}

export function Reports({ records }: ReportsProps) {
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: '',
    endDate: '',
    status: '',
    fieldAgent: '',
    includeImages: true,
    // الترميز الجديد
    new_zone: '',
    new_block: '',
    // الفلاتر الجديدة
    region: '',
    verification_status: '',
    category: '',
    phase: '',
    // الصور المرفوضة
    rejected_photos: ''
  });
  const [users, setUsers] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [filteredRecords, setFilteredRecords] = useState<CollectionRecord[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [availableZones, setAvailableZones] = useState<string[]>([]);
  const [availableBlocks, setAvailableBlocks] = useState<string[]>([]);

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

  // Load available filter data
  React.useEffect(() => {
    // Load regions
    const regions = Array.from(new Set(records.map(r => r.region).filter((region): region is string => Boolean(region)))).sort();
    setAvailableRegions(regions);

    // Load zones
    const zones = Array.from(new Set(records.map(r => r.new_zone).filter((zone): zone is string => Boolean(zone)))).sort();
    setAvailableZones(zones);

    // Load blocks based on selected zone
    if (filters.new_zone) {
      const blocks = Array.from(new Set(
        records
          .filter(r => r.new_zone === filters.new_zone)
          .map(r => r.new_block)
          .filter((block): block is string => Boolean(block))
      )).sort();
      setAvailableBlocks(blocks);
    } else {
      setAvailableBlocks([]);
    }
  }, [records, filters.new_zone]);

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
        filtered = filtered.filter(r => r.is_refused);
      } else {
        filtered = filtered.filter(r => r.status === filters.status && !r.is_refused);
      }
    }

    if (filters.fieldAgent) {
      filtered = filtered.filter(r => r.field_agent_id === filters.fieldAgent);
    }

    // تصفية الترميز الجديد
    if (filters.new_zone) {
      filtered = filtered.filter(r => r.new_zone === filters.new_zone);
    }

    if (filters.new_block) {
      filtered = filtered.filter(r => r.new_block === filters.new_block);
    }

    // الفلاتر الجديدة
    if (filters.region) {
      filtered = filtered.filter(r => r.region === filters.region);
    }

    if (filters.verification_status) {
      filtered = filtered.filter(r => r.verification_status === filters.verification_status);
    }

    if (filters.category) {
      filtered = filtered.filter(r => r.category === filters.category);
    }

    if (filters.phase) {
      filtered = filtered.filter(r => r.phase === filters.phase);
    }

    // الصور المرفوضة
    if (filters.rejected_photos === 'any') {
      filtered = filtered.filter(r => r.meter_photo_rejected || r.invoice_photo_rejected);
    }
    if (filters.rejected_photos === 'none') {
      filtered = filtered.filter(r => !r.meter_photo_rejected && !r.invoice_photo_rejected);
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
    if (record.is_refused) return 'ممتنع';
    switch (record.status) {
      case 'pending': return 'قيد المراجعة';
      case 'completed': return 'مكتمل';
      case 'refused': return 'ممتنع';
      default: return record.status;
    }
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
      link.download = `تقرير_سجلات_المشتركين_${formatDateTimeForFilename(new Date())}.html`;
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
    const currentDate = formatDate(new Date());

    const stats = {
      total: filteredRecords.length,
      pending: filteredRecords.filter(r => !r.is_refused && r.status === 'pending').length,
      completed: filteredRecords.filter(r => !r.is_refused && r.status === 'completed').length,
      refused: filteredRecords.filter(r => r.is_refused).length
    };

    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>تقرير سجلات المشتركين</title>
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
        .table th, .table td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: right; font-size: 11px; }
        .table th { background: #f3f4f6; font-weight: bold; color: #374151; font-size: 10px; }
        .table tr:nth-child(even) { background: #f9fafb; }
        .table { font-size: 11px; }
        .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .status-pending { background: #fef3c7; color: #92400e; }
        .status-completed { background: #d1fae5; color: #065f46; }
        .status-refused { background: #fee2e2; color: #991b1b; }
        .image-ref { background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 11px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #d1d5db; text-align: center; color: #6b7280; font-size: 14px; }
        @media print { 
          body { background: white; } 
          .container { box-shadow: none; }
          @page { size: A4 landscape; margin: 0.5in; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>تقرير سجلات المشتركين</h1>
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
                <h3>${stats.refused}</h3>
                <p>امتناع</p>
            </div>
        </div>

        ${filters.startDate || filters.endDate || filters.status || filters.fieldAgent ? `
        <div class="filters-info">
            <h3>مرشحات التقرير:</h3>
            ${filters.startDate ? `<p><strong>من تاريخ:</strong> ${formatDate(filters.startDate)}</p>` : ''}
            ${filters.endDate ? `<p><strong>إلى تاريخ:</strong> ${formatDate(filters.endDate)}</p>` : ''}
            ${filters.status ? `<p><strong>الحالة:</strong> ${filters.status === 'refused' ? 'امتنع' : filters.status === 'pending' ? 'قيد المراجعة' : filters.status === 'completed' ? 'مكتمل' : 'ممتنع'}</p>` : ''}
            ${filters.fieldAgent ? `<p><strong>المحصل الميداني:</strong> ${getUserName(filters.fieldAgent)}</p>` : ''}
            ${filters.new_zone ? `<p><strong>الزون:</strong> ${filters.new_zone}</p>` : ''}
            ${filters.new_block ? `<p><strong>البلوك:</strong> ${filters.new_block}</p>` : ''}
            ${filters.region ? `<p><strong>المنطقة:</strong> ${filters.region}</p>` : ''}
            ${filters.verification_status ? `<p><strong>التدقيق:</strong> ${filters.verification_status}</p>` : ''}
            ${filters.category ? `<p><strong>الصنف:</strong> ${filters.category}</p>` : ''}
            ${filters.phase ? `<p><strong>نوع المقياس:</strong> ${filters.phase}</p>` : ''}
        </div>
        ` : ''}

        <table class="table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>التاريخ</th>
                    <th>المحصل</th>
                    <th>المشترك</th>
                    <th>الحساب</th>
                    <th>المقياس</th>
                    <th>المنطقة</th>
                    <th>القراءة</th>
                    <th>الترميز</th>
                    <th>الصنف</th>
                    <th>النوع</th>
                    <th>الحالة</th>
                    ${filters.includeImages ? '<th>مقياس</th><th>فاتورة</th>' : ''}
                </tr>
            </thead>
            <tbody>
                ${filteredRecords.map((record, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${formatDate(record.submitted_at)}</td>
                    <td>${getUserName(record.field_agent_id)}</td>
                    <td>${record.subscriber_name || '-'}</td>
                    <td>${record.account_number || '-'}</td>
                    <td>${record.meter_number || '-'}</td>
                    <td>${record.region || '-'}</td>
                    <td>${record.last_reading || '-'}</td>
                    <td>${record.new_zone || record.new_block || record.new_home ? 
                        `${record.new_zone ? 'ز' + record.new_zone : ''}${record.new_block ? ' ب' + record.new_block : ''}${record.new_home ? ' م' + record.new_home : ''}`.trim() : 
                        '-'}</td>
                    <td>${record.category || '-'}</td>
                    <td>${record.phase || '-'}</td>
                    <td><span class="status status-${record.is_refused ? 'refused' : record.status}">${getStatusText(record)}</span></td>
                    ${filters.includeImages ? `
                    <td>${record.meter_photo_url ? `<span class="image-ref">${extractImageId(record.meter_photo_url)}</span>` : '-'}</td>
                    <td>${record.invoice_photo_url ? `<span class="image-ref">${extractImageId(record.invoice_photo_url)}</span>` : '-'}</td>
                    ` : ''}
                </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="footer">
            <p>تم إنشاء هذا التقرير بواسطة نظام سجلات المشتركين</p>
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
      return 'ممتنع';
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
          فلاتر التقرير
        </h3>
        
        <div className="space-y-4">
          {/* الصف الأول: التواريخ والمحصل الميداني */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          </div>

          {/* الصف الثالث: المنطقة والزون والبلوك */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                المنطقة
              </label>
              <select
                value={filters.region}
                onChange={(e) => setFilters({ ...filters, region: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">جميع المناطق</option>
                {availableRegions.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                الزون
              </label>
              <select
                value={filters.new_zone}
                onChange={(e) => {
                  setFilters({ 
                    ...filters, 
                    new_zone: e.target.value,
                    new_block: '' // إعادة تعيين البلوك عند تغيير الزون
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">جميع الزونات</option>
                {availableZones.map(zone => (
                  <option key={zone} value={zone}>{zone}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                البلوك
              </label>
              <select
                value={filters.new_block}
                onChange={(e) => setFilters({ ...filters, new_block: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                disabled={!filters.new_zone}
              >
                <option value="">جميع البلوكات</option>
                {availableBlocks.map(block => (
                  <option key={block} value={block}>{block}</option>
                ))}
              </select>
            </div>
          </div>

          {/* الصف الرابع: الحالة، التدقيق، الصور المرفوضة، الصنف، نوع المقياس */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                <option value="refused">امتنع</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                التدقيق
              </label>
              <select
                value={filters.verification_status}
                onChange={(e) => setFilters({ ...filters, verification_status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">جميع حالات التدقيق</option>
                <option value="مدقق">مدقق</option>
                <option value="غير مدقق">غير مدقق</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                الصور المرفوضة
              </label>
              <select
                value={filters.rejected_photos || ''}
                onChange={(e) => setFilters({ ...filters, rejected_photos: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">الكل</option>
                <option value="any">يوجد صور مرفوضة</option>
                <option value="none">لا توجد صور مرفوضة</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                الصنف
              </label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">جميع الأصناف</option>
                <option value="منزلي">منزلي</option>
                <option value="تجاري">تجاري</option>
                <option value="صناعي">صناعي</option>
                <option value="زراعي">زراعي</option>
                <option value="حكومي">حكومي</option>
                <option value="انارة">انارة</option>
                <option value="محولة خاصة">محولة خاصة</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                نوع المقياس
              </label>
              <select
                value={filters.phase}
                onChange={(e) => setFilters({ ...filters, phase: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">جميع الأنواع</option>
                <option value="احادي">احادي</option>
                <option value="ثلاثي">ثلاثي</option>
                <option value="سي تي">سي تي</option>
              </select>
            </div>
          </div>


          {/* تضمين الصور */}
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
                    تقرير سجلات المشتركين
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