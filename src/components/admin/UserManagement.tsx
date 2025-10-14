import React, { useState } from 'react';
import { User } from '../../types';
import { dbOperations } from '../../lib/supabase';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Pagination } from '../common/Pagination';
import { UserPlus, CreditCard as Edit, Trash2, Eye, EyeOff, Save, X, Shield, Users, User as UserIcon, Calendar } from 'lucide-react';
import { formatDate } from '../../utils/dateFormatter';

interface UserManagementProps {
  onUserStatusChange?: () => void;
}

export function UserManagement({ onUserStatusChange }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'field_agent' as 'admin' | 'field_agent' | 'employee'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; userId: string; userName: string }>({
    isOpen: false,
    userId: '',
    userName: ''
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const { addNotification } = useNotifications();
  const { user: currentUser } = useAuth();

  // Load users on component mount
  React.useEffect(() => {
    loadUsers();
  }, []);

  // Pagination calculations
  const totalUsers = users.length;
  const totalPages = Math.ceil(totalUsers / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = users.slice(startIndex, endIndex);

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await dbOperations.getUsers();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
      addNotification({
        type: 'error',
        title: 'خطأ في تحميل البيانات',
        message: 'حدث خطأ أثناء تحميل قائمة المستخدمين'
      });
    } finally {
      setLoading(false);
    }
  };

  const validateUserData = (userData: any) => {
    if (!userData.username || userData.username.length < 3) {
      throw new Error('اسم المستخدم يجب أن يكون 3 أحرف على الأقل');
    }
    
    if (!userData.password || userData.password.length < 6) {
      throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    }
    
    if (!userData.full_name || userData.full_name.length < 2) {
      throw new Error('الاسم الكامل مطلوب');
    }
    
    return true;
  };

  const handleCreateUser = async () => {
    try {
      validateUserData(newUser);
      
      const userData = {
        username: newUser.username,
        password_hash: newUser.password,
        full_name: newUser.full_name,
        role: newUser.role,
        is_active: true
      };
      
      const result = await dbOperations.createUser(userData);
      if (result) {
        // Add new user locally instead of reloading all data
        setUsers(prevUsers => [result, ...prevUsers]);
        setNewUser({ username: '', password: '', full_name: '', role: 'field_agent' });
        setShowPassword(false);
        setShowCreateForm(false);
        
        // Log user creation activity
        const currentUser = dbOperations.getCurrentUser();
        if (currentUser) {
          await dbOperations.createActivityLog({
            user_id: currentUser.id,
            action: 'create_user',
            target_type: 'user',
            target_id: result.id,
            target_name: result.full_name,
            details: { username: result.username, role: result.role }
          });
        }
        
        addNotification({
          type: 'success',
          title: 'تم إنشاء المستخدم',
          message: `تم إنشاء المستخدم ${newUser.full_name} بنجاح`
        });

        // Refresh field agents count in dashboard if it's a field agent or employee
        if (onUserStatusChange && (newUser.role === 'field_agent' || newUser.role === 'employee')) {
          onUserStatusChange();
        }
      } else {
        addNotification({
          type: 'error',
          title: 'فشل في الإنشاء',
          message: 'حدث خطأ أثناء إنشاء المستخدم'
        });
      }
    } catch (error) {
      console.error('Error creating user:', error);
      addNotification({
        type: 'error',
        title: 'خطأ في الإنشاء',
        message: error instanceof Error ? error.message : 'حدث خطأ غير متوقع أثناء إنشاء المستخدم'
      });
    }
  };

  const handleEditUser = (user: User) => {
    // Prevent editing default admin
    if (user.id === '1') {
      addNotification({
        type: 'error',
        title: 'غير مسموح',
        message: 'لا يمكن تعديل حساب الأدمن الافتراضي'
      });
      return;
    }
    
    // صلاحيات الموظف: لا يمكن تعديل أي حساب لدور الموظف أو الأدمن
    if (currentUser?.role === 'employee' && (user.role === 'admin' || user.role === 'employee')) {
      addNotification({
        type: 'error',
        title: 'غير مسموح',
        message: 'لا يمكن للموظفين تعديل حسابات المديرين أو الموظفين الآخرين'
      });
      return;
    }
    
    setEditingUser(user);
    setNewUser({
      username: user.username,
      password: '',
      full_name: user.full_name,
      role: user.role
    });
  };

  const handleViewUser = (user: User) => {
    setViewingUser(user);
  };

  const handleUpdateUser = async () => {
    if (editingUser) {
      try {
        // صلاحيات الموظف: لا يمكن تغيير الدور إلى مدير أو موظف
        if (currentUser?.role === 'employee' && (newUser.role === 'admin' || newUser.role === 'employee')) {
          addNotification({
            type: 'error',
            title: 'غير مسموح',
            message: 'لا يمكن للموظفين تعيين دور مدير أو موظف للمستخدمين'
          });
          return;
        }
        
        const updates: Partial<User> = {
          username: newUser.username,
          full_name: newUser.full_name,
          role: newUser.role
        };
        
        // Only update password if provided
        if (newUser.password) {
          updates.password_hash = newUser.password; // In production, hash this properly
        }
        
        const success = await dbOperations.updateUser(editingUser.id, updates);
        if (success) {
          // Update user locally instead of reloading all data
          setUsers(prevUsers => 
            prevUsers.map(user => 
              user.id === editingUser.id ? { ...user, ...updates } : user
            )
          );
          setEditingUser(null);
          setNewUser({ username: '', password: '', full_name: '', role: 'field_agent' });
          setShowPassword(false);
          
          // Log user update activity
          const currentUser = dbOperations.getCurrentUser();
          if (currentUser) {
            await dbOperations.createActivityLog({
              user_id: currentUser.id,
              action: 'update_user',
              target_type: 'user',
              target_id: editingUser.id,
              target_name: editingUser.full_name,
              details: { changes: updates }
            });
          }
          
          addNotification({
            type: 'success',
            title: 'تم التحديث',
            message: `تم تحديث بيانات ${editingUser.full_name} بنجاح`
          });
        } else {
          addNotification({
            type: 'error',
            title: 'فشل في التحديث',
            message: 'حدث خطأ أثناء تحديث المستخدم'
          });
        }
      } catch (error) {
        console.error('Error updating user:', error);
        addNotification({
          type: 'error',
          title: 'خطأ في التحديث',
          message: 'حدث خطأ غير متوقع أثناء تحديث المستخدم'
        });
      }
    }
  };

  const handleDeleteUser = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (user) {
      // Prevent deleting default admin
      if (user.id === '1') {
        addNotification({
          type: 'error',
          title: 'غير مسموح',
          message: 'لا يمكن إلغاء تفعيل حساب الأدمن الافتراضي'
        });
        return;
      }
      
      // صلاحيات الموظف: لا يمكن حذف أو تعطيل حسابات الموظفين أو المديرين
      if (currentUser?.role === 'employee' && (user.role === 'admin' || user.role === 'employee')) {
        addNotification({
          type: 'error',
          title: 'غير مسموح',
          message: 'لا يمكن للموظفين حذف أو تعطيل حسابات المديرين أو الموظفين الآخرين'
        });
        return;
      }
      
      setDeleteConfirm({
        isOpen: true,
        userId: id,
        userName: user.full_name
      });
    }
  };

  const confirmDeleteUser = async () => {
    try {
      // Instead of deleting, mark user as deleted and update username
      const user = users.find(u => u.id === deleteConfirm.userId);
      if (!user) return;
      
      const updatedUsername = user.username.includes('(محذوف)') 
        ? user.username 
        : `${user.username} (محذوف)`;
      
      const success = await dbOperations.updateUser(deleteConfirm.userId, {
        is_active: false,
        username: updatedUsername
      });
      
      if (success) {
        // Update user locally instead of reloading all data
        setUsers(prevUsers => 
          prevUsers.map(user => 
            user.id === deleteConfirm.userId 
              ? { ...user, is_active: false, username: updatedUsername }
              : user
          )
        );
        
        // Log user deactivation activity
        const currentUser = dbOperations.getCurrentUser();
        if (currentUser && user) {
          await dbOperations.createActivityLog({
            user_id: currentUser.id,
            action: 'delete_user',
            target_type: 'user',
            target_id: user.id,
            target_name: user.full_name,
            details: { reason: 'deactivated', original_username: user.username }
          });
        }
        
        addNotification({
          type: 'success',
          title: 'تم إلغاء تفعيل المستخدم',
          message: `تم إلغاء تفعيل المستخدم ${deleteConfirm.userName} مع الحفاظ على البيانات المرتبطة به`
        });

        // Refresh field agents count in dashboard if it was a field agent or employee
        if (onUserStatusChange && user && (user.role === 'field_agent' || user.role === 'employee')) {
          onUserStatusChange();
        }
      } else {
        addNotification({
          type: 'error',
          title: 'فشل في إلغاء التفعيل',
          message: 'حدث خطأ أثناء إلغاء تفعيل المستخدم'
        });
      }
    } catch (error) {
      console.error('Error deactivating user:', error);
      addNotification({
        type: 'error',
        title: 'خطأ في إلغاء التفعيل',
        message: 'حدث خطأ غير متوقع أثناء إلغاء تفعيل المستخدم'
      });
    }
  };

  const toggleUserStatus = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (user) {
      try {
        const success = await dbOperations.updateUser(id, { is_active: !user.is_active });
        if (success) {
          // Update user status locally instead of reloading all data
          setUsers(prevUsers => 
            prevUsers.map(u => 
              u.id === id ? { ...u, is_active: !u.is_active } : u
            )
          );
          
          // Log user status toggle activity
          const currentUser = dbOperations.getCurrentUser();
          if (currentUser) {
            await dbOperations.createActivityLog({
              user_id: currentUser.id,
              action: 'toggle_user_status',
              target_type: 'user',
              target_id: id,
              target_name: user.full_name,
              details: { 
                previous_status: user.is_active,
                new_status: !user.is_active,
                action_type: user.is_active ? 'deactivate' : 'activate'
              }
            });
          }
          
          addNotification({
            type: 'success',
            title: user.is_active ? 'تم تعطيل المستخدم' : 'تم تفعيل المستخدم',
            message: `تم ${user.is_active ? 'تعطيل' : 'تفعيل'} ${user.full_name} بنجاح`
          });

          // Refresh field agents count in dashboard
          if (onUserStatusChange) {
            onUserStatusChange();
          }
        } else {
          addNotification({
            type: 'error',
            title: 'فشل في التغيير',
            message: 'حدث خطأ أثناء تغيير حالة المستخدم'
          });
        }
      } catch (error) {
        console.error('Error toggling user status:', error);
        addNotification({
          type: 'error',
          title: 'خطأ في التغيير',
          message: 'حدث خطأ غير متوقع أثناء تغيير حالة المستخدم'
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">جاري تحميل المستخدمين...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          إدارة المستخدمين
        </h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
        >
          <UserPlus className="w-4 h-4 ml-2" />
          إضافة مستخدم جديد
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  اسم المستخدم
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  الاسم الكامل
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  الدور
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  الحالة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  تاريخ الإنشاء
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <div className="flex items-center">
                      <span className={user.username.includes('(محذوف)') ? 'text-red-600 dark:text-red-400' : ''}>
                        {user.username.replace(' (محذوف)', '')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {user.full_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.role === 'admin' 
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    }`}>
                      {user.role === 'admin' ? (
                        <Shield className="w-3 h-3 ml-1" />
                      ) : (
                        <Users className="w-3 h-3 ml-1" />
                      )}
                      {user.role === 'admin' ? 'مدير' : user.role === 'employee' ? 'موظف' : 'محصل ميداني'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.username.includes('(محذوف)') ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                        <Trash2 className="w-3 h-3 ml-1" />
                        محذوف
                      </span>
                    ) : (
                      <button
                        onClick={() => toggleUserStatus(user.id)}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                          user.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800'
                        }`}
                      >
                        {user.is_active ? (
                          <Eye className="w-3 h-3 ml-1" />
                        ) : (
                          <EyeOff className="w-3 h-3 ml-1" />
                        )}
                        {user.is_active ? 'نشط' : 'معطل'}
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <button
                        onClick={() => handleViewUser(user)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        title="عرض"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditUser(user)}
                        disabled={
                          user.id === '1' || // Prevent editing default admin
                          (currentUser?.role === 'employee' && (user.role === 'admin' || user.role === 'employee')) // Prevent employees from editing admin or employee accounts
                        }
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={
                          user.id === '1' 
                            ? 'لا يمكن تعديل حساب الأدمن الافتراضي'
                            : (currentUser?.role === 'employee' && (user.role === 'admin' || user.role === 'employee'))
                              ? 'لا يمكن للموظفين تعديل حسابات المديرين أو الموظفين الآخرين'
                              : 'تعديل'
                        }
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={
                          user.id === '1' || 
                          (users.filter(u => u.role === 'admin').length === 1 && user.role === 'admin') ||
                          (currentUser?.role === 'employee' && (user.role === 'admin' || user.role === 'employee'))
                        }
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={
                          user.id === '1' 
                            ? 'لا يمكن إلغاء تفعيل حساب الأدمن الافتراضي' 
                            : users.filter(u => u.role === 'admin').length === 1 && user.role === 'admin' 
                              ? 'لا يمكن إلغاء تفعيل آخر مدير' 
                              : (currentUser?.role === 'employee' && (user.role === 'admin' || user.role === 'employee'))
                                ? 'لا يمكن للموظفين حذف أو تعطيل حسابات المديرين أو الموظفين الآخرين'
                                : 'إلغاء تفعيل'
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalUsers > 0 && (
          <div className="mt-6">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalUsers}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  إضافة مستخدم جديد
                </h3>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    اسم المستخدم
                  </label>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="أدخل اسم المستخدم"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    كلمة المرور
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="أدخل كلمة المرور"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    الاسم الكامل
                  </label>
                  <input
                    type="text"
                    value={newUser.full_name}
                    onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="أدخل الاسم الكامل"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    الدور
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="field_agent">محصل ميداني</option>
                    <option value="employee">موظف</option>
                    <option value="admin">مدير</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-2 space-x-reverse pt-4">
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleCreateUser}
                    disabled={!newUser.username || !newUser.password || !newUser.full_name}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center"
                  >
                    <UserPlus className="w-4 h-4 ml-2" />
                    إضافة المستخدم
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View User Modal */}
      {viewingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-4 space-x-reverse">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  تفاصيل المستخدم - {viewingUser.full_name}
                </h3>
                <span className={`px-2 py-1 rounded-full text-sm ${
                  viewingUser.role === 'admin' 
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                }`}>
                  {viewingUser.role === 'admin' ? 'مدير' : viewingUser.role === 'field_agent' ? 'محصل' : 'موظف'}
                </span>
              </div>
              <button
                onClick={() => setViewingUser(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">

              <div className="space-y-6">
                {/* Basic Information */}
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    <UserIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 ml-2" />
                    المعلومات الأساسية
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="border-b border-gray-100 dark:border-gray-700 pb-2">
                      <span className="text-gray-600 dark:text-gray-400 block text-xs">اسم المستخدم:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {viewingUser.username}
                      </p>
                    </div>
                    <div className="border-b border-gray-100 dark:border-gray-700 pb-2">
                      <span className="text-gray-600 dark:text-gray-400 block text-xs">الاسم الكامل:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {viewingUser.full_name}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Role Information */}
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400 ml-2" />
                    معلومات الدور
                  </h4>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      viewingUser.role === 'admin' 
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    }`}>
                      {viewingUser.role === 'admin' ? (
                        <Shield className="w-4 h-4 ml-1" />
                      ) : (
                        <Users className="w-4 h-4 ml-1" />
                      )}
                      {viewingUser.role === 'admin' ? 'مدير' : viewingUser.role === 'employee' ? 'موظف' : 'محصل ميداني'}
                    </span>
                  </div>
                </div>

                {/* Status Information */}
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    <Eye className="w-4 h-4 text-green-600 dark:text-green-400 ml-2" />
                    حالة المستخدم
                  </h4>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    {viewingUser.username.includes('(محذوف)') ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                        <Trash2 className="w-4 h-4 ml-1" />
                        محذوف
                      </span>
                    ) : (
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        viewingUser.is_active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {viewingUser.is_active ? (
                          <Eye className="w-4 h-4 ml-1" />
                        ) : (
                          <EyeOff className="w-4 h-4 ml-1" />
                        )}
                        {viewingUser.is_active ? 'نشط' : 'معطل'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Date Information */}
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    <Calendar className="w-4 h-4 text-orange-600 dark:text-orange-400 ml-2" />
                    معلومات التواريخ
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="border-b border-gray-100 dark:border-gray-700 pb-2">
                      <span className="text-gray-600 dark:text-gray-400 block text-xs">تاريخ الإنشاء:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {formatDate(viewingUser.created_at)}
                      </p>
                    </div>
                    <div className="border-b border-gray-100 dark:border-gray-700 pb-2">
                      <span className="text-gray-600 dark:text-gray-400 block text-xs">آخر تحديث:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {formatDate(viewingUser.updated_at)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => setViewingUser(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  تعديل المستخدم
                </h3>
                <button
                  onClick={() => setEditingUser(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    اسم المستخدم
                  </label>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="أدخل اسم المستخدم"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    كلمة المرور (اتركها فارغة لعدم التغيير)
                  </label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="كلمة مرور جديدة"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    الاسم الكامل
                  </label>
                  <input
                    type="text"
                    value={newUser.full_name}
                    onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="أدخل الاسم الكامل"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    الدور
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                    disabled={
                      editingUser.id === '1' || // Prevent changing admin role for default admin
                      (currentUser?.role === 'employee' && (editingUser.role === 'admin' || editingUser.role === 'employee')) // Prevent employees from changing admin or employee roles
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="field_agent">محصل ميداني</option>
                    <option value="employee">موظف</option>
                    {currentUser?.role === 'admin' && <option value="admin">مدير</option>}
                  </select>
                </div>

                <div className="flex justify-end space-x-2 space-x-reverse pt-4">
                  <button
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleUpdateUser}
                    disabled={!newUser.username || !newUser.full_name}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center"
                  >
                    <Save className="w-4 h-4 ml-2" />
                    حفظ التغييرات
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, userId: '', userName: '' })}
        onConfirm={confirmDeleteUser}
        title="تأكيد إلغاء تفعيل المستخدم"
        message={`هل أنت متأكد من إلغاء تفعيل المستخدم "${deleteConfirm.userName}"؟ سيتم الحفاظ على جميع البيانات المرتبطة به وسيظهر كمستخدم محذوف في السجلات.`}
        confirmText="إلغاء التفعيل"
        cancelText="إلغاء"
        type="warning"
      />
    </div>
  );
}