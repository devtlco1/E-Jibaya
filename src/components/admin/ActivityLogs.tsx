import { useState, useEffect } from 'react';
import { ActivityLog } from '../../types';
import { dbOperations } from '../../lib/supabase';
import { useNotifications } from '../../contexts/NotificationContext';
import { Pagination } from '../common/Pagination';
import { 
  Activity, 
  User, 
  Trash2, 
  CreditCard as Edit, 
  Plus, 
  Eye, 
  Shield, 
  Clock, 
  X,
  Upload,
  CheckCircle,
  XCircle,
  Database,
  Settings,
  Download
} from 'lucide-react';
import { formatDateTime, formatDate, formatTime } from '../../utils/dateFormatter';

export function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  // Optimize items per page for mobile
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    return window.innerWidth <= 768 ? 5 : 10;
  });
  const [totalLogs, setTotalLogs] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [users, setUsers] = useState<any[]>([]);
  const [viewingLog, setViewingLog] = useState<ActivityLog | null>(null);

  const { addNotification } = useNotifications();

  useEffect(() => {
    loadLogs();
    loadUsers();
  }, [currentPage, itemsPerPage]);

  // Optimize for mobile: load users only when needed
  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      // Load users in background for mobile
      loadUsers();
    }
  }, []);

  const loadLogs = async () => {
    console.log('Loading activity logs...');
    console.log('Loading activity logs...');
    setLoading(true);
    try {
      const result = await dbOperations.getActivityLogs(currentPage, itemsPerPage);
      console.log('Activity logs result:', result);
      console.log('Activity logs result:', result);
      setLogs(result.data);
      setTotalLogs(result.total);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error('Error loading activity logs:', error);
      addNotification({
        type: 'error',
        title: 'خطأ في تحميل البيانات',
        message: 'حدث خطأ أثناء تحميل سجل الحركات'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const userData = await dbOperations.getUsers();
      setUsers(userData);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return 'النظام';
    const user = users.find(u => u.id === userId);
    if (user) {
      return user.full_name;
    }
    // If user not found, it's likely from a previous database session
    // Since most operations are done by admin, we'll show a generic admin name
    return `المدير العام`;
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'login':
        return <Shield className="w-4 h-4 text-green-600" />;
      case 'logout':
        return <Shield className="w-4 h-4 text-gray-600" />;
      case 'create_user':
        return <Plus className="w-4 h-4 text-blue-600" />;
      case 'update_user':
        return <Edit className="w-4 h-4 text-yellow-600" />;
      case 'delete_user':
        return <Trash2 className="w-4 h-4 text-red-600" />;
      case 'toggle_user_status':
        return <Shield className="w-4 h-4 text-orange-600" />;
      case 'create_record':
        return <Plus className="w-4 h-4 text-green-600" />;
      case 'update_record':
        return <Edit className="w-4 h-4 text-blue-600" />;
      case 'delete_record':
        return <Trash2 className="w-4 h-4 text-red-600" />;
      case 'view_record':
        return <Eye className="w-4 h-4 text-purple-600" />;
      case 'add_photos_to_record':
        return <Plus className="w-4 h-4 text-indigo-600" />;
      case 'upload_photo':
        return <Upload className="w-4 h-4 text-blue-600" />;
      case 'delete_photo':
        return <Trash2 className="w-4 h-4 text-red-600" />;
      case 'view_photo':
        return <Eye className="w-4 h-4 text-purple-600" />;
      case 'download_photo':
        return <Download className="w-4 h-4 text-green-600" />;
      case 'approve_record':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'reject_record':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'complete_record':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'refuse_record':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'export_data':
        return <Download className="w-4 h-4 text-blue-600" />;
      case 'import_data':
        return <Upload className="w-4 h-4 text-blue-600" />;
      case 'backup_data':
        return <Database className="w-4 h-4 text-purple-600" />;
      case 'restore_data':
        return <Database className="w-4 h-4 text-orange-600" />;
      case 'system_maintenance':
        return <Settings className="w-4 h-4 text-gray-600" />;
      case 'security_audit':
        return <Shield className="w-4 h-4 text-red-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActionText = (action: string) => {
    switch (action) {
      case 'login': return 'تسجيل دخول';
      case 'logout': return 'تسجيل خروج';
      case 'create_user': return 'إنشاء مستخدم';
      case 'update_user': return 'تعديل مستخدم';
      case 'delete_user': return 'حذف مستخدم';
      case 'toggle_user_status': return 'تغيير حالة مستخدم';
      case 'create_record': return 'إنشاء سجل';
      case 'update_record': return 'تعديل سجل';
      case 'delete_record': return 'حذف سجل';
      case 'view_record': return 'عرض سجل';
      case 'add_photos_to_record': return 'إضافة صور للسجل';
      case 'upload_photo': return 'رفع صورة';
      case 'delete_photo': return 'حذف صورة';
      case 'view_photo': return 'عرض صورة';
      case 'download_photo': return 'تحميل صورة';
      case 'approve_record': return 'الموافقة على السجل';
      case 'reject_record': return 'رفض السجل';
      case 'complete_record': return 'إكمال السجل';
      case 'refuse_record': return 'رفض السجل';
      case 'export_data': return 'تصدير البيانات';
      case 'import_data': return 'استيراد البيانات';
      case 'backup_data': return 'نسخ احتياطي';
      case 'restore_data': return 'استعادة البيانات';
      case 'system_maintenance': return 'صيانة النظام';
      case 'security_audit': return 'مراجعة أمنية';
      default: return action;
    }
  };

  const getTargetTypeText = (targetType: string) => {
    switch (targetType) {
      case 'user': return 'مستخدم';
      case 'record': return 'سجل جباية';
      case 'system': return 'النظام';
      case 'photo': return 'صورة';
      case 'database': return 'قاعدة البيانات';
      case 'backup': return 'نسخة احتياطية';
      case 'export': return 'تصدير';
      case 'import': return 'استيراد';
      case 'security': return 'أمان';
      case 'maintenance': return 'صيانة';
      default: return targetType;
    }
  };

  const formatLogMessage = (log: ActivityLog) => {
    const userName = getUserName(log.user_id);
    const actionText = getActionText(log.action);
    const targetType = getTargetTypeText(log.target_type);
    const targetName = log.target_name || 'غير محدد';

    // Handle special cases for better Arabic formatting
    if (log.action === 'toggle_user_status') {
      const details = log.details as any;
      const statusText = details?.new_status ? 'تفعيل' : 'تعطيل';
      return `${userName} قام بـ ${statusText} ${targetType}: ${targetName}`;
    }
    
    if (log.action === 'login') {
      return `${userName} سجل دخول إلى النظام`;
    }
    
    if (log.action === 'logout') {
      return `${userName} سجل خروج من النظام`;
    }
    
    if (log.action === 'add_photos_to_record') {
      return `${userName} أضاف صور إضافية لـ ${targetType}: ${targetName}`;
    }
    
    if (log.action === 'upload_photo') {
      return `${userName} رفع ${targetType}: ${targetName}`;
    }
    
    if (log.action === 'download_photo') {
      return `${userName} قام بتحميل ${targetType}: ${targetName}`;
    }
    
    if (log.action === 'approve_record' || log.action === 'complete_record') {
      return `${userName} وافق على ${targetType}: ${targetName}`;
    }
    
    if (log.action === 'reject_record' || log.action === 'refuse_record') {
      return `${userName} رفض ${targetType}: ${targetName}`;
    }
    
    if (log.action === 'export_data') {
      return `${userName} قام بتصدير البيانات`;
    }
    
    if (log.action === 'import_data') {
      return `${userName} قام باستيراد البيانات`;
    }
    
    if (log.action === 'backup_data') {
      return `${userName} قام بإنشاء نسخة احتياطية`;
    }
    
    if (log.action === 'restore_data') {
      return `${userName} قام باستعادة البيانات`;
    }
    
    if (log.action === 'system_maintenance') {
      return `${userName} قام بصيانة النظام`;
    }
    
    if (log.action === 'security_audit') {
      return `${userName} قام بمراجعة أمنية للنظام`;
    }
    
    return `${userName} قام بـ ${actionText} ${targetType}: ${targetName}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400 ml-3" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            سجل الحركات
          </h2>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          إجمالي الحركات: {totalLogs}
        </div>
      </div>

      {/* Activity Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  الوقت
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  المستخدم
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  العملية
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  الهدف
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  التفاصيل
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                // Skeleton loading rows
                Array.from({ length: itemsPerPage }).map((_, index) => (
                  <tr key={`loading-${index}`} className="animate-pulse">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-28"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    لا توجد حركات مسجلة
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 text-gray-400 ml-2" />
                        <div>
                          <div className="font-medium">
                            {formatDate(log.created_at)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTime(log.created_at)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-gray-400 ml-2" />
                        {getUserName(log.user_id)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <div className="flex items-center">
                        {getActionIcon(log.action)}
                        <span className="mr-2">{getActionText(log.action)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <div>
                        <div className="font-medium">{getTargetTypeText(log.target_type)}</div>
                        {log.target_name && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {log.target_name}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs">
                      <div className="truncate" title={formatLogMessage(log)}>
                        {formatLogMessage(log)}
                      </div>
                      {Object.keys(log.details || {}).length > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          تفاصيل إضافية متوفرة
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setViewingLog(log)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        title="عرض التفاصيل"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalLogs}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
          loading={loading}
        />
      </div>

      {/* View Log Details Modal */}
      {viewingLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  تفاصيل الحركة
                </h3>
                <button
                  onClick={() => setViewingLog(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Basic Information */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">المعلومات الأساسية</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">التوقيت:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {formatDateTime(viewingLog.created_at)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">المستخدم:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {getUserName(viewingLog.user_id)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">العملية:</span>
                      <div className="flex items-center">
                        {getActionIcon(viewingLog.action)}
                        <span className="mr-2 text-gray-900 dark:text-white font-medium">
                          {getActionText(viewingLog.action)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">نوع الهدف:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {getTargetTypeText(viewingLog.target_type)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Target Information */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-4">معلومات الهدف</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">معرف الهدف:</span>
                      <p className="text-gray-900 dark:text-white font-medium font-mono text-sm">
                        {viewingLog.target_id || 'غير محدد'}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">اسم الهدف:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {viewingLog.target_name || 'غير محدد'}
                      </p>
                    </div>
                  </div>
                </div>


                {/* Details */}
                {viewingLog.details && Object.keys(viewingLog.details).length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-4">التفاصيل الإضافية</h4>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <pre className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap font-mono">
                        {JSON.stringify(viewingLog.details, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Full Message */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-4">الرسالة الكاملة</h4>
                  <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                    <p className="text-blue-900 dark:text-blue-200">
                      {formatLogMessage(viewingLog)}
                    </p>
                  </div>
                </div>

                {/* Close Button */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex justify-end">
                    <button
                      onClick={() => setViewingLog(null)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      إغلاق
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}