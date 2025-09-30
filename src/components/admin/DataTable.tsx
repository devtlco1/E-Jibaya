import React, { useState } from 'react';
import { CollectionRecord, FilterState } from '../../types';
import { useNotifications } from '../../contexts/NotificationContext';
import { dbOperations } from '../../lib/supabase';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Pagination } from '../common/Pagination';
import { Eye, CreditCard as Edit, Trash2, MapPin, Camera, FileText, X, Save, ExternalLink, Filter, Search, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface DataTableProps {
  records: CollectionRecord[];
  totalRecords: number;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onUpdateRecord: (id: string, updates: Partial<CollectionRecord>) => void;
  onDeleteRecord: (id: string) => void;
}

export function DataTable({ 
  records, 
  totalRecords,
  currentPage,
  totalPages,
  itemsPerPage,
  loading,
  onPageChange,
  onItemsPerPageChange,
  filters, 
  onFiltersChange, 
  onUpdateRecord, 
  onDeleteRecord 
}: DataTableProps) {
  const [viewingRecord, setViewingRecord] = useState<CollectionRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<CollectionRecord | null>(null);
  const [editForm, setEditForm] = useState({
    subscriber_name: '',
    account_number: '',
    meter_number: '',
    address: '',
    last_reading: '',
    status: 'pending' as 'pending' | 'completed' | 'reviewed'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string } | null>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; recordId: string; recordName: string }>({
    isOpen: false,
    recordId: '',
    recordName: ''
  });
  const [users, setUsers] = useState<any[]>([]);

  const { addNotification } = useNotifications();

  // Load users for displaying names
  React.useEffect(() => {
    const loadUsers = async () => {
      try {
        const userData = await dbOperations.getUsers();
        setUsers(userData);
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };
    loadUsers();
  }, []);

  const getUserName = (userId: string | null) => {
    if (!userId) return 'غير محدد';
    const user = users.find(u => u.id === userId);
    if (!user) return 'مستخدم محذوف';
    
    // Check if user is marked as deleted
    if (user.username.includes('(محذوف)')) {
      return (
        <span className="flex items-center">
          <span className="text-red-600 dark:text-red-400">{user.full_name} (محذوف)</span>
        </span>
      );
    }
    
    return user.full_name;
  };
  const handleEdit = (record: CollectionRecord) => {
    setEditingRecord(record);
    setEditForm({
      subscriber_name: record.subscriber_name || '',
      account_number: record.account_number || '',
      meter_number: record.meter_number || '',
      address: record.address || '',
      last_reading: record.last_reading || '',
      status: record.status
    });
  };

  const handleSaveEdit = () => {
    if (editingRecord) {
      onUpdateRecord(editingRecord.id, {
        ...editForm,
        status: editForm.status,
        completed_by: editingRecord.completed_by // Keep existing completed_by or set it
      });
      addNotification({
        type: 'success',
        title: 'تم التحديث بنجاح',
        message: 'تم حفظ التغييرات على السجل'
      });
      setEditingRecord(null);
    }
  };

  const handleView = (record: CollectionRecord) => {
    setViewingRecord(record);
  };

  const handleDelete = (id: string) => {
    const record = records.find(r => r.id === id);
    const recordName = record?.subscriber_name || record?.account_number || 'السجل';
    
    setDeleteConfirm({
      isOpen: true,
      recordId: id,
      recordName
    });
  };

  const confirmDelete = () => {
    onDeleteRecord(deleteConfirm.recordId);
    addNotification({
      type: 'success',
      title: 'تم الحذف بنجاح',
      message: `تم حذف سجل ${deleteConfirm.recordName}`
    });
  };

  const handleImageClick = (url: string, title: string) => {
    setZoomedImage({ url, title });
    setImageZoom(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setImageZoom(prev => Math.min(prev * 1.5, 5));
  };

  const handleZoomOut = () => {
    setImageZoom(prev => Math.max(prev / 1.5, 0.5));
  };

  const handleResetZoom = () => {
    setImageZoom(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (imageZoom > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - imagePosition.x,
        y: e.clientY - imagePosition.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && imageZoom > 1) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'قيد المراجعة';
      case 'completed': return 'مكتمل';
      case 'reviewed': return 'تمت المراجعة';
      case 'refused': return 'امتنع';
      default: return status;
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
    return getStatusText(record.status);
  };
  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            <Filter className="w-4 h-4 ml-2" />
            {showFilters ? 'إخفاء المرشحات' : 'إظهار المرشحات'}
          </button>
        </div>
        
        {showFilters && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                اسم المشترك
              </label>
              <input
                type="text"
                value={filters.subscriber_name}
                onChange={(e) => onFiltersChange({ ...filters, subscriber_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                placeholder="البحث..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                رقم الحساب
              </label>
              <input
                type="text"
                value={filters.account_number}
                onChange={(e) => onFiltersChange({ ...filters, account_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                placeholder="البحث..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                رقم المقياس
              </label>
              <input
                type="text"
                value={filters.meter_number}
                onChange={(e) => onFiltersChange({ ...filters, meter_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                placeholder="البحث..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                العنوان
              </label>
              <input
                type="text"
                value={filters.address}
                onChange={(e) => onFiltersChange({ ...filters, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                placeholder="البحث..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                الحالة
              </label>
              <select
                value={filters.status}
                onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
              >
                <option value="">جميع الحالات</option>
                <option value="pending">قيد المراجعة</option>
                <option value="completed">مكتمل</option>
                <option value="reviewed">تمت المراجعة</option>
                <option value="refused">امتنع</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  اسم المشترك
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  رقم الحساب
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  رقم المقياس
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  العنوان
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  آخر قراءة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  صورة المقياس
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  صورة الفاتورة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  الحالة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                // Show skeleton loading rows
                Array.from({ length: itemsPerPage }).map((_, index) => (
                  <tr key={`loading-${index}`} className="animate-pulse">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-20"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    لا توجد سجلات تطابق المرشحات المحددة
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white cursor-pointer"
                    onClick={() => handleEdit(record)}
                  >
                    {record.subscriber_name || (
                      <span className="text-gray-400 italic">غير محدد</span>
                    )}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white cursor-pointer"
                    onClick={() => handleEdit(record)}
                  >
                    {record.account_number || (
                      <span className="text-gray-400 italic">غير محدد</span>
                    )}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white cursor-pointer"
                    onClick={() => handleEdit(record)}
                  >
                    {record.meter_number || (
                      <span className="text-gray-400 italic">غير محدد</span>
                    )}
                  </td>
                  <td 
                    className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs truncate cursor-pointer"
                    onClick={() => handleEdit(record)}
                  >
                    {record.address || (
                      <span className="text-gray-400 italic">غير محدد</span>
                    )}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white cursor-pointer"
                    onClick={() => handleEdit(record)}
                  >
                    {record.last_reading || (
                      <span className="text-gray-400 italic">غير محدد</span>
                    )}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap cursor-pointer"
                    onClick={() => handleEdit(record)}
                  >
                    {record.meter_photo_url ? (
                      <div className="relative group">
                        <img 
                          src={record.meter_photo_url} 
                          alt="صورة المقياس" 
                          className="w-12 h-12 object-cover rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleView(record);
                          }}
                        />
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          انقر للعرض
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic text-sm">لا توجد</span>
                    )}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap cursor-pointer"
                    onClick={() => handleEdit(record)}
                  >
                    {record.invoice_photo_url ? (
                      <div className="relative group">
                        <img 
                          src={record.invoice_photo_url} 
                          alt="صورة الفاتورة" 
                          className="w-12 h-12 object-cover rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleView(record);
                          }}
                        />
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          انقر للعرض
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic text-sm">لا توجد</span>
                    )}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap cursor-pointer"
                    onClick={() => handleEdit(record)}
                  >
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(getRecordStatus(record))}`}>
                      {getRecordStatusText(record)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleView(record);
                        }}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        title="عرض"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(record);
                        }}
                        className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                        title="تعديل"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {record.gps_latitude && record.gps_longitude && (
                        <a
                          href={`https://maps.google.com/?q=${record.gps_latitude},${record.gps_longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300"
                          title="عرض الموقع"
                        >
                          <MapPin className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(record.id);
                        }}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
          totalItems={totalRecords}
          itemsPerPage={itemsPerPage}
          onPageChange={onPageChange}
          onItemsPerPageChange={onItemsPerPageChange}
          loading={loading}
        />
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, recordId: '', recordName: '' })}
        onConfirm={confirmDelete}
        title="تأكيد الحذف"
        message={`هل أنت متأكد من حذف سجل "${deleteConfirm.recordName}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmText="حذف"
        cancelText="إلغاء"
        type="danger"
      />

      {/* View Modal */}
      {viewingRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  تفاصيل السجل
                </h3>
                <button
                  onClick={() => setViewingRecord(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Record Metadata */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">معلومات السجل</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">تاريخ الإنشاء:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {new Date(viewingRecord.submitted_at).toLocaleString('ar', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          calendar: 'gregory'
                        })}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">آخر تحديث:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {new Date(viewingRecord.updated_at).toLocaleString('ar', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          calendar: 'gregory'
                        })}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">تم الإنشاء بواسطة:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {getUserName(viewingRecord.field_agent_id)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">تم التعديل بواسطة:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {getUserName(viewingRecord.completed_by)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Customer Information */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-4">بيانات العميل</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">اسم المشترك:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {viewingRecord.subscriber_name || 'غير محدد'}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">رقم الحساب:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {viewingRecord.account_number || 'غير محدد'}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">رقم المقياس:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {viewingRecord.meter_number || 'غير محدد'}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">آخر قراءة:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {viewingRecord.last_reading || 'غير محدد'}
                      </p>
                    </div>
                  </div>
                  {viewingRecord.address && (
                    <div className="mt-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">العنوان:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {viewingRecord.address}
                      </p>
                    </div>
                  )}
                </div>

                {/* GPS Location */}
                {viewingRecord.gps_latitude && viewingRecord.gps_longitude && (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">الموقع الجغرافي</h4>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {viewingRecord.gps_latitude}, {viewingRecord.gps_longitude}
                      </span>
                      <a
                        href={`https://maps.google.com/?q=${viewingRecord.gps_latitude},${viewingRecord.gps_longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs hover:bg-blue-200 dark:hover:bg-blue-800"
                      >
                        <ExternalLink className="w-3 h-3 ml-1" />
                        عرض في الخريطة
                      </a>
                    </div>
                  </div>
                )}

                {/* Photos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {viewingRecord.meter_photo_url && (
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">صورة المقياس</h4>
                      <img 
                        src={viewingRecord.meter_photo_url} 
                        alt="صورة المقياس" 
                        className="w-full h-48 object-cover rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => handleImageClick(viewingRecord.meter_photo_url!, 'صورة المقياس')}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">انقر للتكبير</p>
                    </div>
                  )}

                  {viewingRecord.invoice_photo_url && (
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">صورة الفاتورة</h4>
                      <img 
                        src={viewingRecord.invoice_photo_url} 
                        alt="صورة الفاتورة" 
                        className="w-full h-48 object-cover rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => handleImageClick(viewingRecord.invoice_photo_url!, 'صورة الفاتورة')}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">انقر للتكبير</p>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {viewingRecord.notes && (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">الملاحظات</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                      {viewingRecord.notes}
                    </p>
                  </div>
                )}

                {/* Status */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">الحالة</h4>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(getRecordStatus(viewingRecord))}`}>
                      {getRecordStatusText(viewingRecord)}
                    </span>
                    {viewingRecord.is_refused && (
                      <span className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded">
                        امتنع العميل عن الدفع
                      </span>
                    )}
                  </div>
                </div>

                {/* Additional Actions */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex flex-wrap gap-2">
                    {viewingRecord.gps_latitude && viewingRecord.gps_longitude && (
                      <a
                        href={`https://maps.google.com/?q=${viewingRecord.gps_latitude},${viewingRecord.gps_longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg text-sm hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                      >
                        <MapPin className="w-4 h-4 ml-1" />
                        عرض الموقع في الخريطة
                      </a>
                    )}
                    <button
                      onClick={() => {
                        setViewingRecord(null);
                        handleEdit(viewingRecord);
                      }}
                      className="inline-flex items-center px-3 py-2 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-lg text-sm hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                    >
                      <Edit className="w-4 h-4 ml-1" />
                      تعديل السجل
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[100]">
          <div className="relative w-full h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-black bg-opacity-50">
              <h3 className="text-white font-medium">{zoomedImage.title}</h3>
              <div className="flex items-center space-x-2 space-x-reverse">
                <button
                  onClick={handleZoomOut}
                  className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-colors"
                  title="تصغير"
                >
                  <ZoomOut className="w-5 h-5" />
                </button>
                <button
                  onClick={handleResetZoom}
                  className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-colors"
                  title="إعادة تعيين"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                <button
                  onClick={handleZoomIn}
                  className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-colors"
                  title="تكبير"
                >
                  <ZoomIn className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setZoomedImage(null)}
                  className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-colors"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Image Container */}
            <div 
              className="flex-1 overflow-hidden relative cursor-move"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img
                src={zoomedImage.url}
                alt={zoomedImage.title}
                className="absolute top-1/2 left-1/2 max-w-none select-none"
                style={{
                  transform: `translate(calc(-50% + ${imagePosition.x}px), calc(-50% + ${imagePosition.y}px)) scale(${imageZoom})`,
                  cursor: imageZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                }}
                draggable={false}
              />
            </div>

            {/* Footer */}
            <div className="p-4 bg-black bg-opacity-50 text-center">
              <p className="text-white text-sm">
                {imageZoom > 1 ? 'اسحب الصورة للتنقل • ' : ''}
                التكبير: {Math.round(imageZoom * 100)}%
                {imageZoom > 1 && ' • استخدم عجلة الماوس للتكبير/التصغير'}
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  تعديل السجل
                </h3>
                <button
                  onClick={() => setEditingRecord(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Photos Section */}
              <div className="mb-6">
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">الصور المرفقة</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {editingRecord.meter_photo_url && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">صورة المقياس</h5>
                      <img 
                        src={editingRecord.meter_photo_url} 
                        alt="صورة المقياس" 
                        className="w-full h-64 object-cover rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => handleImageClick(editingRecord.meter_photo_url!, 'صورة المقياس')}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">انقر للتكبير</p>
                    </div>
                  )}

                  {editingRecord.invoice_photo_url && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">صورة الفاتورة</h5>
                      <img 
                        src={editingRecord.invoice_photo_url} 
                        alt="صورة الفاتورة" 
                        className="w-full h-64 object-cover rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => handleImageClick(editingRecord.invoice_photo_url!, 'صورة الفاتورة')}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">انقر للتكبير</p>
                    </div>
                  )}
                </div>
                
                {!editingRecord.meter_photo_url && !editingRecord.invoice_photo_url && (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">لا توجد صور مرفقة</p>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    اسم المشترك
                  </label>
                  <input
                    type="text"
                    value={editForm.subscriber_name}
                    onChange={(e) => setEditForm({ ...editForm, subscriber_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="أدخل اسم المشترك"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    رقم الحساب
                  </label>
                  <input
                    type="text"
                    value={editForm.account_number}
                    onChange={(e) => setEditForm({ ...editForm, account_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="أدخل رقم الحساب"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    رقم المقياس
                  </label>
                  <input
                    type="text"
                    value={editForm.meter_number}
                    onChange={(e) => setEditForm({ ...editForm, meter_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="أدخل رقم المقياس"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    العنوان
                  </label>
                  <textarea
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="أدخل العنوان"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    آخر قراءة
                  </label>
                  <input
                    type="text"
                    value={editForm.last_reading}
                    onChange={(e) => setEditForm({ ...editForm, last_reading: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="أدخل آخر قراءة"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    الحالة
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, status: 'pending' })}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        editForm.status === 'pending'
                          ? 'bg-yellow-500 text-white shadow-lg'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-800'
                      }`}
                    >
                      قيد المراجعة
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, status: 'completed' })}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        editForm.status === 'completed'
                          ? 'bg-green-500 text-white shadow-lg'
                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800'
                      }`}
                    >
                      مكتمل
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, status: 'refused' })}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        editForm.status === 'refused'
                          ? 'bg-red-500 text-white shadow-lg'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800'
                      }`}
                    >
                      امتنع
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, status: 'reviewed' })}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        editForm.status === 'reviewed'
                          ? 'bg-blue-500 text-white shadow-lg'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800'
                      }`}
                    >
                      تمت المراجعة
                    </button>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 space-x-reverse pt-4">
                  <button
                    onClick={() => setEditingRecord(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center"
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
    </div>
  );
}