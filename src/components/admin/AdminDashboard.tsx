import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { DataTable } from './DataTable';
import { UserManagement } from './UserManagement';
import { Reports } from './Reports';
import { ActivityLogs } from './ActivityLogs';
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
  UserCheck
} from 'lucide-react';

export function AdminDashboard() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { addNotification } = useNotifications();
  
  const [activeTab, setActiveTab] = useState<'records' | 'users' | 'reports' | 'activities'>('records');

  // Redirect employee to records tab if they try to access restricted tabs
  useEffect(() => {
    if (user?.role === 'employee' && (activeTab === 'users' || activeTab === 'activities')) {
      setActiveTab('records');
    }
  }, [user?.role, activeTab]);
  const [records, setRecords] = useState<CollectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [allRecords, setAllRecords] = useState<CollectionRecord[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    subscriber_name: '',
    account_number: '',
    meter_number: '',
    address: '',
    status: ''
  });
  const [allRecordsStats, setAllRecordsStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    reviewed: 0,
    refused: 0
  });
  const [fieldAgentsCount, setFieldAgentsCount] = useState(0);

  // Load records on component mount
  useEffect(() => {
    loadRecords();
    loadFieldAgentsCount();
  }, [currentPage, itemsPerPage, filters]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      // Load records and stats in parallel for better performance
      const [recordsResult, statsResult, allRecordsResult] = await Promise.all([
        dbOperations.getRecordsWithPagination(currentPage, itemsPerPage, filters),
        dbOperations.getRecordsStats(),
        dbOperations.getRecords()
      ]);
      
      setRecords(recordsResult.data);
      setTotalRecords(recordsResult.total);
      setTotalPages(recordsResult.totalPages);
      setAllRecords(allRecordsResult);
      setAllRecordsStats(statsResult);
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

  const loadFieldAgentsCount = async () => {
    try {
      const users = await dbOperations.getUsers();
      const activeFieldAgents = users.filter(user => 
        (user.role === 'field_agent' || user.role === 'employee') && 
        user.is_active && 
        !user.username.includes('(محذوف)')
      );
      setFieldAgentsCount(activeFieldAgents.length);
    } catch (error) {
      console.error('Error loading field agents count:', error);
    }
  };

  // Function to refresh field agents count (called from UserManagement)
  const refreshFieldAgentsCount = () => {
    loadFieldAgentsCount();
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
        setAllRecordsStats(newStats);
        
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
        setAllRecordsStats(newStats);
        
        addNotification({
          type: 'success',
          title: 'تم الحذف بنجاح',
          message: 'تم حذف السجل بنجاح'
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white ml-4">
                لوحة التحكم الإدارية
              </h1>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                مرحباً، {user?.full_name}
              </span>
            </div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
                aria-label={isDark ? 'تبديل إلى الوضع النهاري' : 'تبديل إلى الوضع الليلي'}
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-600" />
                )}
              </button>
              <button
                onClick={logout}
                className="p-2 rounded-lg bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                title="تسجيل الخروج"
              >
                <LogOut className="w-5 h-5 text-red-600 dark:text-red-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg ml-3">
                <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">المجموع</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{allRecordsStats.total}</p>
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
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{allRecordsStats.pending}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg ml-3">
                <Camera className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">مكتملة</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{allRecordsStats.completed}</p>
              </div>
            </div>
          </div>


          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg ml-3">
                <FileText className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">امتناع</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{allRecordsStats.refused}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg ml-3">
                <UserCheck className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">المحصلين النشطين</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{fieldAgentsCount}</p>
              </div>
            </div>
          </div>
        </div>


        {/* Navigation Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6">
          <nav className="flex space-x-8 space-x-reverse px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('records')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'records'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <Database className="w-4 h-4 ml-2" />
                سجلات الجباية
              </div>
            </button>
            {user?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('users')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'users'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <Users className="w-4 h-4 ml-2" />
                  إدارة المستخدمين
                </div>
              </button>
            )}
            <button
              onClick={() => setActiveTab('reports')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'reports'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <FileBarChart className="w-4 h-4 ml-2" />
                التقارير
              </div>
            </button>
            {user?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('activities')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'activities'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <BarChart3 className="w-4 h-4 ml-2" />
                  الحركات
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
          />
        ) : activeTab === 'users' ? (
          <UserManagement onUserStatusChange={refreshFieldAgentsCount} />
        ) : activeTab === 'reports' ? (
          <Reports records={allRecords} />
        ) : (
          <ActivityLogs />
        )}
      </div>
    </div>
  );
}