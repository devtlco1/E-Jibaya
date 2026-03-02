import React, { useState, useRef } from 'react';
import { CollectionRecord, FilterState } from '../../types';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { dbOperations } from '../../lib/supabase';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Pagination } from '../common/Pagination';
import { PhotoComparison } from './PhotoComparison';
import { LocationPopup } from './LocationPopup';
import { Eye, CreditCard as Edit, Trash2, MapPin, X, Save, ExternalLink, Filter, ZoomIn, ZoomOut, RotateCcw, Images, FileText, User, Camera, MessageSquare, Shield, Download, Maximize2, CheckCircle, XCircle } from 'lucide-react';
import { formatDateTime } from '../../utils/dateFormatter';

interface DataTableProps {
  records: CollectionRecord[];
  totalRecords: number;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  onRecordUpdate?: (recordId: string, updates: Partial<CollectionRecord>) => void;
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
  onDeleteRecord,
  onRecordUpdate
}: DataTableProps) {
  const [viewingRecord, setViewingRecord] = useState<CollectionRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<CollectionRecord | null>(null);
  const [editForm, setEditForm] = useState({
    subscriber_name: '',
    account_number: '',
    meter_number: '',
    region: '',
    district: '',
    last_reading: '',
    status: 'pending' as 'pending' | 'completed' | 'refused',
    // الترميز الجديد
    new_zone: '',
    new_block: '',
    new_home: '',
    // الصنف
    category: null as 'منزلي' | 'تجاري' | 'صناعي' | 'زراعي' | 'حكومي' | null,
    // نوع المقياس
    phase: null as 'احادي' | 'ثلاثي' | 'سي تي' | 'المحولة الخاصة' | 'مقياس الكتروني' | null,
    // معامل الضرب (يظهر فقط عند اختيار سي تي)
    multiplier: '',
    // المبالغ
    total_amount: '',
    current_amount: '',
    // حالة الارض
    land_status: null as 'متروك' | 'مهدوم' | 'لم اعثر عليه' | 'ممتنع' | 'تجاوز' | 'قيد الانشاء' | 'مبدل' | 'مغلق' | 'لايوجد مقياس' | 'فحص مقياس' | 'فارغ' | 'خطاء في القراءة' | 'إيقاف قراءة' | 'عاطل' | null
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

  // Inline controls for edit modal images (invoice)
  const [invZoom, setInvZoom] = useState(1);
  const [invPos, setInvPos] = useState({ x: 0, y: 0 });
  const [invRot, setInvRot] = useState(0);
  const [invDragging, setInvDragging] = useState(false);
  const [invDragStart, setInvDragStart] = useState({ x: 0, y: 0, ix: 0, iy: 0 });

  const handleInvWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setInvZoom(prev => {
      const next = prev * (e.deltaY < 0 ? 1.1 : 1 / 1.1);
      return Math.min(Math.max(next, 0.1), 5);
    });
  };
  const handleInvMouseDown = (e: React.MouseEvent) => {
    if (invZoom > 1) {
      setInvDragging(true);
      setInvDragStart({ x: e.clientX, y: e.clientY, ix: invPos.x, iy: invPos.y });
    }
  };
  const handleInvMouseMove = (e: React.MouseEvent) => {
    if (invDragging && invZoom > 1) {
      setInvPos({ x: invDragStart.ix + (e.clientX - invDragStart.x), y: invDragStart.iy + (e.clientY - invDragStart.y) });
    }
  };
  const handleInvMouseUp = () => setInvDragging(false);

  // Inline controls for edit modal images (meter)
  const [metZoom, setMetZoom] = useState(1);
  const [metPos, setMetPos] = useState({ x: 0, y: 0 });
  const [metRot, setMetRot] = useState(0);
  const [metDragging, setMetDragging] = useState(false);
  const [metDragStart, setMetDragStart] = useState({ x: 0, y: 0, ix: 0, iy: 0 });

  const handleMetWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setMetZoom(prev => {
      const next = prev * (e.deltaY < 0 ? 1.1 : 1 / 1.1);
      return Math.min(Math.max(next, 0.1), 5);
    });
  };
  const handleMetMouseDown = (e: React.MouseEvent) => {
    if (metZoom > 1) {
      setMetDragging(true);
      setMetDragStart({ x: e.clientX, y: e.clientY, ix: metPos.x, iy: metPos.y });
    }
  };
  const handleMetMouseMove = (e: React.MouseEvent) => {
    if (metDragging && metZoom > 1) {
      setMetPos({ x: metDragStart.ix + (e.clientX - metDragStart.x), y: metDragStart.iy + (e.clientY - metDragStart.y) });
    }
  };
  const handleMetMouseUp = () => setMetDragging(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; recordId: string; recordName: string }>({
    isOpen: false,
    recordId: '',
    recordName: ''
  });
  const [users, setUsers] = useState<any[]>([]);
  const [branchManagers, setBranchManagers] = useState<any[]>([]);
  const [branchManagerFieldAgents, setBranchManagerFieldAgents] = useState<string[]>([]);
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
            // جلب مديري الفروع
            const branchManagersData = userData.filter((u: any) => u.role === 'branch_manager' && u.is_active);
            setBranchManagers(branchManagersData);
          }, 100);
        } else {
          // For desktop: load immediately
          const userData = await dbOperations.getUsers();
          setUsers(userData);
          // جلب مديري الفروع
          const branchManagersData = userData.filter((u: any) => u.role === 'branch_manager' && u.is_active);
          setBranchManagers(branchManagersData);
        }
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };
    loadUsers();
  }, []);

  // جلب المحصلين الميدانيين التابعين لمدير الفرع المحدد
  React.useEffect(() => {
    const loadBranchManagerFieldAgents = async () => {
      if (filters.branch_manager_id) {
        try {
          const fieldAgentIds = await dbOperations.getBranchManagerSubordinateIds(filters.branch_manager_id);
          setBranchManagerFieldAgents(fieldAgentIds);
        } catch (error) {
          console.error('Error loading branch manager field agents:', error);
          setBranchManagerFieldAgents([]);
        }
      } else {
        setBranchManagerFieldAgents([]);
      }
    };
    loadBranchManagerFieldAgents();
  }, [filters.branch_manager_id]);

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
          const uniqueRegions = [...new Set(regionsResult.data.map((r: any) => r.region).filter(Boolean))] as string[];
          setAvailableRegions(uniqueRegions);
        }

        // Get unique zones
        const zonesResult = await dbOperations.supabase
          ?.from('collection_records')
          .select('new_zone')
          .not('new_zone', 'is', null)
          .neq('new_zone', '');
        
        if (zonesResult?.data) {
          const uniqueZones = [...new Set(zonesResult.data.map((r: any) => r.new_zone).filter(Boolean))] as string[];
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
          const uniqueBlocks = [...new Set(blocksResult.data.map((r: any) => r.new_block).filter(Boolean))] as string[];
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
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px;
            text-align: center;
            margin-bottom: 15px;
            border-radius: 6px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            font-size: 20px;
            margin-bottom: 8px;
            font-weight: 700;
            text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }
        
        .header .subtitle {
            font-size: 13px;
            color: rgba(255,255,255,0.9);
            font-weight: 500;
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
            border-radius: 4px;
        }
        
        .data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
        }
        
        .data-table td {
            padding: 6px 8px;
            border: 0.5px solid #ddd;
            vertical-align: top;
        }
        
        .data-table .label {
            background: #f8f9fa;
            font-weight: 600;
            width: 35%;
            color: #495057;
        }
        
        .data-table .value {
            background: white;
            width: 65%;
            color: #212529;
        }
        
        .coding-row {
            background: #e8f4fd !important;
        }
        
        .amount-row {
            background: #f0f9ff !important;
        }
        
        .amount-row .label {
            background: #dbeafe !important;
            font-weight: 700;
        }
        
        .amount-row .value {
            background: #eff6ff !important;
            font-weight: 600;
            color: #1e40af;
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
            background: #f8f9fa;
            padding: 10px;
            text-align: center;
            color: #495057;
            font-size: 10px;
            margin-top: 15px;
            border-top: 2px solid #dee2e6;
            border-radius: 4px;
        }
        
        .footer p {
            margin: 4px 0;
            line-height: 1.5;
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
                    <tr>
                        <td class="label">المقاطعة</td>
                        <td class="value">${record.district || 'غير محدد'}</td>
                    </tr>
                    <tr>
                        <td class="label">الصنف</td>
                        <td class="value">${record.category || 'غير محدد'}</td>
                    </tr>
                    <tr>
                        <td class="label">نوع المقياس</td>
                        <td class="value">${record.phase || 'غير محدد'}${record.phase === 'سي تي' && record.multiplier ? ` (معامل الضرب: ${record.multiplier})` : ''}</td>
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
                    ${(record.total_amount !== null && record.total_amount !== undefined) ? `
                    <tr class="amount-row">
                        <td class="label">المجموع المطلوب</td>
                        <td class="value">${record.total_amount.toLocaleString('ar-IQ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.ع</td>
                    </tr>
                    ` : ''}
                    ${(record.current_amount !== null && record.current_amount !== undefined) ? `
                    <tr class="amount-row">
                        <td class="label">المبلغ المستلم</td>
                        <td class="value">${record.current_amount.toLocaleString('ar-IQ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.ع</td>
                    </tr>
                    ` : ''}
                    ${((record.total_amount !== null && record.total_amount !== undefined) && 
                       (record.current_amount !== null && record.current_amount !== undefined)) ? `
                    <tr class="amount-row">
                        <td class="label">المبلغ المتبقي</td>
                        <td class="value">${(record.total_amount - record.current_amount).toLocaleString('ar-IQ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.ع</td>
                    </tr>
                    ` : ''}
                    <tr>
                        <td class="label">الموقع الجغرافي</td>
                        <td class="value">${(record.gps_latitude && record.gps_longitude) ? `${record.gps_latitude}, ${record.gps_longitude}` : 'غير محدد'}</td>
                    </tr>
                    <tr>
                        <td class="label">حالة التدقيق</td>
                        <td class="value">${record.verification_status || 'غير مدقق'}</td>
                    </tr>
                    <tr>
                        <td class="label">صورة المقياس</td>
                        <td class="value">${record.meter_photo_verified ? '✓ مدققة' : record.meter_photo_rejected ? '✗ مرفوضة' : 'غير مدققة'}</td>
                    </tr>
                    <tr>
                        <td class="label">صورة الفاتورة</td>
                        <td class="value">${record.invoice_photo_verified ? '✓ مدققة' : record.invoice_photo_rejected ? '✗ مرفوضة' : 'غير مدققة'}</td>
                    </tr>
                    <tr>
                        <td class="label">حالة الارض</td>
                        <td class="value">${record.land_status || '—'}</td>
                    </tr>
                    <tr>
                        <td class="label">الحالة</td>
                        <td class="value"><span class="status-badge status-${record.is_refused ? 'refused' : record.status}">${record.is_refused ? 'امتنع' : (record.status === 'pending' ? 'قيد المراجعة' : record.status === 'completed' ? 'مكتمل' : 'غير محدد')}</span></td>
                    </tr>
                    <tr>
                        <td class="label">تاريخ الإنشاء</td>
                        <td class="value">${formatDateTime(record.submitted_at)}</td>
                    </tr>
                    ${record.completed_at ? `
                    <tr>
                        <td class="label">تاريخ الإكمال</td>
                        <td class="value">${formatDateTime(record.completed_at)}</td>
                    </tr>
                    ` : ''}
                    <tr>
                        <td class="label">آخر تحديث</td>
                        <td class="value">${formatDateTime(record.updated_at)}</td>
                    </tr>
                    <tr>
                        <td class="label">تم الإنشاء بواسطة</td>
                        <td class="value">${getUserName(record.field_agent_id)}</td>
                    </tr>
                    ${record.completed_by ? `
                    <tr>
                        <td class="label">تم الإكمال بواسطة</td>
                        <td class="value">${getUserName(record.completed_by)}</td>
                    </tr>
                    ` : ''}
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
                <!-- Footer داخل قسم الصور -->
                <div class="footer">
                    <p style="margin-bottom: 6px; font-weight: 500;">تم إنشاء هذا التقرير في ${formatDateTime(new Date().toISOString())}</p>
                    <p style="margin: 0; font-weight: 600; color: #667eea;">نظام إدارة الجباية - E-Jibaya</p>
                </div>
            </div>
            ` : `
            <!-- Footer إذا لم تكن هناك صور -->
            <div class="footer">
                <p style="margin-bottom: 6px; font-weight: 500;">تم إنشاء هذا التقرير في ${formatDateTime(new Date().toISOString())}</p>
                <p style="margin: 0; font-weight: 600; color: #667eea;">نظام إدارة الجباية - E-Jibaya</p>
            </div>
            `}
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
      
      // تحديث فوري للقفل في الواجهة
      console.log('Record locked - updating UI immediately');
      
      // تحديث محلي لحالة القفل
      if (onRecordUpdate) {
        onRecordUpdate(record.id, { 
          locked_by: currentUser.id, 
          locked_at: new Date().toISOString() 
        });
      }
      
      setEditingRecord(record);
      setEditForm({
        subscriber_name: record.subscriber_name || '',
        account_number: record.account_number || '',
        meter_number: record.meter_number || '',
        region: (record.region && record.region !== 'غير محدد') ? record.region : '',
        district: (record.district && record.district !== 'غير محدد') ? record.district : '',
        last_reading: record.last_reading || '',
        status: getRecordStatus(record) as 'pending' | 'completed' | 'refused',
        // المبالغ
        total_amount: record.total_amount !== null && record.total_amount !== undefined ? record.total_amount.toString() : '',
        current_amount: record.current_amount !== null && record.current_amount !== undefined ? record.current_amount.toString() : '',
      // الترميز الجديد
      new_zone: record.new_zone || '',
      new_block: record.new_block || '',
      new_home: record.new_home || '',
      // الصنف
      category: record.category,
      // نوع المقياس
      phase: record.phase,
      // معامل الضرب
      multiplier: record.multiplier || '',
      // حالة الارض
      land_status: record.land_status || null
      });

      // إشعار صامت - لا يظهر للمستخدمين الآخرين
      console.log('Record locked successfully - UI updated silently');
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
        // التحقق من البيانات المطلوبة لجميع الحالات
        const requiredFields = [
          { field: 'subscriber_name', name: 'اسم المشترك' },
          { field: 'account_number', name: 'رقم الحساب' },
          { field: 'meter_number', name: 'رقم المقياس' },
          { field: 'last_reading', name: 'القراءة الأخيرة' },
          { field: 'region', name: 'المنطقة' },
          { field: 'category', name: 'الصنف' },
          { field: 'phase', name: 'نوع المقياس' }
        ];

        const missingFields = requiredFields.filter(field => {
          const value = editForm[field.field as keyof typeof editForm];
          return !value || (typeof value === 'string' && value.trim() === '');
        });

        if (missingFields.length > 0) {
          addNotification({
            type: 'error',
            title: 'لا يمكن حفظ السجل',
            message: `يجب ملء البيانات التالية أولاً: ${missingFields.map(f => f.name).join('، ')}`
          });
          return;
        }

        // التحقق من صحة رقم الحساب (لجميع الحالات)
        if (editForm.account_number && editForm.account_number.trim() !== '') {
          const accountNumber = editForm.account_number.trim();
          
          // التحقق من أن رقم الحساب يحتوي على أرقام فقط
          if (!/^\d+$/.test(accountNumber)) {
            addNotification({
              type: 'error',
              title: 'رقم الحساب غير صحيح',
              message: 'رقم الحساب يجب أن يحتوي على أرقام فقط'
            });
            return;
          }
          
          // التحقق من أن رقم الحساب لا يتجاوز 12 رقم
          if (accountNumber.length > 12) {
            addNotification({
              type: 'error',
              title: 'رقم الحساب طويل جداً',
              message: 'رقم الحساب يجب أن يكون 12 رقم أو أقل'
            });
            return;
          }
        }

        // Handle status and is_refused logic
        let updateData: any = {
          ...editForm,
          completed_by: currentUser.id || editingRecord.completed_by,
          // إضافة معامل الضرب إذا كان موجوداً
          multiplier: editForm.multiplier || null,
          // المبالغ
          total_amount: editForm.total_amount ? parseFloat(editForm.total_amount) : null,
          current_amount: editForm.current_amount ? parseFloat(editForm.current_amount) : null,
          // حالة الارض
          land_status: editForm.land_status
        };

        // Handle status logic
        updateData.status = editForm.status;
        updateData.is_refused = false;
        
        await onUpdateRecord(editingRecord.id, updateData);
        
        // إلغاء قفل السجل بعد الحفظ
        await dbOperations.unlockRecord(editingRecord.id, currentUser.id);
        
        // تحديث فوري لإلغاء القفل في الواجهة
        console.log('Record saved and unlocked - updating UI silently');
        
        // تحديث محلي لحالة القفل
        if (onRecordUpdate) {
          onRecordUpdate(editingRecord.id, { 
            locked_by: null, 
            locked_at: null 
          });
        }
        
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
        
        // تحديث فوري لإلغاء القفل في الواجهة
        console.log('Record unlocked - updating UI immediately');
        
        // تحديث محلي لحالة القفل
        if (onRecordUpdate) {
          onRecordUpdate(editingRecord.id, { 
            locked_by: null, 
            locked_at: null 
          });
        }
        
        // إشعار صامت - لا يظهر للمستخدمين الآخرين
        console.log('Record unlocked successfully - UI updated silently');
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
    setImageZoom(prev => Math.min(prev * 1.25, 5));
  };

  const handleZoomOut = () => {
    setImageZoom(prev => Math.max(prev / 1.25, 0.1));
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
    if (imageZoom > 0.1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - imagePosition.x,
        y: e.clientY - imagePosition.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && imageZoom > 0.1) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheelZoom = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = Math.sign(e.deltaY);
    setImageZoom(prev => {
      const factor = delta > 0 ? 1 / 1.1 : 1.1;
      const next = prev * factor;
      return Math.min(Math.max(next, 0.1), 5);
    });
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

            {/* الصف الثالث: حالة الارض، الحالة، التدقيق */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  حالة الارض
                </label>
                <select
                  value={filters.land_status || ''}
                  onChange={(e) => onFiltersChange({ ...filters, land_status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                >
                  <option value="">جميع حالات الارض</option>
                  <option value="متروك">متروك</option>
                  <option value="مهدوم">مهدوم</option>
                  <option value="لم اعثر عليه">لم اعثر عليه</option>
                  <option value="ممتنع">ممتنع</option>
                  <option value="إيقاف قراءة">إيقاف قراءة</option>
                  <option value="عاطل">عاطل</option>
                  <option value="تجاوز">تجاوز</option>
                  <option value="قيد الانشاء">قيد الانشاء</option>
                  <option value="مبدل">مبدل</option>
                  <option value="مغلق">مغلق</option>
                  <option value="لايوجد مقياس">لايوجد مقياس</option>
                  <option value="فحص مقياس">فحص مقياس</option>
                  <option value="فارغ">فارغ</option>
                  <option value="خطاء في القراءة">خطاء في القراءة</option>
                </select>
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
                  الصور المرفوضة
                </label>
                <select
                  value={filters.rejected_photos || ''}
                  onChange={(e) => onFiltersChange({ ...filters, rejected_photos: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                >
                  <option value="">الكل</option>
                  <option value="any">يوجد صور مرفوضة</option>
                  <option value="none">لا توجد صور مرفوضة</option>
                </select>
              </div>

            </div>

            {/* الصف الرابع: الصنف، نوع المقياس، المحصل الميداني */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <option value="المحولة الخاصة">المحولة الخاصة</option>
                  <option value="مقياس الكتروني">مقياس الكتروني</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  المحصل الميداني
                </label>
                <select
                  value={filters.field_agent_id || ''}
                  onChange={(e) => onFiltersChange({ ...filters, field_agent_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  disabled={!!filters.branch_manager_id}
                >
                  <option value="">جميع المحصلين</option>
                  {(filters.branch_manager_id && branchManagerFieldAgents.length > 0
                    ? users.filter(user => user.role === 'field_agent' && branchManagerFieldAgents.includes(user.id))
                    : users.filter(user => user.role === 'field_agent')
                  ).map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* الصف الخامس: مدير الفرع */}
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  مدير الفرع
                </label>
                <select
                  value={filters.branch_manager_id || ''}
                  onChange={(e) => {
                    const newFilters = { ...filters, branch_manager_id: e.target.value, field_agent_id: '' };
                    onFiltersChange(newFilters);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                >
                  <option value="">جميع مديري الفروع</option>
                  {branchManagers.map(branchManager => (
                    <option key={branchManager.id} value={branchManager.id}>
                      {branchManager.full_name}
                    </option>
                  ))}
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
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  المقاطعة
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                  آخر قراءة
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  المجموع المطلوب
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  المبلغ المستلم
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  صورة المقياس
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  صورة الفاتورة
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  حالة الارض
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
                  <td colSpan={15} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
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
                    className="px-3 sm:px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs truncate cursor-pointer hidden lg:table-cell"
                    onClick={() => handleEdit(record)}
                  >
                    {record.district || (
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
                    className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white cursor-pointer hidden lg:table-cell"
                    onClick={() => handleEdit(record)}
                  >
                    {record.total_amount !== null && record.total_amount !== undefined ? (
                      <span className="font-medium">{record.total_amount.toFixed(2)}</span>
                    ) : (
                      <span className="text-gray-400 italic">غير محدد</span>
                    )}
                  </td>
                  <td 
                    className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white cursor-pointer hidden lg:table-cell"
                    onClick={() => handleEdit(record)}
                  >
                    {record.current_amount !== null && record.current_amount !== undefined ? (
                      <span className="font-medium">{record.current_amount.toFixed(2)}</span>
                    ) : (
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
                    className="px-3 sm:px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs truncate cursor-pointer hidden lg:table-cell"
                    onClick={() => handleEdit(record)}
                  >
                    {record.land_status || (
                      <span className="text-gray-400 italic">—</span>
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
                        {(record.meter_photo_rejected || record.invoice_photo_rejected) && (
                          <span className="text-red-600 ml-2" title="هناك صورة مرفوضة">▲</span>
                        )}
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
                      {currentUser?.role === 'admin' && (
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
                      )}
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
              <div className="space-y-4">
                {/* معلومات السجل */}
                <div className="bg-gradient-to-l from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-5 border border-blue-200 dark:border-blue-700">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center text-base">
                    <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 ml-2" />
                    معلومات السجل
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">تاريخ الإنشاء</span>
                      <p className="text-gray-900 dark:text-white font-semibold text-sm">
                        {formatDateTime(viewingRecord.submitted_at)}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">آخر تحديث</span>
                      <p className="text-gray-900 dark:text-white font-semibold text-sm">
                        {formatDateTime(viewingRecord.updated_at)}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">تم الإنشاء بواسطة</span>
                      <p className="text-gray-900 dark:text-white font-semibold text-sm">
                        {getUserName(viewingRecord.field_agent_id)}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">تم التعديل بواسطة</span>
                      <p className="text-gray-900 dark:text-white font-semibold text-sm">
                        {viewingRecord.completed_by ? getUserName(viewingRecord.completed_by) : 
                         (viewingRecord.updated_at !== viewingRecord.submitted_at ? 
                          (currentUser ? `${currentUser.full_name}` : 'مستخدم غير محدد') : 
                          'لم يتم التعديل')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* بيانات العميل */}
                <div className="bg-gradient-to-l from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-5 border border-green-200 dark:border-green-700">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center text-base">
                    <User className="w-5 h-5 text-green-600 dark:text-green-400 ml-2" />
                    بيانات العميل
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-700">
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">اسم المشترك</span>
                      <p className="text-gray-900 dark:text-white font-semibold">
                        {viewingRecord.subscriber_name || 'غير محدد'}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-700">
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">رقم الحساب</span>
                      <p className="text-gray-900 dark:text-white font-semibold">
                        {viewingRecord.account_number || 'غير محدد'}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-700">
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">المنطقة</span>
                      <p className="text-gray-900 dark:text-white font-semibold">
                        {viewingRecord.region || 'غير محدد'}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-700">
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">المقاطعة</span>
                      <p className="text-gray-900 dark:text-white font-semibold">
                        {viewingRecord.district || 'غير محدد'}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-700">
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">رقم المقياس</span>
                      <p className="text-gray-900 dark:text-white font-semibold">
                        {viewingRecord.meter_number || 'غير محدد'}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-700">
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">آخر قراءة</span>
                      <p className="text-gray-900 dark:text-white font-semibold">
                        {viewingRecord.last_reading || 'غير محدد'}
                      </p>
                    </div>
                    {(viewingRecord.total_amount !== null && viewingRecord.total_amount !== undefined) && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-700">
                        <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">المجموع المطلوب</span>
                        <p className="text-gray-900 dark:text-white font-semibold">
                          {viewingRecord.total_amount.toLocaleString('ar-IQ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.ع
                        </p>
                      </div>
                    )}
                    {(viewingRecord.current_amount !== null && viewingRecord.current_amount !== undefined) && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-700">
                        <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">المبلغ المستلم</span>
                        <p className="text-gray-900 dark:text-white font-semibold text-green-600 dark:text-green-400">
                          {viewingRecord.current_amount.toLocaleString('ar-IQ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.ع
                        </p>
                      </div>
                    )}
                    {((viewingRecord.total_amount !== null && viewingRecord.total_amount !== undefined) && 
                      (viewingRecord.current_amount !== null && viewingRecord.current_amount !== undefined)) && (
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-red-200 dark:border-red-700">
                        <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">المبلغ المتبقي</span>
                        <p className="text-gray-900 dark:text-white font-semibold text-red-600 dark:text-red-400">
                          {(viewingRecord.total_amount - viewingRecord.current_amount).toLocaleString('ar-IQ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.ع
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* الترميز والتصنيف */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* الترميز الجديد */}
                  {(viewingRecord.new_zone || viewingRecord.new_block || viewingRecord.new_home) && (
                    <div className="bg-gradient-to-l from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-xl p-5 border border-indigo-200 dark:border-indigo-700">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center text-base">
                        <MapPin className="w-5 h-5 text-indigo-600 dark:text-indigo-400 ml-2" />
                        الترميز الجديد
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        {viewingRecord.new_zone && (
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-indigo-200 dark:border-indigo-700 text-center">
                            <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">الزون</span>
                            <p className="text-gray-900 dark:text-white font-semibold">
                              {viewingRecord.new_zone}
                            </p>
                          </div>
                        )}
                        {viewingRecord.new_block && (
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-indigo-200 dark:border-indigo-700 text-center">
                            <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">البلوك</span>
                            <p className="text-gray-900 dark:text-white font-semibold">
                              {viewingRecord.new_block}
                            </p>
                          </div>
                        )}
                        {viewingRecord.new_home && (
                          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-indigo-200 dark:border-indigo-700 text-center">
                            <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">الهوم</span>
                            <p className="text-gray-900 dark:text-white font-semibold">
                              {viewingRecord.new_home}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* الصنف ونوع المقياس */}
                  <div className="bg-gradient-to-l from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-5 border border-purple-200 dark:border-purple-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center text-base">
                      <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400 ml-2" />
                      التصنيف
                    </h4>
                    <div className="space-y-3">
                      {viewingRecord.category && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
                          <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">الصنف</span>
                          <span className="inline-block px-3 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded-lg text-sm font-semibold">
                            {viewingRecord.category}
                          </span>
                        </div>
                      )}
                      {viewingRecord.phase && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-purple-200 dark:border-purple-700">
                          <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">نوع المقياس</span>
                          <div className="flex items-center gap-2">
                            <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-lg text-sm font-semibold">
                              {viewingRecord.phase}
                            </span>
                            {viewingRecord.phase === 'سي تي' && viewingRecord.multiplier && (
                              <span className="inline-block px-3 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-lg text-sm font-semibold">
                                معامل الضرب: {viewingRecord.multiplier}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* حالة التدقيق */}
                <div className="bg-gradient-to-l from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-xl p-5 border border-yellow-200 dark:border-yellow-700">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center text-base">
                    <Shield className="w-5 h-5 text-yellow-600 dark:text-yellow-400 ml-2" />
                    حالة التدقيق والحالة
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-yellow-200 dark:border-yellow-700">
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">حالة الارض</span>
                      <span className="inline-block px-3 py-1 text-sm font-semibold rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                        {viewingRecord.land_status || '—'}
                      </span>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-yellow-200 dark:border-yellow-700">
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">حالة السجل</span>
                      <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(getRecordStatus(viewingRecord))}`}>
                        {getRecordStatusText(viewingRecord)}
                      </span>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-yellow-200 dark:border-yellow-700">
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">حالة التدقيق</span>
                      <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-lg ${
                        viewingRecord.verification_status === 'مدقق' 
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                      }`}>
                        {viewingRecord.verification_status || 'غير مدقق'}
                      </span>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-yellow-200 dark:border-yellow-700">
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">صورة المقياس</span>
                      <div className="flex items-center gap-2">
                        {viewingRecord.meter_photo_verified ? (
                          <span className="inline-flex items-center px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs font-semibold">
                            <CheckCircle className="w-3 h-3 ml-1" />
                            مدقق
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded text-xs font-semibold">
                            غير مدقق
                          </span>
                        )}
                        {viewingRecord.meter_photo_rejected && (
                          <span className="inline-flex items-center px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded text-xs font-semibold">
                            مرفوضة
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-yellow-200 dark:border-yellow-700">
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">صورة الفاتورة</span>
                      <div className="flex items-center gap-2">
                        {viewingRecord.invoice_photo_verified ? (
                          <span className="inline-flex items-center px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs font-semibold">
                            <CheckCircle className="w-3 h-3 ml-1" />
                            مدقق
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded text-xs font-semibold">
                            غير مدقق
                          </span>
                        )}
                        {viewingRecord.invoice_photo_rejected && (
                          <span className="inline-flex items-center px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded text-xs font-semibold">
                            مرفوضة
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {viewingRecord.is_refused && (
                    <div className="mt-3 bg-red-50 dark:bg-red-900/30 rounded-lg p-3 border border-red-200 dark:border-red-700">
                      <span className="text-red-600 dark:text-red-400 text-sm font-semibold flex items-center">
                        <XCircle className="w-4 h-4 ml-2" />
                        امتنع العميل عن الدفع
                      </span>
                    </div>
                  )}
                </div>

                {/* الموقع الجغرافي */}
                {viewingRecord.gps_latitude && viewingRecord.gps_longitude && (
                  <div className="bg-gradient-to-l from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-xl p-5 border border-red-200 dark:border-red-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center text-base">
                      <MapPin className="w-5 h-5 text-red-600 dark:text-red-400 ml-2" />
                      الموقع الجغرافي
                    </h4>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-red-200 dark:border-red-700">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                          {viewingRecord.gps_latitude}, {viewingRecord.gps_longitude}
                        </span>
                        <a
                          href={`https://maps.google.com/?q=${viewingRecord.gps_latitude},${viewingRecord.gps_longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          <ExternalLink className="w-4 h-4 ml-2" />
                          عرض في الخريطة
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* الصور المرفقة */}
                {(viewingRecord.meter_photo_url || viewingRecord.invoice_photo_url) && (
                  <div className="bg-gradient-to-l from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-5 border border-purple-200 dark:border-purple-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center text-base">
                      <Camera className="w-5 h-5 text-purple-600 dark:text-purple-400 ml-2" />
                      الصور المرفقة
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {viewingRecord.meter_photo_url && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center">
                              <Camera className="w-4 h-4 text-blue-600 ml-2" />
                              صورة المقياس
                            </h5>
                            {viewingRecord.meter_photo_verified && (
                              <span className="inline-flex items-center px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs font-semibold">
                                <CheckCircle className="w-3 h-3 ml-1" />
                                مدقق
                              </span>
                            )}
                            {viewingRecord.meter_photo_rejected && (
                              <span className="inline-flex items-center px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded text-xs font-semibold">
                                مرفوضة
                              </span>
                            )}
                          </div>
                          <img 
                            src={viewingRecord.meter_photo_url} 
                            alt="صورة المقياس" 
                            className="w-full h-56 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity border border-gray-200 dark:border-gray-600"
                            onClick={() => handleImageClick(viewingRecord.meter_photo_url!, 'صورة المقياس')}
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">انقر للتكبير</p>
                        </div>
                      )}

                      {viewingRecord.invoice_photo_url && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center">
                              <FileText className="w-4 h-4 text-green-600 ml-2" />
                              صورة الفاتورة
                            </h5>
                            {viewingRecord.invoice_photo_verified && (
                              <span className="inline-flex items-center px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs font-semibold">
                                <CheckCircle className="w-3 h-3 ml-1" />
                                مدقق
                              </span>
                            )}
                            {viewingRecord.invoice_photo_rejected && (
                              <span className="inline-flex items-center px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded text-xs font-semibold">
                                مرفوضة
                              </span>
                            )}
                          </div>
                          <img 
                            src={viewingRecord.invoice_photo_url} 
                            alt="صورة الفاتورة" 
                            className="w-full h-56 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity border border-gray-200 dark:border-gray-600"
                            onClick={() => handleImageClick(viewingRecord.invoice_photo_url!, 'صورة الفاتورة')}
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">انقر للتكبير</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* تاغات المشاكل */}
                {viewingRecord.tags && Array.isArray(viewingRecord.tags) && viewingRecord.tags.length > 0 && (
                  <div className="bg-gradient-to-l from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-5 border border-purple-200 dark:border-purple-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center text-base">
                      <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400 ml-2" />
                      تاغات المشاكل
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {viewingRecord.tags.map((tag: string, index: number) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-purple-600 text-white rounded-full text-sm font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* الملاحظات */}
                {viewingRecord.notes && (
                  <div className="bg-gradient-to-l from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-5 border border-orange-200 dark:border-orange-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center text-base">
                      <MessageSquare className="w-5 h-5 text-orange-600 dark:text-orange-400 ml-2" />
                      الملاحظات
                    </h4>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {viewingRecord.notes}
                      </p>
                    </div>
                  </div>
                )}

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
              onWheel={handleWheelZoom}
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            المقاطعة
                          </label>
                          <input
                            type="text"
                            value={editForm.district}
                            onChange={(e) => setEditForm({ ...editForm, district: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                            placeholder="أدخل المقاطعة"
                          />
                        </div>
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
                      {['منزلي', 'تجاري', 'صناعي', 'زراعي', 'حكومي'].map((cat) => (
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  </div>

                  {/* 4. نوع المقياس */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-4 flex items-center">
                      <FileText className="w-4 h-4 ml-2" />
                      نوع المقياس
                    </h4>
                    <div className="flex gap-2 flex-wrap">
                      {['احادي', 'ثلاثي', 'سي تي', 'المحولة الخاصة', 'مقياس الكتروني'].map((ph) => (
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
                    
                    {/* حقل معامل الضرب - يظهر فقط عند اختيار سي تي */}
                    {editForm.phase === 'سي تي' && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          معامل الضرب (اختياري)
                        </label>
                        <input
                          type="text"
                          value={editForm.multiplier}
                          onChange={(e) => setEditForm({ ...editForm, multiplier: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          placeholder="أدخل معامل الضرب (رقم أو نص)"
                        />
                      </div>
                    )}
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

                  {/* 6. المبالغ */}
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    <h4 className="text-sm font-semibold text-indigo-800 dark:text-indigo-200 mb-4 flex items-center">
                      <FileText className="w-4 h-4 ml-2" />
                      المبالغ
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          المجموع المطلوب
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editForm.total_amount}
                          onChange={(e) => {
                            const value = e.target.value;
                            // السماح فقط بالأرقام والنقطة العشرية
                            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                              setEditForm({ ...editForm, total_amount: value });
                            }
                          }}
                          placeholder="0.00"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          المبلغ المستلم
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editForm.current_amount}
                          onChange={(e) => {
                            const value = e.target.value;
                            // السماح فقط بالأرقام والنقطة العشرية
                            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                              setEditForm({ ...editForm, current_amount: value });
                            }
                          }}
                          placeholder="0.00"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 6.5. حالة الارض */}
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                      <Shield className="w-4 h-4 ml-2" />
                      حالة الارض
                    </h4>
                    <div className="flex flex-wrap gap-3">
                      {(['متروك', 'مهدوم', 'لم اعثر عليه', 'ممتنع', 'تجاوز', 'قيد الانشاء', 'مبدل', 'مغلق', 'لايوجد مقياس', 'فحص مقياس', 'فارغ', 'خطاء في القراءة', 'إيقاف قراءة', 'عاطل'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setEditForm({ ...editForm, land_status: editForm.land_status === opt ? null : opt })}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            editForm.land_status === opt
                              ? 'bg-indigo-500 text-white shadow-lg'
                              : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-800'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 7. حالة السجل */}
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
                      <div
                        className="w-full h-80 flex items-center justify-center overflow-hidden"
                        onWheel={handleInvWheel}
                        onMouseDown={handleInvMouseDown}
                        onMouseMove={handleInvMouseMove}
                        onMouseUp={handleInvMouseUp}
                        onMouseLeave={handleInvMouseUp}
                        style={{ cursor: invZoom > 1 ? (invDragging ? 'grabbing' : 'grab') : 'default' }}
                      >
                        <img 
                          ref={invoiceImageRef}
                          src={editingRecord.invoice_photo_url} 
                          alt="صورة الفاتورة" 
                          className="max-w-full max-h-full object-contain select-none"
                          draggable={false}
                          style={{ transform: `translate(${invPos.x}px, ${invPos.y}px) rotate(${invRot}deg) scale(${invZoom})`, transition: invDragging ? 'none' : 'transform 0.08s ease-out' }}
                        />
                      </div>
                      <div className="absolute top-2 right-2 flex space-x-1 space-x-reverse">
                        <button onClick={() => setInvZoom(z => Math.min(z * 1.25, 5))} className="bg-black bg-opacity-50 text-white p-2 rounded-lg hover:bg-opacity-70" title="تكبير">
                          <ZoomIn className="w-4 h-4" />
                        </button>
                        <button onClick={() => setInvZoom(z => Math.max(z / 1.25, 0.1))} className="bg-black bg-opacity-50 text-white p-2 rounded-lg hover:bg-opacity-70" title="تصغير">
                          <ZoomOut className="w-4 h-4" />
                        </button>
                        <button onClick={() => setInvRot(r => (r + 90) % 360)} className="bg-black bg-opacity-50 text-white p-2 rounded-lg hover:bg-opacity-70" title="دوران">
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setInvZoom(1); setInvPos({ x: 0, y: 0 }); setInvRot(0); }} className="bg-black bg-opacity-50 text-white p-2 rounded-lg hover:bg-opacity-70" title="إعادة تعيين">
                          <Maximize2 className="w-4 h-4" />
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
                      <div
                        className="w-full h-80 flex items-center justify-center overflow-hidden"
                        onWheel={handleMetWheel}
                        onMouseDown={handleMetMouseDown}
                        onMouseMove={handleMetMouseMove}
                        onMouseUp={handleMetMouseUp}
                        onMouseLeave={handleMetMouseUp}
                        style={{ cursor: metZoom > 1 ? (metDragging ? 'grabbing' : 'grab') : 'default' }}
                      >
                        <img 
                          ref={meterImageRef}
                          src={editingRecord.meter_photo_url} 
                          alt="صورة المقياس" 
                          className="max-w-full max-h-full object-contain select-none"
                          draggable={false}
                          style={{ transform: `translate(${metPos.x}px, ${metPos.y}px) rotate(${metRot}deg) scale(${metZoom})`, transition: metDragging ? 'none' : 'transform 0.08s ease-out' }}
                        />
                      </div>
                      <div className="absolute top-2 right-2 flex space-x-1 space-x-reverse">
                        <button onClick={() => setMetZoom(z => Math.min(z * 1.25, 5))} className="bg-black bg-opacity-50 text-white p-2 rounded-lg hover:bg-opacity-70" title="تكبير">
                          <ZoomIn className="w-4 h-4" />
                        </button>
                        <button onClick={() => setMetZoom(z => Math.max(z / 1.25, 0.1))} className="bg-black bg-opacity-50 text-white p-2 rounded-lg hover:bg-opacity-70" title="تصغير">
                          <ZoomOut className="w-4 h-4" />
                        </button>
                        <button onClick={() => setMetRot(r => (r + 90) % 360)} className="bg-black bg-opacity-50 text-white p-2 rounded-lg hover:bg-opacity-70" title="دوران">
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setMetZoom(1); setMetPos({ x: 0, y: 0 }); setMetRot(0); }} className="bg-black bg-opacity-50 text-white p-2 rounded-lg hover:bg-opacity-70" title="إعادة تعيين">
                          <Maximize2 className="w-4 h-4" />
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