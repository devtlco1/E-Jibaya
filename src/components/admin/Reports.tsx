import React, { useState } from 'react';
import { CollectionRecord } from '../../types';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
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
  // لا نحتاج records بعد الآن - سيتم جلبها عند الحاجة
}

interface ReportFilters {
  startDate: string;
  endDate: string;
  status: string;
  fieldAgent: string;
  branchManager: string;
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

export function Reports({}: ReportsProps) {
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: '',
    endDate: '',
    status: '',
    fieldAgent: '',
    branchManager: '',
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
  const [branchManagers, setBranchManagers] = useState<any[]>([]);
  const [branchManagerFieldAgents, setBranchManagerFieldAgents] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [filteredRecords, setFilteredRecords] = useState<CollectionRecord[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [availableZones, setAvailableZones] = useState<string[]>([]);
  const [availableBlocks, setAvailableBlocks] = useState<string[]>([]);
  const [reportType, setReportType] = useState<'standard' | 'delivery'>('standard');
  const [loadingFilterData, setLoadingFilterData] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    verified: 0,
    refused: 0,
    locked: 0
  });

  const { addNotification } = useNotifications();
  const { user: currentUser } = useAuth();

  // Load statistics based on filters (especially branch manager)
  React.useEffect(() => {
    const loadStats = async () => {
      try {
        // إذا تم اختيار مدير فرع، نحتاج إلى حساب الإحصائيات فقط لسجلات محصليه
        let statsData;
        if (filters.branchManager) {
          // إنشاء user مؤقت لمدير الفرع المحدد
          const branchManagerUser = branchManagers.find(bm => bm.id === filters.branchManager);
          if (branchManagerUser) {
            statsData = await dbOperations.getRecordsStats(branchManagerUser);
          } else {
            statsData = await dbOperations.getRecordsStats(currentUser);
          }
        } else {
          statsData = await dbOperations.getRecordsStats(currentUser);
        }
        setStats(statsData);
      } catch (error) {
        console.error('Error loading stats:', error);
      }
    };
    loadStats();
  }, [currentUser, filters.branchManager, branchManagers]);

  // Load users for filter dropdown
  React.useEffect(() => {
    const loadUsers = async () => {
      try {
        const userData = await dbOperations.getUsers();
        // جلب مديري الفروع للفلتر (يجب أن يكونوا نشطين)
        const activeBranchManagers = userData.filter(u => 
          u.role === 'branch_manager' && 
          u.is_active && 
          !u.username.includes('(محذوف)')
        );
        setBranchManagers(activeBranchManagers);
        
        // لمدير الفرع: عرض فقط المحصلين الميدانيين المحددين له
        if (currentUser?.role === 'branch_manager') {
          const allowedFieldAgentIds = await dbOperations.getBranchManagerFieldAgents(currentUser.id);
          setUsers(userData.filter(u => u.role === 'field_agent' && allowedFieldAgentIds.includes(u.id)));
        } else {
          setUsers(userData.filter(u => u.role === 'field_agent'));
        }
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };
    loadUsers();
  }, [currentUser]);

  // Load available filter data (regions, zones, blocks) - فقط عند الحاجة
  React.useEffect(() => {
    const loadFilterData = async () => {
      setLoadingFilterData(true);
      try {
        // جلب مناطق فريدة فقط
        const { data: regionsData } = await dbOperations.supabase
          ?.from('collection_records')
          .select('region')
          .not('region', 'is', null) || { data: [] };
        
        const regions = Array.from(new Set(
          (regionsData || []).map((r: any) => r.region).filter(Boolean)
        )).sort() as string[];
        setAvailableRegions(regions);

        // جلب zones فريدة فقط
        const { data: zonesData } = await dbOperations.supabase
          ?.from('collection_records')
          .select('new_zone')
          .not('new_zone', 'is', null) || { data: [] };
        
        const zones = Array.from(new Set(
          (zonesData || []).map((r: any) => r.new_zone).filter(Boolean)
        )).sort() as string[];
        setAvailableZones(zones);

        // جلب blocks بناءً على zone المحدد
        if (filters.new_zone) {
          const { data: blocksData } = await dbOperations.supabase
            ?.from('collection_records')
            .select('new_block')
            .eq('new_zone', filters.new_zone)
            .not('new_block', 'is', null) || { data: [] };
          
          const blocks = Array.from(new Set(
            (blocksData || []).map((r: any) => r.new_block).filter(Boolean)
          )).sort() as string[];
          setAvailableBlocks(blocks);
        } else {
          setAvailableBlocks([]);
        }
      } catch (error) {
        console.error('Error loading filter data:', error);
      } finally {
        setLoadingFilterData(false);
      }
    };
    
    loadFilterData();
  }, [filters.new_zone]);

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
    setGenerating(true);
    
    try {
      // جلب السجلات المفلترة مباشرة من قاعدة البيانات
      addNotification({
        type: 'info',
        title: 'جاري تحميل البيانات',
        message: 'يرجى الانتظار...'
      });

      // إنشاء user مؤقت لمدير الفرع المحدد إذا كان موجوداً
      let userForFilter = currentUser;
      if (filters.branchManager) {
        const branchManagerUser = branchManagers.find(bm => bm.id === filters.branchManager);
        if (branchManagerUser) {
          userForFilter = branchManagerUser;
        }
      }
      
      // تمرير reportType و userForFilter لتحسين الأداء
      const records = await dbOperations.getFilteredRecordsForReport(filters, reportType, userForFilter);
      
      if (records.length === 0) {
        addNotification({
          type: 'warning',
          title: 'لا توجد بيانات',
          message: 'لا توجد سجلات تطابق المرشحات المحددة'
        });
        setGenerating(false);
        return;
      }

      setFilteredRecords(records);

      // Generate HTML report based on report type
      const reportHtml = reportType === 'delivery' 
        ? generateDeliveryReportHTML(records) 
        : generateReportHTML(records);
      
      // Create and download the report
      const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = reportType === 'delivery'
        ? `تقرير_الارسالية_${formatDateTimeForFilename(new Date())}.html`
        : `تقرير_سجلات_المشتركين_${formatDateTimeForFilename(new Date())}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addNotification({
        type: 'success',
        title: 'تم إنشاء التقرير',
        message: `تم إنشاء تقرير يحتوي على ${records.length} سجل`
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

  // دالة لتنسيق الأرقام بالعملة العراقية
  const formatIraqiCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '-';
    }
    // تحويل الرقم إلى سلسلة مع فواصل
    const formatted = Math.abs(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '،');
    return `${formatted} د.ع`;
  };

  const generateReportHTML = (records: CollectionRecord[]) => {
    const currentDate = formatDate(new Date());

    const stats = {
      total: records.length,
      pending: records.filter(r => !r.is_refused && r.status === 'pending').length,
      completed: records.filter(r => !r.is_refused && r.status === 'completed').length,
      refused: records.filter(r => r.is_refused).length
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
                    <th>المقاطعة</th>
                    <th>القراءة</th>
                    <th>الترميز</th>
                    <th>الصنف</th>
                    <th>النوع</th>
                    <th>المبلغ الكلي</th>
                    <th>المبلغ الحالي</th>
                    <th>الحالة</th>
                    ${filters.includeImages ? '<th>مقياس</th><th>فاتورة</th>' : ''}
                </tr>
            </thead>
            <tbody>
                ${records.map((record, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${formatDate(record.submitted_at)}</td>
                    <td>${getUserName(record.field_agent_id)}</td>
                    <td>${record.subscriber_name || '-'}</td>
                    <td>${record.account_number || '-'}</td>
                    <td>${record.meter_number || '-'}</td>
                    <td>${record.region || '-'}</td>
                    <td>${record.district || '-'}</td>
                    <td>${record.last_reading || '-'}</td>
                    <td>${record.new_zone || record.new_block || record.new_home ? 
                        `${record.new_zone ? 'ز' + record.new_zone : ''}${record.new_block ? ' ب' + record.new_block : ''}${record.new_home ? ' م' + record.new_home : ''}`.trim() : 
                        '-'}</td>
                    <td>${record.category || '-'}</td>
                    <td>${record.phase || '-'}</td>
                    <td>${record.total_amount ? formatIraqiCurrency(record.total_amount) : '-'}</td>
                    <td>${record.current_amount ? formatIraqiCurrency(record.current_amount) : '-'}</td>
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
            <p>عدد السجلات في التقرير: ${records.length} سجل</p>
        </div>
    </div>
</body>
</html>
    `;
  };

  const generateDeliveryReportHTML = (records: CollectionRecord[]) => {
    const currentDate = formatDate(new Date());
    
    // السجلات تم فلترتها بالفعل في قاعدة البيانات (current_amount > 0)
    // لا حاجة لتصفية إضافية هنا
    const recordsWithAmount = records;

    // حساب إجمالي المبلغ المستلم
    const totalAmount = recordsWithAmount.reduce((sum, r) => sum + (r.current_amount || 0), 0);
    const totalAmountTotal = recordsWithAmount.reduce((sum, r) => sum + (r.total_amount || 0), 0);

    // حساب إحصائيات الأصناف
    const categoryStats: Record<string, {
      count: number;
      totalAmount: number;
      currentAmount: number;
    }> = {};

    recordsWithAmount.forEach(record => {
      const category = record.category || 'غير محدد';
      if (!categoryStats[category]) {
        categoryStats[category] = {
          count: 0,
          totalAmount: 0,
          currentAmount: 0
        };
      }
      categoryStats[category].count++;
      categoryStats[category].totalAmount += record.total_amount || 0;
      categoryStats[category].currentAmount += record.current_amount || 0;
    });

    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>تقرير الارسالية</title>
    <style>
        * { font-family: 'Arial', sans-serif; }
        body { margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #1e40af; margin: 0; font-size: 28px; }
        .header p { color: #6b7280; margin: 10px 0 0 0; }
        .summary { background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center; border-right: 4px solid #2563eb; }
        .summary h3 { margin: 0; color: #1e40af; font-size: 24px; }
        .summary p { margin: 5px 0 0 0; color: #6b7280; }
        .filters-info { background: #eff6ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .filters-info h3 { margin: 0 0 10px 0; color: #1e40af; }
        .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .table th, .table td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: right; font-size: 12px; }
        .table th { background: #f3f4f6; font-weight: bold; color: #374151; }
        .table tr:nth-child(even) { background: #f9fafb; }
        .table tr:hover { background: #f3f4f6; }
        .amount { font-weight: bold; color: #059669; }
        .remaining { font-weight: bold; color: #dc2626; }
        .category-table { width: 100%; border-collapse: collapse; margin-top: 30px; }
        .category-table th, .category-table td { border: 1px solid #d1d5db; padding: 10px 12px; text-align: right; font-size: 13px; }
        .category-table th { background: #1e40af; color: white; font-weight: bold; }
        .category-table tr:nth-child(even) { background: #f9fafb; }
        .signatures { margin-top: 60px; display: flex; justify-content: space-between; align-items: flex-end; }
        .signature-box { width: 200px; text-align: center; border-top: 2px solid #374151; padding-top: 10px; }
        .signature-box h4 { margin: 0 0 40px 0; font-size: 14px; font-weight: bold; color: #374151; }
        .signature-box p { margin: 0; font-size: 12px; color: #6b7280; }
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
            <h1>تقرير الارسالية</h1>
            <p>تاريخ إنشاء التقرير: ${currentDate}</p>
        </div>

        ${filters.startDate || filters.endDate || filters.category ? `
        <div class="filters-info">
            <h3>مرشحات التقرير:</h3>
            ${filters.startDate ? `<p><strong>من تاريخ:</strong> ${formatDate(filters.startDate)}</p>` : ''}
            ${filters.endDate ? `<p><strong>إلى تاريخ:</strong> ${formatDate(filters.endDate)}</p>` : ''}
            ${filters.category ? `<p><strong>الصنف:</strong> ${filters.category}</p>` : ''}
        </div>
        ` : ''}

        <table class="table">
            <thead>
                <tr>
                    <th>تسلسل</th>
                    <th>رقم الحساب</th>
                    <th>المبلغ الكلي</th>
                    <th>المبلغ المستلم</th>
                    <th>تاريخ الاستلام</th>
                    <th>الصنف</th>
                </tr>
            </thead>
            <tbody>
                ${recordsWithAmount.map((record, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${record.account_number || '-'}</td>
                    <td>${formatIraqiCurrency(record.total_amount)}</td>
                    <td class="amount">${formatIraqiCurrency(record.current_amount)}</td>
                    <td>${formatDate(record.submitted_at)}</td>
                    <td>${record.category || '-'}</td>
                </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr style="background: #f3f4f6; font-weight: bold;">
                    <td colspan="2" style="text-align: left;">الإجمالي:</td>
                    <td>${formatIraqiCurrency(totalAmountTotal)}</td>
                    <td class="amount">${formatIraqiCurrency(totalAmount)}</td>
                    <td colspan="2"></td>
                </tr>
            </tfoot>
        </table>

        <div style="margin-top: 40px;">
            <h2 style="text-align: center; color: #1e40af; font-size: 20px; margin-bottom: 20px;">مخرجات التقرير النهائية</h2>
            
            <table class="category-table">
                <thead>
                    <tr>
                        <th>الصنف</th>
                        <th>عدد السجلات</th>
                        <th>المبلغ الكلي</th>
                        <th>المبلغ المستلم</th>
                        <th>المبلغ المتبقي</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(categoryStats).map(([category, stats]) => {
                        const remaining = stats.totalAmount - stats.currentAmount;
                        return `
                        <tr>
                            <td>${category}</td>
                            <td>${stats.count}</td>
                            <td>${formatIraqiCurrency(stats.totalAmount)}</td>
                            <td class="amount">${formatIraqiCurrency(stats.currentAmount)}</td>
                            <td class="remaining">${formatIraqiCurrency(remaining)}</td>
                        </tr>
                        `;
                    }).join('')}
                    <tr style="background: #f3f4f6; font-weight: bold;">
                        <td>الإجمالي</td>
                        <td>${recordsWithAmount.length}</td>
                        <td>${formatIraqiCurrency(totalAmountTotal)}</td>
                        <td class="amount">${formatIraqiCurrency(totalAmount)}</td>
                        <td class="remaining">${formatIraqiCurrency(totalAmountTotal - totalAmount)}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="signatures">
            <div class="signature-box" style="text-align: right;">
                <h4>قارئ المقياس</h4>
                <p>التوقيع:</p>
                <p style="margin-top: 30px;">الختم:</p>
            </div>
            <div class="signature-box" style="text-align: center;">
                <h4>أمين الصندوق</h4>
                <p>التوقيع:</p>
                <p style="margin-top: 30px;">الختم:</p>
            </div>
            <div class="signature-box" style="text-align: left;">
                <h4>مسؤول شعبة المبيعات</h4>
                <p>التوقيع:</p>
                <p style="margin-top: 30px;">الختم:</p>
            </div>
        </div>
    </div>
</body>
</html>
    `;
  };

  const previewReport = async () => {
    setGenerating(true);
    try {
      // جلب السجلات المفلترة مباشرة من قاعدة البيانات
      // تمرير reportType و currentUser لتحسين الأداء - لتقرير الارسالية يفلتر في قاعدة البيانات مباشرة
      const records = await dbOperations.getFilteredRecordsForReport(filters, reportType, currentUser);
      
      if (records.length === 0) {
        addNotification({
          type: 'warning',
          title: 'لا توجد بيانات',
          message: 'لا توجد سجلات تطابق المرشحات المحددة'
        });
        setGenerating(false);
        return;
      }

      setFilteredRecords(records);
      setShowPreview(true);
    } catch (error) {
      console.error('Error loading records for preview:', error);
      addNotification({
        type: 'error',
        title: 'خطأ في تحميل البيانات',
        message: 'حدث خطأ أثناء تحميل السجلات للمعاينة'
      });
    } finally {
      setGenerating(false);
    }
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            <Filter className="w-4 h-4 ml-2" />
            {showFilters ? 'إخفاء الفلاتر' : 'إظهار الفلاتر'}
          </button>
        </div>
        
        {showFilters && (
          <div className="p-6 space-y-4">
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
                مدير الفرع
              </label>
              <select
                value={filters.branchManager}
                onChange={(e) => {
                  setFilters({ 
                    ...filters, 
                    branchManager: e.target.value,
                    fieldAgent: '' // إعادة تعيين المحصل الميداني عند تغيير مدير الفرع
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">جميع مديري الفروع</option>
                {branchManagers.map(bm => (
                  <option key={bm.id} value={bm.id}>
                    {bm.full_name}
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

          {/* الصف الرابع: الحالة، التدقيق، الصور المرفوضة */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          </div>

          {/* الصف الخامس: الصنف، نوع المقياس، المحصل الميداني */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <option value="المحولة الخاصة">المحولة الخاصة</option>
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
                disabled={filters.branchManager && users.length === 0}
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
        )}
      </div>

      {/* Statistics - إحصائيات عامة فقط (بدون تحميل السجلات) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg ml-3">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">إجمالي السجلات</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg ml-3">
              <FileText className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">قيد المراجعة</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pending}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg ml-3">
              <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">مكتملة</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completed}</p>
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
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.refused}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Report Type Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          نوع التقرير
        </h3>
        
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => setReportType('standard')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              reportType === 'standard'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            تقرير سجلات المشتركين
          </button>
          
          <button
            onClick={() => setReportType('delivery')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              reportType === 'delivery'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            تقرير الارسالية
          </button>
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
            disabled={generating}
            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
          >
            {generating ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin ml-2"></div>
            ) : (
              <Eye className="w-4 h-4 ml-2" />
            )}
            {generating ? 'جاري التحميل...' : 'معاينة التقرير'}
          </button>
          
          <button
            onClick={generateReport}
            disabled={generating}
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

        <p className="text-gray-500 dark:text-gray-400 text-sm mt-3">
          سيتم جلب السجلات المفلترة من قاعدة البيانات عند إنشاء التقرير
        </p>
        
        {reportType === 'delivery' && (
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>ملاحظة:</strong> تقرير الارسالية يعرض فقط السجلات التي لديها مبلغ مستلم (المبلغ الحالي أكبر من صفر).
            </p>
          </div>
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
                    {reportType === 'delivery' ? 'تقرير الارسالية' : 'تقرير سجلات المشتركين'}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    {reportType === 'delivery' 
                      ? `عدد السجلات: ${filteredRecords.filter(r => r.current_amount !== null && r.current_amount !== undefined && r.current_amount > 0).length}`
                      : `عدد السجلات: ${filteredRecords.length}`
                    }
                  </p>
                </div>

                {filters.includeImages && reportType === 'standard' && (
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
                        {reportType === 'delivery' ? (
                          <>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">تسلسل</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">رقم الحساب</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">المبلغ الكلي</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">المبلغ المستلم</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">تاريخ الاستلام</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">الصنف</th>
                          </>
                        ) : (
                          <>
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
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {(reportType === 'delivery' 
                        ? filteredRecords.filter(r => r.current_amount !== null && r.current_amount !== undefined && r.current_amount > 0).slice(0, 10)
                        : filteredRecords.slice(0, 10)
                      ).map((record, index) => (
                        <tr key={record.id}>
                          {reportType === 'delivery' ? (
                            <>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{index + 1}</td>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                {record.account_number || 'غير محدد'}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                {record.total_amount ? record.total_amount.toFixed(2) : '-'}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-white font-medium text-green-600 dark:text-green-400">
                                {record.current_amount?.toFixed(2) || '0.00'}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                {formatDate(record.submitted_at)}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                {record.category || 'غير محدد'}
                              </td>
                            </>
                          ) : (
                            <>
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
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {(reportType === 'delivery' 
                  ? filteredRecords.filter(r => r.current_amount !== null && r.current_amount !== undefined && r.current_amount > 0).length
                  : filteredRecords.length
                ) > 10 && (
                  <p className="text-center text-gray-500 dark:text-gray-400 text-sm">
                    ... و {(reportType === 'delivery' 
                      ? filteredRecords.filter(r => r.current_amount !== null && r.current_amount !== undefined && r.current_amount > 0).length
                      : filteredRecords.length
                    ) - 10} سجل آخر
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