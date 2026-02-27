import React, { useState } from 'react';
import { User } from '../../types';
import { dbOperations } from '../../lib/supabase';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Pagination } from '../common/Pagination';
import { UserPlus, CreditCard as Edit, Trash2, Eye, EyeOff, Save, X, Shield, Users, User as UserIcon, Calendar, UserCheck, UserX } from 'lucide-react';
import { formatDate } from '../../utils/dateFormatter';

interface UserManagementProps {
  onUserStatusChange?: () => void;
}

export function UserManagement({ onUserStatusChange }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'field_agent' as 'admin' | 'field_agent' | 'employee' | 'branch_manager'
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
  
  // Filter state
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Branch Manager Field Agents Management
  const [branchManagerFieldAgents, setBranchManagerFieldAgents] = useState<string[]>([]);
  const [loadingFieldAgents, setLoadingFieldAgents] = useState(false);
  const [showFieldAgentsModal, setShowFieldAgentsModal] = useState(false);
  const [selectedBranchManager, setSelectedBranchManager] = useState<User | null>(null);
  const [branchManagerEmployees, setBranchManagerEmployees] = useState<string[]>([]);

  const { addNotification } = useNotifications();
  const { user: currentUser } = useAuth();

  // المدير الأساسي (username: admin) - غير قابل للحذف أو التعطيل أو التعديل
  const isProtectedAdminUser = (user: User) =>
    user.username.replace(' (محذوف)', '') === 'admin' || user.id === '1';

  // Load users on component mount
  React.useEffect(() => {
    loadUsers();
  }, []);

  // Load field agents for branch manager
  const loadBranchManagerFieldAgents = async (branchManagerId: string) => {
    setLoadingFieldAgents(true);
    try {
      const [fieldAgentIds, employeeIds] = await Promise.all([
        dbOperations.getBranchManagerFieldAgents(branchManagerId),
        dbOperations.getBranchManagerEmployees(branchManagerId)
      ]);
      setBranchManagerFieldAgents(fieldAgentIds);
      setBranchManagerEmployees(employeeIds);
    } catch (error) {
      console.error('Error loading branch manager subordinates:', error);
      addNotification({
        type: 'error',
        title: 'خطأ في تحميل البيانات',
        message: 'حدث خطأ أثناء تحميل قائمة التابعين'
      });
    } finally {
      setLoadingFieldAgents(false);
    }
  };

  const handleManageFieldAgents = async (user: User) => {
    if (user.role !== 'branch_manager') return;
    setSelectedBranchManager(user);
    setShowFieldAgentsModal(true);
    await loadBranchManagerFieldAgents(user.id);
  };

  const handleAddFieldAgent = async (fieldAgentId: string) => {
    if (!selectedBranchManager) return;
    try {
      await dbOperations.addFieldAgentToBranchManager(
        selectedBranchManager.id,
        fieldAgentId,
        currentUser?.id
      );
      await loadBranchManagerFieldAgents(selectedBranchManager.id);
      addNotification({
        type: 'success',
        title: 'تمت الإضافة',
        message: 'تم إضافة المحصل الميداني بنجاح'
      });
    } catch (error) {
      console.error('Error adding field agent:', error);
      addNotification({
        type: 'error',
        title: 'خطأ في الإضافة',
        message: error instanceof Error ? error.message : 'حدث خطأ أثناء إضافة المحصل الميداني'
      });
    }
  };

  const handleAddEmployee = async (employeeId: string) => {
    if (!selectedBranchManager) return;
    try {
      await dbOperations.addEmployeeToBranchManager(
        selectedBranchManager.id,
        employeeId,
        currentUser?.id
      );
      await loadBranchManagerFieldAgents(selectedBranchManager.id);
      addNotification({
        type: 'success',
        title: 'تمت الإضافة',
        message: 'تم إضافة الموظف بنجاح'
      });
    } catch (error) {
      console.error('Error adding employee:', error);
      addNotification({
        type: 'error',
        title: 'خطأ في الإضافة',
        message: error instanceof Error ? error.message : 'حدث خطأ أثناء إضافة الموظف'
      });
    }
  };

  const handleRemoveEmployee = async (employeeId: string) => {
    if (!selectedBranchManager) return;
    try {
      await dbOperations.removeEmployeeFromBranchManager(selectedBranchManager.id, employeeId);
      await loadBranchManagerFieldAgents(selectedBranchManager.id);
      addNotification({
        type: 'success',
        title: 'تم الحذف',
        message: 'تم إزالة الموظف بنجاح'
      });
    } catch (error) {
      console.error('Error removing employee:', error);
      addNotification({
        type: 'error',
        title: 'خطأ في الحذف',
        message: error instanceof Error ? error.message : 'حدث خطأ أثناء إزالة الموظف'
      });
    }
  };

  const handleRemoveFieldAgent = async (fieldAgentId: string) => {
    if (!selectedBranchManager) return;
    try {
      await dbOperations.removeFieldAgentFromBranchManager(
        selectedBranchManager.id,
        fieldAgentId
      );
      await loadBranchManagerFieldAgents(selectedBranchManager.id);
      addNotification({
        type: 'success',
        title: 'تم الحذف',
        message: 'تم حذف المحصل الميداني بنجاح'
      });
    } catch (error) {
      console.error('Error removing field agent:', error);
      addNotification({
        type: 'error',
        title: 'خطأ في الحذف',
        message: error instanceof Error ? error.message : 'حدث خطأ أثناء حذف المحصل الميداني'
      });
    }
  };

  // Filter users based on role and status
  const filteredUsers = users.filter(user => {
    const roleMatch = !roleFilter || user.role === roleFilter;
    const statusMatch = !statusFilter || (
      statusFilter === 'active' ? user.is_active && !user.username.includes('(محذوف)') :
      statusFilter === 'inactive' ? !user.is_active && !user.username.includes('(محذوف)') :
      statusFilter === 'deleted' ? user.username.includes('(محذوف)') : true
    );
    return roleMatch && statusMatch;
  });

  // Pagination calculations
  const totalUsers = filteredUsers.length;
  const totalPages = Math.ceil(totalUsers / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  // Filter handlers
  const handleRoleFilterChange = (role: string) => {
    setRoleFilter(role);
    setCurrentPage(1); // Reset to first page when changing filters
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1); // Reset to first page when changing filters
  };

  const loadUsers = async () => {
    // تحميل في الخلفية بدون عرض حالة التحميل
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
      
      // صلاحيات الموظف: يمكن إنشاء محصل ميداني فقط
      if (currentUser?.role === 'employee' && newUser.role !== 'field_agent') {
        addNotification({
          type: 'error',
          title: 'غير مسموح',
          message: 'يمكن للموظفين إنشاء حسابات محصل ميداني فقط'
        });
        return;
      }
      
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
      
      // ترجمة رسالة الخطأ إلى العربية
      let errorMessage = 'حدث خطأ غير متوقع أثناء إنشاء المستخدم';
      
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('duplicate key') || errorMsg.includes('username_key') || errorMsg.includes('unique constraint')) {
          errorMessage = 'اسم المستخدم موجود مسبقاً. يرجى اختيار اسم مستخدم آخر';
        } else if (errorMsg.includes('فشل في إنشاء المستخدم')) {
          // إذا كانت الرسالة بالعربية بالفعل، استخدمها
          errorMessage = error.message;
        } else {
          errorMessage = error.message;
        }
      }
      
      addNotification({
        type: 'error',
        title: 'خطأ في الإنشاء',
        message: errorMessage
      });
    }
  };

  const handleEditUser = (user: User) => {
    // منع تعديل المدير الأساسي
    if (isProtectedAdminUser(user)) {
      addNotification({
        type: 'error',
        title: 'غير مسموح',
        message: 'لا يمكن تعديل حساب المدير الأساسي'
      });
      return;
    }
    
    // صلاحيات الموظف: يمكن تعديل حسابه الخاص فقط (كلمة المرور فقط)
    if (currentUser?.role === 'employee') {
      // إذا كان الموظف يحاول تعديل حسابه الخاص، اسمح له
      if (user.id === currentUser.id) {
        setEditingUser(user);
        setNewUser({
          username: user.username,
          password: '',
          full_name: user.full_name,
          role: user.role
        });
        return;
      }
      // إذا كان يحاول تعديل حساب آخر (موظف أو مدير)، امنعه
      if (user.role === 'admin' || user.role === 'employee') {
        addNotification({
          type: 'error',
          title: 'غير مسموح',
          message: 'لا يمكن للموظفين تعديل حسابات المديرين أو الموظفين الآخرين'
        });
        return;
      }
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
      if (isProtectedAdminUser(editingUser)) {
        addNotification({
          type: 'error',
          title: 'غير مسموح',
          message: 'لا يمكن تعديل حساب المدير الأساسي'
        });
        return;
      }
      try {
        // صلاحيات الموظف: إذا كان الموظف يعدل حسابه الخاص، يمكنه تغيير كلمة المرور فقط
        if (currentUser?.role === 'employee' && editingUser.id === currentUser.id) {
          const updates: Partial<User> = {};
          
          // فقط كلمة المرور يمكن تغييرها
          if (newUser.password) {
            updates.password_hash = newUser.password;
          } else {
            addNotification({
              type: 'warning',
              title: 'تحذير',
              message: 'يرجى إدخال كلمة مرور جديدة'
            });
            return;
          }
          
          const success = await dbOperations.updateUser(editingUser.id, updates);
          if (success) {
            setUsers(prevUsers => 
              prevUsers.map(user => 
                user.id === editingUser.id ? { ...user, ...updates } : user
              )
            );
            setEditingUser(null);
            setNewUser({ username: '', password: '', full_name: '', role: 'field_agent' });
            setShowPassword(false);
            
            const currentUser = dbOperations.getCurrentUser();
            if (currentUser) {
              await dbOperations.createActivityLog({
                user_id: currentUser.id,
                action: 'update_user',
                target_type: 'user',
                target_id: editingUser.id,
                target_name: editingUser.full_name,
                details: { changes: 'password updated' }
              });
            }
            
            addNotification({
              type: 'success',
              title: 'تم التحديث',
              message: 'تم تحديث كلمة المرور بنجاح'
            });
          } else {
            addNotification({
              type: 'error',
              title: 'فشل في التحديث',
              message: 'حدث خطأ أثناء تحديث كلمة المرور'
            });
          }
          return;
        }
        
        // صلاحيات الموظف: لا يمكن تغيير الدور إلى مدير أو موظف
        if (currentUser?.role === 'employee' && (newUser.role === 'admin' || newUser.role === 'employee')) {
          addNotification({
            type: 'error',
            title: 'غير مسموح',
            message: 'لا يمكن للموظفين تعيين دور مدير أو موظف للمستخدمين'
          });
          return;
        }
        
        // صلاحيات الموظف: لا يمكن تغيير دور المحصل الميداني إلى أي دور آخر
        if (currentUser?.role === 'employee' && editingUser.role === 'field_agent' && newUser.role !== 'field_agent') {
          addNotification({
            type: 'error',
            title: 'غير مسموح',
            message: 'لا يمكن للموظفين تغيير دور المحصل الميداني'
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
      // منع حذف/تعطيل المدير الأساسي
      if (isProtectedAdminUser(user)) {
        addNotification({
          type: 'error',
          title: 'غير مسموح',
          message: 'لا يمكن حذف أو تعطيل حساب المدير الأساسي'
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
      if (isProtectedAdminUser(user)) {
        addNotification({
          type: 'error',
          title: 'غير مسموح',
          message: 'لا يمكن حذف أو تعطيل حساب المدير الأساسي'
        });
        setDeleteConfirm({ isOpen: false, userId: '', userName: '' });
        return;
      }
      
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
      // منع تعطيل المدير الأساسي
      if (isProtectedAdminUser(user)) {
        addNotification({
          type: 'error',
          title: 'غير مسموح',
          message: 'لا يمكن تعطيل حساب المدير الأساسي'
        });
        return;
      }
      // صلاحيات الموظف: يمكن تعطيل/تفعيل المحصل الميداني فقط
      if (currentUser?.role === 'employee' && (user.role === 'admin' || user.role === 'employee')) {
        addNotification({
          type: 'error',
          title: 'غير مسموح',
          message: 'يمكن للموظفين تعطيل/تفعيل حسابات المحصلين الميدانيين فقط'
        });
        return;
      }
      
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          إدارة المستخدمين
        </h2>
        <button
          onClick={() => {
            setNewUser({ username: '', password: '', full_name: '', role: currentUser?.role === 'employee' ? 'field_agent' : 'field_agent' });
            setShowCreateForm(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
        >
          <UserPlus className="w-4 h-4 ml-2" />
          إضافة مستخدم جديد
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Role Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              الدور
            </label>
            <select
              value={roleFilter}
              onChange={(e) => handleRoleFilterChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="">جميع الأدوار</option>
              <option value="admin">مدير</option>
              <option value="employee">موظف</option>
              <option value="branch_manager">مدير فرع</option>
              <option value="field_agent">محصل ميداني</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              الحالة
            </label>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="">جميع الحالات</option>
              <option value="active">نشط</option>
              <option value="inactive">معطل</option>
              <option value="deleted">محذوف</option>
            </select>
          </div>
        </div>
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
                      {user.role === 'admin' ? 'مدير' : user.role === 'employee' ? 'موظف' : user.role === 'branch_manager' ? 'مدير فرع' : 'محصل ميداني'}
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
                        disabled={
                          isProtectedAdminUser(user) ||
                          (currentUser?.role === 'employee' && (user.role === 'admin' || user.role === 'employee'))
                        }
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                          user.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={
                          isProtectedAdminUser(user)
                            ? 'لا يمكن تعطيل المدير الأساسي'
                            : (currentUser?.role === 'employee' && (user.role === 'admin' || user.role === 'employee'))
                              ? 'يمكن للموظفين تعطيل/تفعيل حسابات المحصلين الميدانيين فقط'
                              : user.is_active ? 'تعطيل' : 'تفعيل'
                        }
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
                          isProtectedAdminUser(user) ||
                          (currentUser?.role === 'employee' && user.id !== currentUser.id && (user.role === 'admin' || user.role === 'employee'))
                        }
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={
                          isProtectedAdminUser(user)
                            ? 'لا يمكن تعديل المدير الأساسي'
                            : (currentUser?.role === 'employee' && user.id !== currentUser.id && (user.role === 'admin' || user.role === 'employee'))
                              ? 'لا يمكن للموظفين تعديل حسابات المديرين أو الموظفين الآخرين'
                              : (currentUser?.role === 'employee' && user.id === currentUser.id)
                                ? 'تعديل كلمة المرور'
                                : 'تعديل'
                        }
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {user.role === 'branch_manager' && (currentUser?.role === 'admin' || currentUser?.role === 'employee') && (
                        <button
                          onClick={() => handleManageFieldAgents(user)}
                          className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300"
                          title="إدارة التابعين (محصلين وموظفين)"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                      )}
                      {currentUser?.role !== 'employee' && (
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={
                            isProtectedAdminUser(user) ||
                            (users.filter(u => u.role === 'admin').length === 1 && user.role === 'admin')
                          }
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={
                            isProtectedAdminUser(user)
                              ? 'لا يمكن حذف أو تعطيل المدير الأساسي'
                              : users.filter(u => u.role === 'admin').length === 1 && user.role === 'admin'
                                ? 'لا يمكن إلغاء تفعيل آخر مدير'
                                : 'إلغاء تفعيل'
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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
                    disabled={currentUser?.role === 'employee'}
                  >
                    {currentUser?.role === 'employee' ? (
                      <option value="field_agent">محصل ميداني</option>
                    ) : (
                      <>
                        <option value="field_agent">محصل ميداني</option>
                        <option value="employee">موظف</option>
                        <option value="branch_manager">مدير فرع</option>
                        <option value="admin">مدير</option>
                      </>
                    )}
                  </select>
                  {currentUser?.role === 'employee' && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      يمكن للموظفين إنشاء حسابات محصل ميداني فقط
                    </p>
                  )}
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
              <div className="space-y-4">
                {/* المعلومات الأساسية */}
                <div className="bg-gradient-to-l from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-5 border border-blue-200 dark:border-blue-700">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center text-base">
                    <UserIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 ml-2" />
                    المعلومات الأساسية
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">اسم المستخدم</span>
                      <p className="text-gray-900 dark:text-white font-semibold">
                        {viewingUser.username}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">الاسم الكامل</span>
                      <p className="text-gray-900 dark:text-white font-semibold">
                        {viewingUser.full_name}
                      </p>
                    </div>
                  </div>
                </div>

                {/* معلومات الدور والحالة */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* معلومات الدور */}
                  <div className="bg-gradient-to-l from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-5 border border-purple-200 dark:border-purple-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center text-base">
                      <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400 ml-2" />
                      معلومات الدور
                    </h4>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
                      <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-semibold ${
                        viewingUser.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                          : viewingUser.role === 'branch_manager'
                          ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                          : viewingUser.role === 'employee'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      }`}>
                        {viewingUser.role === 'admin' ? (
                          <Shield className="w-4 h-4 ml-1" />
                        ) : (
                          <Users className="w-4 h-4 ml-1" />
                        )}
                        {viewingUser.role === 'admin' ? 'مدير' : 
                         viewingUser.role === 'branch_manager' ? 'مدير فرع' :
                         viewingUser.role === 'employee' ? 'موظف' : 'محصل ميداني'}
                      </span>
                    </div>
                  </div>

                  {/* حالة المستخدم */}
                  <div className="bg-gradient-to-l from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-5 border border-green-200 dark:border-green-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center text-base">
                      <Eye className="w-5 h-5 text-green-600 dark:text-green-400 ml-2" />
                      حالة المستخدم
                    </h4>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-700">
                      {viewingUser.username.includes('(محذوف)') ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-semibold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          <Trash2 className="w-4 h-4 ml-1" />
                          محذوف
                        </span>
                      ) : (
                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-semibold ${
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
                </div>

                {/* معلومات التواريخ */}
                <div className="bg-gradient-to-l from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-5 border border-orange-200 dark:border-orange-700">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center text-base">
                    <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400 ml-2" />
                    معلومات التواريخ
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-orange-200 dark:border-orange-700">
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">تاريخ الإنشاء</span>
                      <p className="text-gray-900 dark:text-white font-semibold text-sm">
                        {formatDate(viewingUser.created_at)}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-orange-200 dark:border-orange-700">
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">آخر تحديث</span>
                      <p className="text-gray-900 dark:text-white font-semibold text-sm">
                        {formatDate(viewingUser.updated_at)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* زر الإغلاق */}
                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => setViewingUser(null)}
                    className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
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
                {currentUser?.role === 'employee' && editingUser.id === currentUser.id && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      يمكنك تغيير كلمة المرور فقط
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    اسم المستخدم
                  </label>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    disabled={currentUser?.role === 'employee' && editingUser.id === currentUser.id}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="أدخل اسم المستخدم"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {currentUser?.role === 'employee' && editingUser.id === currentUser.id 
                      ? 'كلمة المرور الجديدة' 
                      : 'كلمة المرور (اتركها فارغة لعدم التغيير)'}
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
                    disabled={currentUser?.role === 'employee' && editingUser.id === currentUser.id}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
                      editingUser && isProtectedAdminUser(editingUser) ||
                      (currentUser?.role === 'employee' && editingUser.id === currentUser.id) || // Prevent employees from changing their own role
                      (currentUser?.role === 'employee' && (editingUser.role === 'admin' || editingUser.role === 'employee')) || // Prevent employees from changing admin or employee roles
                      (currentUser?.role === 'employee' && editingUser.role === 'field_agent') // Prevent employees from changing field agent role
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {currentUser?.role === 'employee' && editingUser.role === 'field_agent' ? (
                      <option value="field_agent">محصل ميداني</option>
                    ) : (
                      <>
                        <option value="field_agent">محصل ميداني</option>
                        <option value="employee">موظف</option>
                        <option value="branch_manager">مدير فرع</option>
                        {currentUser?.role === 'admin' && <option value="admin">مدير</option>}
                      </>
                    )}
                  </select>
                  {currentUser?.role === 'employee' && editingUser.role === 'field_agent' && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      لا يمكن للموظفين تغيير دور المحصل الميداني
                    </p>
                  )}
                  {currentUser?.role === 'employee' && editingUser.id === currentUser.id && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      لا يمكنك تغيير دورك
                    </p>
                  )}
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

      {/* Branch Manager Field Agents Management Modal */}
      {showFieldAgentsModal && selectedBranchManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  إدارة التابعين - {selectedBranchManager.full_name}
                </h3>
                <button
                  onClick={() => {
                    setShowFieldAgentsModal(false);
                    setSelectedBranchManager(null);
                    setBranchManagerFieldAgents([]);
                    setBranchManagerEmployees([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[calc(90vh-180px)] overflow-y-auto space-y-6">
              {/* المحصلين الميدانيين */}
              <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  المحصلين الميدانيين
                </h4>
                <div className="mb-4">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddFieldAgent(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    disabled={loadingFieldAgents}
                  >
                    <option value="">اختر محصل ميداني لإضافته</option>
                    {users
                      .filter(u => u.role === 'field_agent' && u.is_active && !branchManagerFieldAgents.includes(u.id))
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.full_name}</option>
                      ))}
                  </select>
                </div>
                {loadingFieldAgents ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">جاري التحميل...</p>
                  </div>
                ) : branchManagerFieldAgents.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
                    لا يوجد محصلين ميدانيين مرتبطين
                  </div>
                ) : (
                  <div className="space-y-2">
                    {branchManagerFieldAgents.map(fieldAgentId => {
                      const fieldAgent = users.find(u => u.id === fieldAgentId);
                      if (!fieldAgent) return null;
                      return (
                        <div
                          key={fieldAgentId}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <div className="flex items-center">
                            <UserIcon className="w-4 h-4 text-gray-500 dark:text-gray-400 ml-2" />
                            <span className="text-sm text-gray-900 dark:text-white">
                              {fieldAgent.full_name}
                            </span>
                            {!fieldAgent.is_active && (
                              <span className="mr-2 text-xs text-red-600 dark:text-red-400">
                                (معطل)
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveFieldAgent(fieldAgentId)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            title="حذف"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* الموظفين */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  الموظفين
                </h4>
                <div className="mb-4">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddEmployee(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    disabled={loadingFieldAgents}
                  >
                    <option value="">اختر موظف لإضافته</option>
                    {users
                      .filter(u => u.role === 'employee' && u.is_active && !branchManagerEmployees.includes(u.id))
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.full_name}</option>
                      ))}
                  </select>
                </div>
                {loadingFieldAgents ? (
                  <div className="text-center py-4">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </div>
                ) : branchManagerEmployees.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
                    لا يوجد موظفين مرتبطين
                  </div>
                ) : (
                  <div className="space-y-2">
                    {branchManagerEmployees.map(employeeId => {
                      const emp = users.find(u => u.id === employeeId);
                      if (!emp) return null;
                      return (
                        <div
                          key={employeeId}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <div className="flex items-center">
                            <UserIcon className="w-4 h-4 text-gray-500 dark:text-gray-400 ml-2" />
                            <span className="text-sm text-gray-900 dark:text-white">{emp.full_name}</span>
                            {!emp.is_active && (
                              <span className="mr-2 text-xs text-red-600 dark:text-red-400">(معطل)</span>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveEmployee(employeeId)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            title="حذف"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}