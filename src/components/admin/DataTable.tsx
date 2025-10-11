import React, { useState, useRef } from 'react';
import { CollectionRecord, FilterState } from '../../types';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { dbOperations } from '../../lib/supabase';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Pagination } from '../common/Pagination';
import { PhotoComparison } from './PhotoComparison';
import { LocationPopup } from './LocationPopup';
import { Eye, CreditCard as Edit, Trash2, MapPin, X, Save, ExternalLink, Filter, ZoomIn, ZoomOut, RotateCcw, Images, FileText, User, Camera, MessageSquare, Shield, Download, Maximize2 } from 'lucide-react';
import { formatDateTime } from '../../utils/dateFormatter';

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
    region: '',
    last_reading: '',
    status: 'pending' as 'pending' | 'completed' | 'refused',
    // الترميز الجديد
    new_zone: '',
    new_block: '',
    new_home: '',
    // الصنف
    category: null as 'منزلي' | 'تجاري' | 'صناعي' | 'زراعي' | 'حكومي' | 'انارة' | 'محولة خاصة' | null,
    // نوع المقياس
    phase: null as 'احادي' | 'ثلاثي' | 'سي تي' | null
  });
  const [showFilters, setShowFilters] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string } | null>(null);
  const [showPhotoComparison, setShowPhotoComparison] = useState(false);
  const [selectedRecordForPhotos, setSelectedRecordForPhotos] = useState<string | null>(null);
  const [showLocationPopup, setShowLocationPopup] = useState(false);
  const [selectedRecordForLocation, setSelectedRecordForLocation] = useState<string | null>(null);
  
  // Refs for image zoom
  const invoiceImageRef = useRef<HTMLImageElement>(null);
  const meterImageRef = useRef<HTMLImageElement>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [imageRotation, setImageRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; recordId: string; recordName: string }>({
    isOpen: false,
    recordId: '',
    recordName: ''
  });
  const [users, setUsers] = useState<any[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [availableZones, setAvailableZones] = useState<string[]>([]);
  const [availableBlocks, setAvailableBlocks] = useState<string[]>([]);

  const { addNotification } = useNotifications();
  const { user: currentUser } = useAuth();

  // Load users for displaying names
  React.useEffect(() => {
    const loadUsers = async () => {
      try {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
          // For mobile: load users in background with lower priority
          setTimeout(async () => {
            const userData = await dbOperations.getUsers();
            setUsers(userData);
          }, 100);
        } else {
          // For desktop: load immediately
          const userData = await dbOperations.getUsers();
          setUsers(userData);
        }
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };
    loadUsers();
  }, []);

  // Load available regions, zones, and blocks
  React.useEffect(() => {
    const loadAvailableData = async () => {
      try {
        // Get unique regions
        const regionsResult = await dbOperations.supabase
          ?.from('collection_records')
          .select('region')
          .not('region', 'is', null)
          .neq('region', '');
        
        if (regionsResult?.data) {
          const uniqueRegions = [...new Set(regionsResult.data.map(r => r.region).filter(Boolean))];
          setAvailableRegions(uniqueRegions);
        }

        // Get unique zones
        const zonesResult = await dbOperations.supabase
          ?.from('collection_records')
          .select('new_zone')
          .not('new_zone', 'is', null)
          .neq('new_zone', '');
        
        if (zonesResult?.data) {
          const uniqueZones = [...new Set(zonesResult.data.map(r => r.new_zone).filter(Boolean))];
          setAvailableZones(uniqueZones);
        }

        // Get blocks for selected zone
        if (filters.new_zone) {
          const blocksResult = await dbOperations.supabase
            ?.from('collection_records')
            .select('new_block')
            .eq('new_zone', filters.new_zone)
            .not('new_block', 'is', null)
            .neq('new_block', '');
          
          if (blocksResult?.data) {
            const uniqueBlocks = [...new Set(blocksResult.data.map(r => r.new_block).filter(Boolean))];
            setAvailableBlocks(uniqueBlocks);
          }
        } else {
          setAvailableBlocks([]);
        }
      } catch (error) {
        console.error('Error loading available data:', error);
      }
    };
    loadAvailableData();
  }, [filters.new_zone]);

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

  const exportRecordAsHTML = (record: CollectionRecord) => {
    const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>تفاصيل السجل - ${record.subscriber_name || 'غير محدد'}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.4;
            color: #333;
            background: white;
            margin: 0;
            padding: 0;
        }
        
        .container {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            background: white;
            padding: 10mm;
            box-sizing: border-box;
        }
        
        .header {
            background: #f8f9fa;
            color: #333;
            padding: 10px;
            text-align: center;
            margin-bottom: 10px;
            border: 1px solid #ddd;
        }
        
        .header h1 {
            font-size: 18px;
            margin-bottom: 5px;
            font-weight: 700;
        }
        
        .header .subtitle {
            font-size: 12px;
            color: #666;
        }
        
        .content {
            padding: 0;
            display: flex;
            flex-direction: column;
            height: calc(100vh - 100px);
        }
        
        .data-section {
            flex: 1;
            padding: 10px;
            border: 1px solid #ddd;
            margin-bottom: 10px;
        }
        
        .data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
        }
        
        .data-table td {
            padding: 3px 5px;
            border: 0.5px solid #ddd;
            vertical-align: top;
        }
        
        .data-table .label {
            background: #f5f5f5;
            font-weight: 600;
            width: 30%;
        }
        
        .data-table .value {
            background: white;
            width: 70%;
        }
        
        .coding-row {
            background: #e8f4fd !important;
        }
        
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .status-pending {
            background: #fef3c7;
            color: #92400e;
        }
        
        .status-completed {
            background: #d1fae5;
            color: #065f46;
        }
        
        .status-refused {
            background: #fee2e2;
            color: #991b1b;
        }
        
        .photos-section {
            flex: 1;
            padding: 10px;
            border: 1px solid #ddd;
        }
        
        .photos-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            height: 100%;
        }
        
        .photo-item {
            border: 1px solid #ddd;
            overflow: hidden;
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
        }
        
        .photo-header {
            background: #f5f5f5;
            padding: 5px;
            font-weight: 600;
            font-size: 10px;
            color: #333;
            text-align: center;
            border-bottom: 1px solid #ddd;
        }
        
        .photo-image {
            width: 100%;
            flex: 1;
            object-fit: cover;
            display: block;
        }
        
        .notes {
            background: #f5f5f5;
            padding: 5px;
            border: 1px solid #ddd;
            font-style: italic;
            font-size: 10px;
        }
        
        .footer {
            background: #f5f5f5;
            padding: 5px;
            text-align: center;
            color: #666;
            font-size: 9px;
            margin-top: 5px;
            border: 1px solid #ddd;
        }
        
        @media print {
            @page {
                size: A4;
                margin: 8mm;
            }
            
            body {
                background: white;
                padding: 0;
                margin: 0;
            }
            
            .container {
                width: 100%;
                min-height: 100vh;
                padding: 0;
                margin: 0;
                box-shadow: none;
                border-radius: 0;
            }
            
            .content {
                height: auto;
            }
            
            .data-section {
                page-break-inside: avoid;
                margin-bottom: 5px;
            }
            
            .photos-section {
                page-break-inside: avoid;
            }
            
            .photos-grid {
                page-break-inside: avoid;
            }
            
            .photo-item {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>تقرير المشترك</h1>
            <div class="subtitle">${record.subscriber_name || 'غير محدد'} - ${record.account_number || 'غير محدد'}</div>
        </div>
        
        <div class="content">
            <!-- البيانات -->
            <div class="data-section">
                <table class="data-table">
                    <tr>
                        <td class="label">اسم المشترك</td>
                        <td class="value">${record.subscriber_name || 'غير محدد'}</td>
                    </tr>
                    <tr>
                        <td class="label">رقم الحساب</td>
                        <td class="value">${record.account_number || 'غير محدد'}</td>
                    </tr>
                    <tr>
                        <td class="label">رقم المقياس</td>
                        <td class="value">${record.meter_number || 'غير محدد'}</td>
                    </tr>
                    <tr>
                        <td class="label">آخر قراءة</td>
                        <td class="value">${record.last_reading || 'غير محدد'}</td>
                    </tr>
                    <tr>
                        <td class="label">المنطقة</td>
                        <td class="value">${record.region || 'غير محدد'}</td>
                    </tr>
                    <tr class="coding-row">
                        <td class="label">الترميز الجديد</td>
                        <td class="value">${(() => {
                            const parts = [];
                            if (record.new_zone) parts.push(`زون ${record.new_zone}`);
                            if (record.new_block) parts.push(`بلوك ${record.new_block}`);
                            if (record.new_home) parts.push(`منزل ${record.new_home}`);
                            return parts.join(' ') || 'غير محدد';
                        })()}</td>
                    </tr>
                    <tr>
                        <td class="label">الموقع الجغرافي</td>
                        <td class="value">${(record.gps_latitude && record.gps_longitude) ? `${record.gps_latitude}, ${record.gps_longitude}` : 'غير محدد'}</td>
                    </tr>
                    <tr>
                        <td class="label">تاريخ الإنشاء</td>
                        <td class="value">${formatDateTime(record.submitted_at)}</td>
                    </tr>
                    <tr>
                        <td class="label">آخر تحديث</td>
                        <td class="value">${formatDateTime(record.updated_at)}</td>
                    </tr>
                    <tr>
                        <td class="label">تم الإنشاء بواسطة</td>
                        <td class="value">${getUserName(record.field_agent_id)}</td>
                    </tr>
                    <tr>
                        <td class="label">تم التعديل بواسطة</td>
                        <td class="value">${record.completed_by ? getUserName(record.completed_by) : 'لم يتم التعديل'}</td>
                    </tr>
                    <tr>
                        <td class="label">الحالة</td>
                        <td class="value">${record.status === 'refused' ? 'امتنع' : (record.status === 'pending' ? 'قيد المراجعة' : 'مكتمل')}</td>
                    </tr>
                    ${record.notes ? `
                    <tr>
                        <td class="label">الملاحظات</td>
                        <td class="value">${record.notes}</td>
                    </tr>
                    ` : ''}
                </table>
            </div>
            
            <!-- الصور -->
            ${(record.meter_photo_url || record.invoice_photo_url) ? `
            <div class="photos-section">
                <div class="photos-grid">
                    ${record.meter_photo_url ? `
                    <div class="photo-item">
                        <div class="photo-header">صورة المقياس</div>
                        <img src="${record.meter_photo_url}" alt="صورة المقياس" class="photo-image" />
                    </div>
                    ` : ''}
                    ${record.invoice_photo_url ? `
                    <div class="photo-item">
                        <div class="photo-header">صورة الفاتورة</div>
                        <img src="${record.invoice_photo_url}" alt="صورة الفاتورة" class="photo-image" />
                    </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}
        </div>
        
        <div class="footer">
            <p>تم إنشاء هذا التقرير في ${formatDateTime(new Date().toISOString())}</p>
            <p>نظام إدارة الجباية - E-Jibaya</p>
        </div>
    </div>
</body>
</html>`;

    // إنشاء ملف HTML وتحميله
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `سجل_${record.subscriber_name || 'غير_محدد'}_${record.account_number || 'غير_محدد'}_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleEdit = async (record: CollectionRecord) => {
    if (!currentUser) {
      addNotification({
        type: 'error',
        title: 'خطأ',
        message: 'يجب تسجيل الدخول أولاً'
      });
      return;
    }

    try {
      // التحقق من حالة القفل
      const lockStatus = await dbOperations.checkRecordLock(record.id);
      
      if (lockStatus.isLocked && lockStatus.lockedBy !== currentUser.id) {
        addNotification({
          type: 'error',
          title: 'السجل مقفل',
          message: 'هذا السجل مقفل حالياً من قبل مستخدم آخر'
        });
        return;
      }

      // قفل السجل
      await dbOperations.lockRecord(record.id, currentUser.id);
      
      setEditingRecord(record);
      setEditForm({
        subscriber_name: record.subscriber_name || '',
        account_number: record.account_number || '',
        meter_number: record.meter_number || '',
        region: record.region || '',
        last_reading: record.last_reading || '',
        status: getRecordStatus(record) as 'pending' | 'completed' | 'refused',
      // الترميز الجديد
      new_zone: record.new_zone || '',
      new_block: record.new_block || '',
      new_home: record.new_home || '',
      // الصنف
      category: record.category,
      // نوع المقياس
      phase: record.phase
      });

      addNotification({
        type: 'success',
        title: 'تم قفل السجل',
        message: 'يمكنك الآن تعديل السجل بأمان'
      });
    } catch (error) {
      console.error('Error locking record:', error);
      addNotification({
        type: 'error',
        title: 'خطأ في قفل السجل',
        message: error instanceof Error ? error.message : 'فشل في قفل السجل'
      });
    }
  };

  const handleSaveEdit = async () => {
    if (editingRecord && currentUser) {
      try {
        // Handle status and is_refused logic
        let updateData: any = {
          ...editForm,
          completed_by: currentUser.id || editingRecord.completed_by
        };

        // Handle status logic
        updateData.status = editForm.status;
        updateData.is_refused = false;
        
        await onUpdateRecord(editingRecord.id, updateData);
        
        // إلغاء قفل السجل بعد الحفظ
        await dbOperations.unlockRecord(editingRecord.id, currentUser.id);
        
        // Notification will be sent by AdminDashboard.handleUpdateRecord
        setEditingRecord(null);
      } catch (error) {
        console.error('Error saving record:', error);
        addNotification({
          type: 'error',
          title: 'خطأ في الحفظ',
          message: error instanceof Error ? error.message : 'فشل في حفظ التغييرات'
        });
      }
    }
  };

  const handleCancelEdit = async () => {
    if (editingRecord && currentUser) {
      try {
        // إلغاء قفل السجل عند إلغاء التعديل
        await dbOperations.unlockRecord(editingRecord.id, currentUser.id);
        
        addNotification({
          type: 'info',
          title: 'تم إلغاء التعديل',
          message: 'تم إلغاء قفل السجل'
        });
      } catch (error) {
        console.error('Error unlocking record:', error);
        addNotification({
          type: 'warning',
          title: 'تحذير',
          message: 'تم إلغاء التعديل لكن فشل في إلغاء القفل'
        });
      }
    }
    setEditingRecord(null);
  };

  const handleView = (record: CollectionRecord) => {
    setViewingRecord(record);
  };

  const handlePhotoComparison = (record: CollectionRecord) => {
    setSelectedRecordForPhotos(record.id);
    setShowPhotoComparison(true);
  };

  const handleRecordUpdate = (recordId: string, updates: Partial<CollectionRecord>) => {
    onUpdateRecord(recordId, updates);
  };

  const handleLocationView = (record: CollectionRecord) => {
    setSelectedRecordForLocation(record.id);
    setShowLocationPopup(true);
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
    setDeleteConfirm({ isOpen: false, recordId: '', recordName: '' });
  };

  const handleImageClick = (url: string, title: string) => {
    setZoomedImage({ url, title });
    setImageZoom(1);
    setImagePosition({ x: 0, y: 0 });
    setImageRotation(0);
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
    setImageRotation(0);
  };

  const handleRotateImage = () => {
    setImageRotation(prev => (prev + 90) % 360);
    // Reset position when rotating to avoid issues
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
      case 'refused': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'قيد المراجعة';
      case 'completed': return 'مكتمل';
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
            {showFilters ? 'إخفاء الفلاتر' : 'إظهار الفلاتر'}
          </button>
        </div>
        
        {showFilters && (
          <div className="p-4 space-y-4">
            {/* الصف الأول: اسم المشترك، رقم الحساب، رقم المقياس */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            </div>

            {/* الصف الثاني: المنطقة، الزون، البلوك */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  المنطقة
                </label>
                <select
                  value={filters.region}
                  onChange={(e) => onFiltersChange({ ...filters, region: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                >
                  <option value="">جميع المناطق</option>
                  {availableRegions.map(region => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  الزون
                </label>
                <select
                  value={filters.new_zone}
                  onChange={(e) => {
                    onFiltersChange({ ...filters, new_zone: e.target.value, new_block: '' });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                >
                  <option value="">جميع الزونات</option>
                  {availableZones.map(zone => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  البلوك
                </label>
                <select
                  value={filters.new_block}
                  onChange={(e) => onFiltersChange({ ...filters, new_block: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  disabled={!filters.new_zone}
                >
                  <option value="">جميع البلوكات</option>
                  {availableBlocks.map(block => (
                    <option key={block} value={block}>{block}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* الصف الثالث: الحالة، التدقيق، الصنف، نوع المقياس */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <option value="refused">امتنع</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  التدقيق
                </label>
                <select
                  value={filters.verification_status}
                  onChange={(e) => onFiltersChange({ ...filters, verification_status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                >
                  <option value="">جميع حالات التدقيق</option>
                  <option value="مدقق">مدقق</option>
                  <option value="غير مدقق">غير مدقق</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  الصنف
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => onFiltersChange({ ...filters, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  نوع المقياس
                </label>
                <select
                  value={filters.phase}
                  onChange={(e) => onFiltersChange({ ...filters, phase: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                >
                  <option value="">جميع الأنواع</option>
                  <option value="احادي">احادي</option>
                  <option value="ثلاثي">ثلاثي</option>
                  <option value="سي تي">سي تي</option>
                </select>
              </div>
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
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  اسم المشترك
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                  رقم الحساب
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                  رقم المقياس
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  المنطقة
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                  آخر قراءة
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  صورة المقياس
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  صورة الفاتورة
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  الحالة
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  القفل
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  التدقيق
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
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
                    لا توجد سجلات تطابق الفلاتر المحددة
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td 
                    className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white cursor-pointer"
                    onClick={() => handleEdit(record)}
                  >
                    <div className="flex flex-col">
                      <span>{record.subscriber_name || (
                        <span className="text-gray-400 italic">غير محدد</span>
                      )}</span>
                      <span className="text-xs text-gray-500 sm:hidden">
                        {record.account_number || 'غير محدد'}
                      </span>
                    </div>
                  </td>
                  <td 
                    className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white cursor-pointer hidden sm:table-cell"
                    onClick={() => handleEdit(record)}
                  >
                    {record.account_number || (
                      <span className="text-gray-400 italic">غير محدد</span>
                    )}
                  </td>
                  <td 
                    className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white cursor-pointer hidden md:table-cell"
                    onClick={() => handleEdit(record)}
                  >
                    {record.meter_number || (
                      <span className="text-gray-400 italic">غير محدد</span>
                    )}
                  </td>
                  <td 
                    className="px-3 sm:px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs truncate cursor-pointer hidden lg:table-cell"
                    onClick={() => handleEdit(record)}
                  >
                    {record.region || (
                      <span className="text-gray-400 italic">غير محدد</span>
                    )}
                  </td>
                  <td 
                    className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white cursor-pointer hidden md:table-cell"
                    onClick={() => handleEdit(record)}
                  >
                    {record.last_reading || (
                      <span className="text-gray-400 italic">غير محدد</span>
                    )}
                  </td>
                  <td 
                    className="px-3 sm:px-6 py-4 whitespace-nowrap cursor-pointer hidden lg:table-cell"
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
                    className="px-3 sm:px-6 py-4 whitespace-nowrap cursor-pointer hidden lg:table-cell"
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
                    className="px-3 sm:px-6 py-4 whitespace-nowrap cursor-pointer"
                    onClick={() => handleEdit(record)}
                  >
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(getRecordStatus(record))}`}>
                      {getRecordStatusText(record)}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {record.locked_by ? (
                      <div className="flex items-center space-x-1 space-x-reverse">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-red-600 dark:text-red-400">
                          مقفل
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1 space-x-reverse">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs text-green-600 dark:text-green-400">
                          متاح
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {record.verification_status ? (
                      <div className="flex items-center space-x-1 space-x-reverse">
                        <div className={`w-2 h-2 rounded-full ${
                          record.verification_status === 'مدقق' ? 'bg-green-500' : 'bg-yellow-500'
                        }`}></div>
                        <span className={`text-xs ${
                          record.verification_status === 'مدقق' 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-yellow-600 dark:text-yellow-400'
                        }`}>
                          {record.verification_status}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1 space-x-reverse">
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          غير محدد
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2 sm:space-x-3 space-x-reverse">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleView(record);
                        }}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-1"
                        title="عرض"
                      >
                        <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePhotoComparison(record);
                        }}
                        className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 p-1"
                        title="مقارنة الصور"
                      >
                        <Images className="w-3 h-3 sm:w-4 sm:h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(record);
                        }}
                        className={`p-1 ${
                          record.locked_by && record.locked_by !== currentUser?.id
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300'
                        }`}
                        title={
                          record.locked_by && record.locked_by !== currentUser?.id
                            ? 'السجل مقفل من قبل مستخدم آخر'
                            : 'تعديل'
                        }
                        disabled={!!(record.locked_by && record.locked_by !== currentUser?.id)}
                      >
                        <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                      </button>
                      {record.gps_latitude && record.gps_longitude && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLocationView(record);
                          }}
                          className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 p-1"
                          title="عرض المواقع"
                        >
                          <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
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
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-4 space-x-reverse">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  تفاصيل السجل - {viewingRecord.subscriber_name || 'غير محدد'}
                </h3>
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
                  {viewingRecord.account_number || 'غير محدد'}
                </span>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <button
                  onClick={() => exportRecordAsHTML(viewingRecord)}
                  className="flex items-center px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                  title="تصدير كملف HTML"
                >
                  <Download className="w-4 h-4 ml-1" />
                  تصدير HTML
                </button>
                <button
                  onClick={() => setViewingRecord(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">

              <div className="space-y-6">
                {/* Record Metadata */}
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 ml-2" />
                    معلومات السجل
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="border-b border-gray-100 dark:border-gray-700 pb-2">
                      <span className="text-gray-600 dark:text-gray-400 block text-xs">تاريخ الإنشاء:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {formatDateTime(viewingRecord.submitted_at)}
                      </p>
                    </div>
                    <div className="border-b border-gray-100 dark:border-gray-700 pb-2">
                      <span className="text-gray-600 dark:text-gray-400 block text-xs">آخر تحديث:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {formatDateTime(viewingRecord.updated_at)}
                      </p>
                    </div>
                    <div className="border-b border-gray-100 dark:border-gray-700 pb-2">
                      <span className="text-gray-600 dark:text-gray-400 block text-xs">تم الإنشاء بواسطة:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {getUserName(viewingRecord.field_agent_id)}
                      </p>
                    </div>
                    <div className="border-b border-gray-100 dark:border-gray-700 pb-2">
                      <span className="text-gray-600 dark:text-gray-400 block text-xs">تم التعديل بواسطة:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {viewingRecord.completed_by ? getUserName(viewingRecord.completed_by) : 
                         (viewingRecord.updated_at !== viewingRecord.submitted_at ? 
                          (currentUser ? `${currentUser.full_name}` : 'مستخدم غير محدد') : 
                          'لم يتم التعديل')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Customer Information */}
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    <User className="w-4 h-4 text-green-600 dark:text-green-400 ml-2" />
                    بيانات العميل
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border-b border-gray-100 dark:border-gray-700 pb-2">
                      <span className="text-gray-600 dark:text-gray-400 block text-xs">اسم المشترك:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {viewingRecord.subscriber_name || 'غير محدد'}
                      </p>
                    </div>
                    <div className="border-b border-gray-100 dark:border-gray-700 pb-2">
                      <span className="text-gray-600 dark:text-gray-400 block text-xs">رقم الحساب:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {viewingRecord.account_number || 'غير محدد'}
                      </p>
                    </div>
                    <div className="border-b border-gray-100 dark:border-gray-700 pb-2">
                      <span className="text-gray-600 dark:text-gray-400 block text-xs">رقم المقياس:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {viewingRecord.meter_number || 'غير محدد'}
                      </p>
                    </div>
                    <div className="border-b border-gray-100 dark:border-gray-700 pb-2">
                      <span className="text-gray-600 dark:text-gray-400 block text-xs">آخر قراءة:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {viewingRecord.last_reading || 'غير محدد'}
                      </p>
                    </div>
                  </div>
                  {viewingRecord.region && (
                    <div className="mt-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                      <span className="text-gray-600 dark:text-gray-400 block text-xs">المنطقة:</span>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {viewingRecord.region}
                      </p>
                    </div>
                  )}
                </div>

                {/* الترميز الجديد */}
                {(viewingRecord.new_zone || viewingRecord.new_block || viewingRecord.new_home) && (
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                      <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400 ml-2" />
                      الترميز الجديد
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      {viewingRecord.new_zone && (
                        <div className="border-b border-gray-100 dark:border-gray-700 pb-2">
                          <span className="text-gray-600 dark:text-gray-400 block text-xs">الزون:</span>
                          <p className="text-gray-900 dark:text-white font-medium">
                            {viewingRecord.new_zone}
                          </p>
                        </div>
                      )}
                      {viewingRecord.new_block && (
                        <div className="border-b border-gray-100 dark:border-gray-700 pb-2">
                          <span className="text-gray-600 dark:text-gray-400 block text-xs">البلوك:</span>
                          <p className="text-gray-900 dark:text-white font-medium">
                            {viewingRecord.new_block}
                          </p>
                        </div>
                      )}
                      {viewingRecord.new_home && (
                        <div className="border-b border-gray-100 dark:border-gray-700 pb-2">
                          <span className="text-gray-600 dark:text-gray-400 block text-xs">الهوم:</span>
                          <p className="text-gray-900 dark:text-white font-medium">
                            {viewingRecord.new_home}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* الصنف */}
                {viewingRecord.category && (
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                      <FileText className="w-4 h-4 text-orange-600 dark:text-orange-400 ml-2" />
                      الصنف
                    </h4>
                    <div className="flex items-center">
                      <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded-lg text-sm font-medium">
                        {viewingRecord.category}
                      </span>
                    </div>
                  </div>
                )}

                {/* نوع المقياس */}
                {viewingRecord.phase && (
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 ml-2" />
                      نوع المقياس
                    </h4>
                    <div className="flex items-center">
                      <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-lg text-sm font-medium">
                        {viewingRecord.phase}
                      </span>
                    </div>
                  </div>
                )}

                {/* GPS Location */}
                {viewingRecord.gps_latitude && viewingRecord.gps_longitude && (
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                      <MapPin className="w-4 h-4 text-red-600 dark:text-red-400 ml-2" />
                      الموقع الجغرافي
                    </h4>
                    <div className="flex items-center justify-between">
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
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    <Camera className="w-4 h-4 text-purple-600 dark:text-purple-400 ml-2" />
                    الصور المرفقة
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {viewingRecord.meter_photo_url && (
                      <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                        <h5 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">صورة المقياس</h5>
                        <img 
                          src={viewingRecord.meter_photo_url} 
                          alt="صورة المقياس" 
                          className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => handleImageClick(viewingRecord.meter_photo_url!, 'صورة المقياس')}
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">انقر للتكبير</p>
                      </div>
                    )}

                    {viewingRecord.invoice_photo_url && (
                      <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                        <h5 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">صورة الفاتورة</h5>
                        <img 
                          src={viewingRecord.invoice_photo_url} 
                          alt="صورة الفاتورة" 
                          className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => handleImageClick(viewingRecord.invoice_photo_url!, 'صورة الفاتورة')}
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">انقر للتكبير</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {viewingRecord.notes && (
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                      <MessageSquare className="w-4 h-4 text-orange-600 dark:text-orange-400 ml-2" />
                      الملاحظات
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                      {viewingRecord.notes}
                    </p>
                  </div>
                )}

                {/* Status */}
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400 ml-2" />
                    حالة السجل
                  </h4>
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
                  onClick={handleZoomIn}
                  className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-colors"
                  title="تكبير"
                >
                  <ZoomIn className="w-5 h-5" />
                </button>
                <button
                  onClick={handleRotateImage}
                  className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-colors"
                  title={`دوران (${imageRotation}°)`}
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                <button
                  onClick={handleResetZoom}
                  className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-colors"
                  title="إعادة تعيين"
                >
                  <Maximize2 className="w-5 h-5" />
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
                  transform: `translate(calc(-50% + ${imagePosition.x}px), calc(-50% + ${imagePosition.y}px)) rotate(${imageRotation}deg) scale(${imageZoom})`,
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
                {imageRotation !== 0 && ` • الدوران: ${imageRotation}°`}
                {imageZoom > 1 && ' • استخدم عجلة الماوس للتكبير/التصغير'}
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3 space-x-reverse">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  تعديل السجل - {editingRecord.subscriber_name || 'غير محدد'}
                </h3>
                <div className="flex items-center space-x-1 space-x-reverse">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                    مقفل لك
                  </span>
                </div>
              </div>
              <button
                onClick={handleCancelEdit}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content - Split Layout */}
            <div className="flex h-[calc(90vh-120px)]">
              {/* Right Side - Form */}
              <div className="w-1/2 p-6 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
                <div className="space-y-6">
                  {/* 1. بيانات صورة الفاتورة */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-4 flex items-center">
                      <FileText className="w-4 h-4 ml-2" />
                      بيانات صورة الفاتورة
                    </h4>
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
                          onChange={(e) => {
                            const value = e.target.value;
                            // Allow only numbers and limit to 12 digits
                            if (/^\d*$/.test(value) && value.length <= 12) {
                              setEditForm({ ...editForm, account_number: value });
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="أدخل رقم الحساب (حد أقصى 12 رقم)"
                          maxLength={12}
                        />
                        {editForm.account_number && editForm.account_number.length > 12 && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            الحد الأقصى لرقم الحساب هو 12 رقم
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          المنطقة
                        </label>
                        <input
                          type="text"
                          value={editForm.region}
                          onChange={(e) => setEditForm({ ...editForm, region: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="أدخل المنطقة"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. الصنف */}
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                    <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-200 mb-4 flex items-center">
                      <FileText className="w-4 h-4 ml-2" />
                      الصنف
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {['منزلي', 'تجاري', 'صناعي', 'زراعي', 'حكومي', 'انارة', 'محولة خاصة'].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setEditForm({ ...editForm, category: cat as any })}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            editForm.category === cat
                              ? 'bg-orange-500 text-white shadow-lg'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-orange-100 dark:hover:bg-orange-900/30'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. بيانات صورة المقياس */}
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-4 flex items-center">
                      <Camera className="w-4 h-4 ml-2" />
                      بيانات صورة المقياس
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          رقم المقياس
                        </label>
                        <input
                          type="text"
                          value={editForm.meter_number}
                          onChange={(e) => setEditForm({ ...editForm, meter_number: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                          placeholder="أدخل رقم المقياس"
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
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white"
                          placeholder="أدخل آخر قراءة"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. نوع المقياس */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-4 flex items-center">
                      <FileText className="w-4 h-4 ml-2" />
                      نوع المقياس
                    </h4>
                    <div className="flex gap-2">
                      {['احادي', 'ثلاثي', 'سي تي'].map((ph) => (
                        <button
                          key={ph}
                          type="button"
                          onClick={() => setEditForm({ ...editForm, phase: ph as any })}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            editForm.phase === ph
                              ? 'bg-blue-500 text-white shadow-lg'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                          }`}
                        >
                          {ph}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 5. الترميز الجديد */}
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                    <h4 className="text-sm font-semibold text-purple-800 dark:text-purple-200 mb-4 flex items-center">
                      <MapPin className="w-4 h-4 ml-2" />
                      الترميز الجديد
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          الزون
                        </label>
                        <input
                          type="text"
                          value={editForm.new_zone}
                          onChange={(e) => setEditForm({ ...editForm, new_zone: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
                          placeholder="أدخل الزون"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          البلوك
                        </label>
                        <input
                          type="text"
                          value={editForm.new_block}
                          onChange={(e) => setEditForm({ ...editForm, new_block: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
                          placeholder="أدخل البلوك"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          الهوم
                        </label>
                        <input
                          type="text"
                          value={editForm.new_home}
                          onChange={(e) => setEditForm({ ...editForm, new_home: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
                          placeholder="أدخل الهوم"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 6. حالة السجل */}
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                      <Shield className="w-4 h-4 ml-2" />
                      حالة السجل
                    </h4>
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
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end space-x-2 space-x-reverse pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleCancelEdit}
                    className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center"
                  >
                    <Save className="w-4 h-4 ml-2" />
                    حفظ التغييرات
                  </button>
                </div>
              </div>

              {/* Left Side - Photos with Internal Zoom */}
              <div className="w-1/2 p-6 overflow-y-auto">
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">الصور المرفقة</h4>
                
                {editingRecord.invoice_photo_url && (
                  <div className="mb-6">
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                      <FileText className="w-4 h-4 ml-2 text-green-600" />
                      صورة الفاتورة
                    </h5>
                    <div className="relative bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                      <img 
                        ref={invoiceImageRef}
                        src={editingRecord.invoice_photo_url} 
                        alt="صورة الفاتورة" 
                        className="w-full h-80 object-contain cursor-zoom-in transition-transform duration-200 hover:scale-105"
                        onClick={() => handleImageClick(editingRecord.invoice_photo_url!, 'صورة الفاتورة')}
                      />
                      <div className="absolute top-2 right-2 flex space-x-1 space-x-reverse">
                        <button
                          onClick={() => {
                            if (invoiceImageRef.current) {
                              const currentScale = invoiceImageRef.current.style.transform.includes('scale(1.5)') ? 1.5 : 1;
                              const newScale = currentScale === 1 ? 1.5 : 1;
                              invoiceImageRef.current.style.transform = `scale(${newScale})`;
                              invoiceImageRef.current.style.cursor = newScale === 1.5 ? 'zoom-out' : 'zoom-in';
                            }
                          }}
                          className="bg-black bg-opacity-50 text-white p-2 rounded-lg hover:bg-opacity-70 transition-opacity"
                          title="تكبير/تصغير"
                        >
                          <ZoomIn className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                      📄 اسم المشترك • رقم الحساب • المنطقة • الترميز الجديد
                    </p>
                  </div>
                )}

                {editingRecord.meter_photo_url && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                      <Camera className="w-4 h-4 ml-2 text-blue-600" />
                      صورة المقياس
                    </h5>
                    <div className="relative bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                      <img 
                        ref={meterImageRef}
                        src={editingRecord.meter_photo_url} 
                        alt="صورة المقياس" 
                        className="w-full h-80 object-contain cursor-zoom-in transition-transform duration-200 hover:scale-105"
                        onClick={() => handleImageClick(editingRecord.meter_photo_url!, 'صورة المقياس')}
                      />
                      <div className="absolute top-2 right-2 flex space-x-1 space-x-reverse">
                        <button
                          onClick={() => {
                            if (meterImageRef.current) {
                              const currentScale = meterImageRef.current.style.transform.includes('scale(1.5)') ? 1.5 : 1;
                              const newScale = currentScale === 1 ? 1.5 : 1;
                              meterImageRef.current.style.transform = `scale(${newScale})`;
                              meterImageRef.current.style.cursor = newScale === 1.5 ? 'zoom-out' : 'zoom-in';
                            }
                          }}
                          className="bg-black bg-opacity-50 text-white p-2 rounded-lg hover:bg-opacity-70 transition-opacity"
                          title="تكبير/تصغير"
                        >
                          <ZoomIn className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                      📊 رقم المقياس • آخر قراءة
                    </p>
                  </div>
                )}
                
                {!editingRecord.meter_photo_url && !editingRecord.invoice_photo_url && (
                  <div className="text-center py-12">
                    <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">لا توجد صور مرفقة</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Comparison Modal */}
      {showPhotoComparison && selectedRecordForPhotos && (
        <PhotoComparison
          recordId={selectedRecordForPhotos}
          onClose={() => {
            setShowPhotoComparison(false);
            setSelectedRecordForPhotos(null);
          }}
          onRecordUpdate={handleRecordUpdate}
        />
      )}

      {/* Location Popup Modal */}
      {showLocationPopup && selectedRecordForLocation && (
        <LocationPopup
          recordId={selectedRecordForLocation}
          onClose={() => {
            setShowLocationPopup(false);
            setSelectedRecordForLocation(null);
          }}
        />
      )}
    </div>
  );
}