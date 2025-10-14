import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { DataTable } from './DataTable';
import { UserManagement } from './UserManagement';
import { Reports } from './Reports';
import { ActivityLogs } from './ActivityLogs';
import { BackupSystem } from './BackupSystem';
import { CollectionRecord, FilterState } from '../../types';
import { useNotifications } from '../../contexts/NotificationContext';
import { dbOperations } from '../../lib/supabase';
import { 
  Users, 
  Database, 
  LogOut, 
  Moon, 
  Sun, 
  BarChart3,
  FileText,
  Camera,
  FileBarChart,
  UserCheck,
  HardDrive,
  Lock
} from 'lucide-react';

export function AdminDashboard() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { addNotification } = useNotifications();
  
  const [activeTab, setActiveTab] = useState<'records' | 'users' | 'reports' | 'activities' | 'backup'>('records');

  // Redirect employees to records tab if they try to access restricted tabs
  // Note: employees now have access to users tab for user management
  useEffect(() => {
    if (user?.role === 'employee' && activeTab === 'activities') {
      setActiveTab('records');
    }
  }, [user?.role, activeTab]);
  const [records, setRecords] = useState<CollectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  // Optimize items per page for mobile
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    return window.innerWidth <= 768 ? 10 : 10;
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [allRecords, setAllRecords] = useState<CollectionRecord[]>([]);
  
  // Real-time updates
  const realtimeSubscription = useRef<any>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const lastRecordCount = useRef<number>(0);
  const [filters, setFilters] = useState<FilterState>({
    subscriber_name: '',
    account_number: '',
    meter_number: '',
    region: '',
    status: '',
    // الترميز الجديد
    new_zone: '',
    new_block: '',
    // التدقيق
    verification_status: '',
    // فلاتر إضافية
    category: '',
    phase: ''
  });
  const [allRecordsStats, setAllRecordsStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    verified: 0,
    refused: 0,
    locked: 0
  });
  const [fieldAgentsCount, setFieldAgentsCount] = useState(0);

  // Keep latest filters in a ref to avoid stale closures inside realtime/polling callbacks
  const filtersRef = useRef<FilterState>({
    subscriber_name: '',
    account_number: '',
    meter_number: '',
    region: '',
    status: '',
    new_zone: '',
    new_block: '',
    verification_status: '',
    category: '',
    phase: ''
  });

  // Sync filtersRef whenever filters state changes
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Load records on component mount
  useEffect(() => {
    loadRecords();
    loadFieldAgentsCount();
  }, [currentPage, itemsPerPage, filters]);

  // Load data only when tab is active (for mobile performance)
  useEffect(() => {
    if (activeTab === 'records') {
      loadRecords();
    }
  }, [activeTab]);

  // Setup real-time subscription when component mounts
  useEffect(() => {
    if (user && dbOperations.supabase) {
      setupRealtimeSubscription(); // Re-enabled for new records detection
      
      // Start polling as fallback immediately
      startPolling();
    }

    // Cleanup on unmount
    return () => {
      if (realtimeSubscription.current && dbOperations.supabase) {
        dbOperations.supabase.removeChannel(realtimeSubscription.current);
      }
      stopPolling();
    };
  }, [user]);

  // تحديث حالة القفل محلياً دون إعادة تحميل التاب
  const updateRecordLockStatus = (recordId: string, updates: Partial<CollectionRecord>) => {
    setRecords(prevRecords => 
      prevRecords.map(record => 
        record.id === recordId 
          ? { ...record, ...updates }
          : record
      )
    );
    console.log('Record lock status updated locally without page refresh');
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      // Check if mobile device for optimized loading
      const isMobile = window.innerWidth <= 768;
      
      if (isMobile) {
        // For mobile: load only essential data first
        const recordsResult = await dbOperations.getRecordsWithPagination(currentPage, itemsPerPage, filters);
        setRecords(recordsResult.data);
        setTotalRecords(recordsResult.total);
        setTotalPages(recordsResult.totalPages);
        
        // Load stats and all records in background
        Promise.all([
          dbOperations.getRecordsStats(),
          dbOperations.getRecords()
        ]).then(([statsResult, allRecordsResult]) => {
          // حساب السجلات المقفلة
          const lockedCount = allRecordsResult.filter(record => record.locked_by).length;
          setAllRecordsStats({
            ...statsResult,
            locked: lockedCount
          });
          setAllRecords(allRecordsResult);
        }).catch(error => {
          console.warn('Background data loading failed:', error);
        });
      } else {
        // For desktop: load all data in parallel
        const [recordsResult, statsResult, allRecordsResult] = await Promise.all([
          dbOperations.getRecordsWithPagination(currentPage, itemsPerPage, filters),
          dbOperations.getRecordsStats(),
          dbOperations.getRecords()
        ]);
        
        setRecords(recordsResult.data);
        setTotalRecords(recordsResult.total);
        setTotalPages(recordsResult.totalPages);
        setAllRecords(allRecordsResult);
        
        // حساب السجلات المقفلة
        const lockedCount = allRecordsResult.filter(record => record.locked_by).length;
        setAllRecordsStats({
          ...statsResult,
          locked: lockedCount
        });
        
        // Update last record count for polling
        lastRecordCount.current = recordsResult.total;
      }
    } catch (error) {
      console.error('Error loading records:', error);
      addNotification({
        type: 'error',
        title: 'خطأ في تحميل البيانات',
        message: error instanceof Error ? error.message : 'حدث خطأ أثناء تحميل سجلات الجباية'
      });
    } finally {
      setLoading(false);
    }
  };

  // Setup real-time subscription (re-enabled for new records detection)
  const setupRealtimeSubscription = () => {
    console.log('Setting up real-time subscription for new records detection...');
    
    if (!dbOperations.supabase) return;

    // Clean up existing subscription
    if (realtimeSubscription.current) {
      dbOperations.supabase?.removeChannel(realtimeSubscription.current);
    }

    console.log('Setting up real-time subscription for collection_records...');
    
    realtimeSubscription.current = dbOperations.supabase
      ?.channel('collection_records_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'collection_records' 
        }, 
        (payload: any) => {
          console.log('Real-time update received:', payload);
          
          if (payload.eventType === 'INSERT') {
            // New record added
            const newRecord = payload.new as CollectionRecord;
            
            // Check if the new record matches current filters
            const matchesFilters = checkRecordMatchesFilters(newRecord, filtersRef.current);
            
            if (matchesFilters) {
              addNotification({
                type: 'success',
                title: 'سجل جديد',
                message: `تم إضافة سجل جديد: ${newRecord.subscriber_name || 'غير محدد'}`
              });
              
              // Only refresh if record matches current filters
              loadRecords();
            }
            
            // Always refresh stats
            loadFieldAgentsCount();
          } else if (payload.eventType === 'UPDATE') {
            // Record updated - but skip if it's a verification update (to avoid conflicts with save button)
            const updatedRecord = payload.new as CollectionRecord;
            const oldRecord = payload.old as CollectionRecord;
            
            // Check if this is a verification status update
            const isVerificationUpdate = 
              (updatedRecord.meter_photo_verified !== oldRecord.meter_photo_verified) ||
              (updatedRecord.invoice_photo_verified !== oldRecord.invoice_photo_verified) ||
              (updatedRecord.verification_status !== oldRecord.verification_status);
            
            // Check if this is a lock status update
            const isLockUpdate = 
              (updatedRecord.locked_by !== oldRecord.locked_by) ||
              (updatedRecord.locked_at !== oldRecord.locked_at);
            
            // Always refresh for lock updates to show lock status immediately
            if (isLockUpdate) {
              console.log('Lock status changed - updating lock status locally');
              
              // تحديث محلي لحالة القفل فقط - دون إعادة تحميل التاب
              updateRecordLockStatus(updatedRecord.id, {
                locked_by: updatedRecord.locked_by,
                locked_at: updatedRecord.locked_at
              });
            } else if (!isVerificationUpdate) {
              addNotification({
                type: 'info',
                title: 'تحديث سجل',
                message: `تم تحديث السجل: ${updatedRecord.subscriber_name || 'غير محدد'}`
              });
              
              // Refresh current page
              loadRecords();
            }
            
            // Always refresh stats
            loadFieldAgentsCount();
          } else if (payload.eventType === 'DELETE') {
            // Record deleted
            addNotification({
              type: 'warning',
              title: 'حذف سجل',
              message: 'تم حذف سجل من النظام'
            });
            
            // Refresh current page (respects current filters)
            loadRecords();
            // Refresh current page (respects current filters)
            loadRecords();
            
            // Also refresh stats
            loadFieldAgentsCount();
          }
        }
      )
      .subscribe((status: any) => {
        console.log('Real-time subscription status:', status);
        setIsRealtimeConnected(status === 'SUBSCRIBED');
        
        if (status === 'SUBSCRIBED') {
          addNotification({
            type: 'success',
            title: 'التحديثات المباشرة',
            message: 'تم تفعيل التحديثات المباشرة بنجاح'
          });
        } else if (status === 'CHANNEL_ERROR') {
          addNotification({
            type: 'error',
            title: 'خطأ في التحديثات',
            message: 'فشل في تفعيل التحديثات المباشرة'
          });
        }
      });
  };

  // Smart polling fallback for real-time updates (still active for new records)
  const startPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }

    console.log('Starting smart polling for new records...');
    pollingInterval.current = setInterval(async () => {
      try {
        // Use current filters for polling to avoid false positives and preserve UI state
        const result = await dbOperations.getRecordsWithPagination(1, 1, filtersRef.current);
        const currentCount = result.total;
        
        // If count increased, there's a new record
        if (currentCount > lastRecordCount.current && lastRecordCount.current > 0) {
          console.log('New record detected via polling! Count:', currentCount);
          
          // Get the latest record with current filters only
          const latestFiltered = await dbOperations.getRecordsWithPagination(1, 1, filtersRef.current);
          const latestRecord = latestFiltered.data[0];

          if (latestRecord) {
            // Notify only if the new record matches current filters
            addNotification({
              type: 'success',
              title: 'سجل جديد',
              message: `تم إضافة سجل جديد: ${latestRecord.subscriber_name || 'غير محدد'}`
            });

            // Refresh current data with current filters
            loadRecords();
            loadFieldAgentsCount();
          } else {
            // No matching record for current filters; skip notification and heavy refresh
            console.log('New record detected but does not match current filters - skipping UI refresh');
          }
        }

        lastRecordCount.current = currentCount;
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000); // Check every 2 seconds for faster response
  };

  const stopPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  };

  const loadFieldAgentsCount = async () => {
    try {
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        // For mobile: delay loading field agents count
        setTimeout(async () => {
          const users = await dbOperations.getUsers();
          const activeFieldAgents = users.filter(user => 
            user.role === 'field_agent' && 
            user.is_active && 
            !user.username.includes('(محذوف)')
          );
          setFieldAgentsCount(activeFieldAgents.length);
        }, 200);
      } else {
        // For desktop: load immediately
        const users = await dbOperations.getUsers();
        const activeFieldAgents = users.filter(user => 
          user.role === 'field_agent' && 
          user.is_active && 
          !user.username.includes('(محذوف)')
        );
        setFieldAgentsCount(activeFieldAgents.length);
      }
    } catch (error) {
      console.error('Error loading field agents count:', error);
    }
  };

  // Function to refresh field agents count (called from UserManagement)
  const refreshFieldAgentsCount = () => {
    loadFieldAgentsCount();
  };

  // Check if a record matches current filters
  const checkRecordMatchesFilters = (record: CollectionRecord, currentFilters: FilterState): boolean => {
    // Check status filter
    if (currentFilters.status) {
      if (currentFilters.status === 'refused') {
        if (!record.is_refused) return false;
      } else {
        if (record.status !== currentFilters.status || record.is_refused) return false;
      }
    }

    // Check other filters
    if (currentFilters.subscriber_name && 
        !record.subscriber_name?.toLowerCase().includes(currentFilters.subscriber_name.toLowerCase())) {
      return false;
    }

    if (currentFilters.account_number && 
        !record.account_number?.includes(currentFilters.account_number)) {
      return false;
    }

    if (currentFilters.meter_number && 
        !record.meter_number?.includes(currentFilters.meter_number)) {
      return false;
    }

    if (currentFilters.region && 
        !record.region?.toLowerCase().includes(currentFilters.region.toLowerCase())) {
      return false;
    }

    if (currentFilters.new_zone && record.new_zone !== currentFilters.new_zone) {
      return false;
    }

    if (currentFilters.new_block && record.new_block !== currentFilters.new_block) {
      return false;
    }

    if (currentFilters.verification_status && record.verification_status !== currentFilters.verification_status) {
      return false;
    }

    // صور مرفوضة
    if (currentFilters.rejected_photos === 'any') {
      if (!record.meter_photo_rejected && !record.invoice_photo_rejected) return false;
    }
    if (currentFilters.rejected_photos === 'none') {
      if (record.meter_photo_rejected || record.invoice_photo_rejected) return false;
    }

    if (currentFilters.category && record.category !== currentFilters.category) {
      return false;
    }

    if (currentFilters.phase && record.phase !== currentFilters.phase) {
      return false;
    }

    return true;
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleUpdateRecord = async (id: string, updates: Partial<CollectionRecord>) => {
    try {
      // Get original record for logging
      const originalRecord = records.find(record => record.id === id);
      
      // Convert updates to proper type
      const updateData: any = {};
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          updateData[key] = value;
        }
      });
      
      const success = await dbOperations.updateRecord(id, updateData);
      if (success) {
        // إلغاء قفل السجل بعد التحديث
        if (user) {
          try {
            await dbOperations.unlockRecord(id, user.id);
          } catch (error) {
            console.error('Error unlocking record after update:', error);
          }
        }

        // Log update activity
        if (user && originalRecord) {
          await dbOperations.createActivityLog({
            user_id: user.id,
            action: 'update_record',
            target_type: 'record',
            target_id: id,
            target_name: originalRecord.subscriber_name || originalRecord.account_number || 'سجل محدث',
            details: { 
              changes: updates,
              original_status: originalRecord.status,
              new_status: updates.status || originalRecord.status
            }
          });
        }
        
        // Update records locally instead of reloading all data
        setRecords(prevRecords => 
          prevRecords.map(record => 
            record.id === id ? { ...record, ...updates } : record
          )
        );
        
        // Update all records for stats
        setAllRecords(prevRecords => 
          prevRecords.map(record => 
            record.id === id ? { ...record, ...updates } : record
          )
        );
        
        // Update stats
        const newStats = await dbOperations.getRecordsStats();
        // حساب السجلات المقفلة
        const lockedCount = allRecords.filter(record => record.locked_by).length;
        setAllRecordsStats({
          ...newStats,
          locked: lockedCount
        });
        
        addNotification({
          type: 'success',
          title: 'تم التحديث بنجاح',
          message: 'تم حفظ التغييرات على السجل'
        });
      }
    } catch (error) {
      console.error('Error updating record:', error);
      addNotification({
        type: 'error',
        title: 'خطأ في التحديث',
        message: error instanceof Error ? error.message : 'حدث خطأ غير متوقع أثناء تحديث السجل'
      });
    }
  };

  const handleDeleteRecord = async (id: string) => {
    try {
      // Get record details before deletion for logging
      const recordToDelete = records.find(record => record.id === id);
      
      const success = await dbOperations.deleteRecord(id);
      if (success) {
        // Log deletion activity
        if (user && recordToDelete) {
          await dbOperations.createActivityLog({
            user_id: user.id,
            action: 'delete_record',
            target_type: 'record',
            target_id: id,
            target_name: recordToDelete.subscriber_name || recordToDelete.account_number || 'سجل محذوف',
            details: { 
              subscriber_name: recordToDelete.subscriber_name,
              account_number: recordToDelete.account_number,
              status: recordToDelete.status,
              is_refused: recordToDelete.is_refused
            }
          });
        }
        
        // Remove record locally instead of reloading all data
        setRecords(prevRecords => prevRecords.filter(record => record.id !== id));
        setAllRecords(prevRecords => prevRecords.filter(record => record.id !== id));
        
        // Update stats
        const newStats = await dbOperations.getRecordsStats();
        // حساب السجلات المقفلة
        const lockedCount = allRecords.filter(record => record.locked_by).length;
        setAllRecordsStats({
          ...newStats,
          locked: lockedCount
        });
        
        addNotification({
          type: 'success',
          title: 'تم الحذف بنجاح',
          message: `تم حذف سجل ${recordToDelete?.subscriber_name || recordToDelete?.account_number || 'السجل'} بنجاح`
        });
      }
    } catch (error) {
      console.error('Error deleting record:', error);
      addNotification({
        type: 'error',
        title: 'خطأ في الحذف',
        message: error instanceof Error ? error.message : 'حدث خطأ غير متوقع أثناء حذف السجل'
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300" dir="rtl">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white ml-2 sm:ml-4">
                <span className="hidden sm:inline">لوحة التحكم الإدارية</span>
                <span className="sm:hidden">لوحة التحكم</span>
              </h1>
              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">
                مرحباً، {user?.full_name}
              </span>
            </div>
            <div className="flex items-center space-x-4 sm:space-x-6 space-x-reverse">
              {/* Real-time connection indicator */}
              <div className="flex items-center space-x-2 sm:space-x-3 space-x-reverse">
                <div className={`w-2 h-2 rounded-full ${isRealtimeConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <span className="text-xs text-gray-600 dark:text-gray-400 hidden sm:block">
                  {isRealtimeConnected ? 'مباشر' : 'فحص دوري'}
                </span>
              </div>
              
              <button
                onClick={toggleTheme}
                className="p-1.5 sm:p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
                aria-label={isDark ? 'تبديل إلى الوضع النهاري' : 'تبديل إلى الوضع الليلي'}
              >
                {isDark ? (
                  <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                )}
              </button>
              <button
                onClick={logout}
                className="p-1.5 sm:p-2 rounded-lg bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                title="تسجيل الخروج"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 dark:text-red-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg ml-2 sm:ml-3">
                <Database className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">المجموع</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{allRecordsStats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg ml-2 sm:ml-3">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">قيد المراجعة</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{allRecordsStats.pending}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg ml-2 sm:ml-3">
                <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">مكتملة</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{allRecordsStats.completed}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg ml-2 sm:ml-3">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">امتناع</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{allRecordsStats.refused}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg ml-2 sm:ml-3">
                <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">مقفلة</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{allRecordsStats.locked}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-sm">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg ml-2 sm:ml-3">
                <UserCheck className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">المحصلين النشطين</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{fieldAgentsCount}</p>
              </div>
            </div>
          </div>
        </div>


        {/* Navigation Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-4 sm:mb-6">
          <nav className="flex flex-wrap space-x-4 sm:space-x-8 space-x-reverse px-2 sm:px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('records')}
              className={`py-2 sm:py-4 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors ${
                activeTab === 'records'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <Database className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
                <span className="hidden sm:inline">سجلات المشتركين</span>
                <span className="sm:hidden">السجلات</span>
              </div>
            </button>
            {(user?.role === 'admin' || user?.role === 'employee') && (
              <button
                onClick={() => setActiveTab('users')}
                className={`py-2 sm:py-4 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors ${
                  activeTab === 'users'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <Users className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
                  <span className="hidden sm:inline">إدارة المستخدمين</span>
                  <span className="sm:hidden">المستخدمين</span>
                </div>
              </button>
            )}
            <button
              onClick={() => setActiveTab('reports')}
              className={`py-2 sm:py-4 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors ${
                activeTab === 'reports'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <FileBarChart className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
                <span className="hidden sm:inline">التقارير</span>
                <span className="sm:hidden">التقارير</span>
              </div>
            </button>
            {user?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('activities')}
                className={`py-2 sm:py-4 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors ${
                  activeTab === 'activities'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
                  <span className="hidden sm:inline">الحركات</span>
                  <span className="sm:hidden">الحركات</span>
                </div>
              </button>
            )}
            {user?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('backup')}
                className={`py-2 sm:py-4 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm transition-colors ${
                  activeTab === 'backup'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <HardDrive className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
                  <span className="hidden sm:inline">النسخ الاحتياطي</span>
                  <span className="sm:hidden">النسخ</span>
                </div>
              </button>
            )}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'records' ? (
          <DataTable
            records={records}
            totalRecords={totalRecords}
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            loading={loading}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onUpdateRecord={handleUpdateRecord}
            onDeleteRecord={handleDeleteRecord}
            onRecordUpdate={updateRecordLockStatus}
          />
        ) : activeTab === 'users' ? (
          <UserManagement onUserStatusChange={refreshFieldAgentsCount} />
        ) : activeTab === 'reports' ? (
          <Reports records={allRecords} />
        ) : activeTab === 'activities' ? (
          <ActivityLogs />
        ) : (
          <BackupSystem />
        )}
      </div>
    </div>
  );
}