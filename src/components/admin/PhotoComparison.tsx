import { useState, useEffect, useRef } from 'react';
import { X, FileText, ZoomIn, ZoomOut, RotateCw, Maximize2, CheckCircle, Circle, Save, XCircle, Ban } from 'lucide-react';
import { formatDateTime } from '../../utils/dateFormatter';
import { formatNumberEn } from '../../utils/numberFormatter';
import { dbOperations } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CollectionRecord, RecordPhoto } from '../../types';
import {
  buildMeterTimeline,
  buildInvoiceFaceTimeline,
  buildInvoiceBackTimeline,
  computeVerificationAggregates,
  pickFirstTimelineRow,
  timelineRowToRecordPhoto,
  MAIN_METER_ID,
  MAIN_INVOICE_FACE_ID,
  MAIN_INVOICE_BACK_ID,
  type TimelineRow,
  type ViewerCategory,
} from './photoComparisonTimelines';

interface PhotoComparisonProps {
  recordId: string;
  onClose: () => void;
  onRecordUpdate?: (recordId: string, updates: Partial<CollectionRecord>, options?: { skipVerifyLog?: boolean }) => void;
}

export function PhotoComparison({ recordId, onClose, onRecordUpdate }: PhotoComparisonProps) {
  const { user } = useAuth();
  const initialVerificationStatusRef = useRef<string | null>(null);
  const [record, setRecord] = useState<CollectionRecord | null>(null);
  const [photos, setPhotos] = useState<RecordPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerCategory, setViewerCategory] = useState<ViewerCategory>('meter');
  const [selectedPhoto, setSelectedPhoto] = useState<RecordPhoto | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, initialPosition: { x: 0, y: 0 } });
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  useEffect(() => {
    loadRecordData();
  }, [recordId]);

  // Monitor for new photos being added
  useEffect(() => {
    if (record) {
      // Set up a timer to check for new photos periodically
      const interval = setInterval(async () => {
        try {
          const { photos: latestPhotos } = await dbOperations.getRecordWithPhotos(recordId);
          if (latestPhotos.length > photos.length) {
            // New photos detected, refresh data
            await refreshData();
          }
        } catch (error) {
          console.error('Error checking for new photos:', error);
        }
      }, 5000); // Check every 5 seconds

      return () => clearInterval(interval);
    }
  }, [record, photos.length, recordId]);

  const loadRecordData = async () => {
    try {
      setLoading(true);
      const { record: recordData, photos: photosData } = await dbOperations.getRecordWithPhotos(recordId);
      setRecord(recordData);
      setPhotos(photosData);
      initialVerificationStatusRef.current = recordData?.verification_status ?? null;

      const first = pickFirstTimelineRow(recordData, photosData);
      if (first) {
        setViewerCategory(first.category);
        setSelectedPhoto(timelineRowToRecordPhoto(recordId, first.row, first.category));
      } else {
        setSelectedPhoto(null);
      }
    } catch (error) {
      console.error('Error loading record data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Function to refresh data when new photos are added
  const refreshData = async () => {
    try {
      const { record: recordData, photos: photosData } = await dbOperations.getRecordWithPhotos(recordId);
      setRecord(recordData);
      setPhotos(photosData);

      const first = pickFirstTimelineRow(recordData, photosData);
      if (first) {
        setViewerCategory(first.category);
        setSelectedPhoto(timelineRowToRecordPhoto(recordId, first.row, first.category));
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };



  const formatDate = (dateString: string) => {
    return formatDateTime(dateString);
  };

  // دوال التحكم في التكبير والحركة
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.3, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.3, 0.5));
  };

  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  };

  const recomputeRecordVerificationStatus = (nextRecord: CollectionRecord, nextPhotos: RecordPhoto[]) => {
    const { allVerified, anyRejected } = computeVerificationAggregates(nextRecord, nextPhotos);
    const nextStatus = allVerified && !anyRejected ? 'مدقق' : 'غير مدقق';
    if (nextRecord.verification_status === nextStatus) return nextRecord;
    setHasUnsavedChanges(true);
    return { ...nextRecord, verification_status: nextStatus };
  };

  const toggleTimelineVerified = (category: ViewerCategory, row: TimelineRow) => {
    if (!record) return;
    if (row.source === 'record' && row.dbPhotoId) {
      setPhotos(prev => {
        const nextPhotos = prev.map(p =>
          p.id === row.dbPhotoId ? { ...p, verified: !p.verified } : p
        );
        setRecord(r => (r ? recomputeRecordVerificationStatus(r, nextPhotos) : r));
        return nextPhotos;
      });
    } else {
      setRecord(prev => {
        if (!prev) return prev;
        let r = prev;
        if (category === 'meter' && row.id === MAIN_METER_ID) {
          r = { ...prev, meter_photo_verified: !prev.meter_photo_verified };
        } else if (category === 'invoice_face' && row.id === MAIN_INVOICE_FACE_ID) {
          r = { ...prev, invoice_photo_verified: !prev.invoice_photo_verified };
        } else if (category === 'invoice_back' && row.id === MAIN_INVOICE_BACK_ID) {
          r = {
            ...prev,
            invoice_back_photo_verified: !(prev.invoice_back_photo_verified ?? false),
          };
        }
        return recomputeRecordVerificationStatus(r, photosRef.current);
      });
    }
    setHasUnsavedChanges(true);
  };

  const toggleTimelineRejected = (category: ViewerCategory, row: TimelineRow) => {
    if (!record) return;
    if (row.source === 'record' && row.dbPhotoId) {
      setPhotos(prev => {
        const nextPhotos = prev.map(p =>
          p.id === row.dbPhotoId
            ? { ...p, rejected: !(p as RecordPhoto & { rejected?: boolean }).rejected }
            : p
        );
        setRecord(r => (r ? recomputeRecordVerificationStatus(r, nextPhotos) : r));
        return nextPhotos;
      });
    } else {
      setRecord(prev => {
        if (!prev) return prev;
        let r = prev;
        if (category === 'meter' && row.id === MAIN_METER_ID) {
          r = { ...prev, meter_photo_rejected: !prev.meter_photo_rejected };
        } else if (category === 'invoice_face' && row.id === MAIN_INVOICE_FACE_ID) {
          r = { ...prev, invoice_photo_rejected: !prev.invoice_photo_rejected };
        } else if (category === 'invoice_back' && row.id === MAIN_INVOICE_BACK_ID) {
          r = {
            ...prev,
            invoice_back_photo_rejected: !(prev.invoice_back_photo_rejected ?? false),
          };
        }
        return recomputeRecordVerificationStatus(r, photosRef.current);
      });
    }
    setHasUnsavedChanges(true);
  };

  const selectTimelineRow = (category: ViewerCategory, row: TimelineRow) => {
    setViewerCategory(category);
    setSelectedPhoto(timelineRowToRecordPhoto(recordId, row, category));
  };

  const renderTimelineSection = (
    title: string,
    titleColor: string,
    category: ViewerCategory,
    rows: TimelineRow[]
  ) => {
    if (rows.length === 0) return null;
    return (
      <div>
        <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
          <FileText className={`w-4 h-4 ml-2 ${titleColor}`} />
          {title}
        </h5>
        <div className="space-y-3">
          {rows.map(row => (
            <div
              key={`${category}-${row.id}`}
              onClick={() => selectTimelineRow(category, row)}
              className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                selectedPhoto?.id === row.id && viewerCategory === category
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-start gap-2 min-w-0">
                <div className="flex shrink-0 items-center gap-0.5 pt-0.5" dir="ltr">
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      toggleTimelineVerified(category, row);
                    }}
                    className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
                    title={row.verified ? 'إلغاء التدقيق' : 'تدقيق الصورة'}
                  >
                    {row.verified ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-400 hover:text-green-500" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      toggleTimelineRejected(category, row);
                    }}
                    className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
                    title={row.rejected ? 'إلغاء الرفض' : 'رفض الصورة'}
                  >
                    {row.rejected ? (
                      <XCircle className="w-5 h-5 text-red-600" />
                    ) : (
                      <Ban className="w-5 h-5 text-gray-400 hover:text-red-500" />
                    )}
                  </button>
                </div>
                <div className="min-w-0 flex-1 text-right">
                  <div className="flex items-center justify-end gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {row.rowLabel}
                    </span>
                    <FileText className={`w-4 h-4 shrink-0 ${titleColor}`} />
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{formatDate(row.sortDate)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleSave = async () => {
    if (!record) return;

    try {
      setIsUpdatingStatus(true);

      const { allVerified, anyRejected } = computeVerificationAggregates(record, photos);
      const calculatedStatus = allVerified && !anyRejected ? 'مدقق' : 'غير مدقق';

      const updates: any = {
        meter_photo_verified: record.meter_photo_verified,
        invoice_photo_verified: record.invoice_photo_verified,
        invoice_back_photo_verified: record.invoice_back_photo_verified ?? false,
        verification_status: calculatedStatus,
        meter_photo_rejected: record.meter_photo_rejected || false,
        invoice_photo_rejected: record.invoice_photo_rejected || false,
        invoice_back_photo_rejected: record.invoice_back_photo_rejected ?? false,
      };

      console.log('=== Saving to Database ===');
      console.log('Calculated verification status:', calculatedStatus);
      console.log('Updates to save:', updates);
      console.log('Photos to save:', photos.map(p => ({ id: p.id, verified: p.verified })));

      // Update additional photos in database
      for (const photo of photos) {
        await dbOperations.updatePhotoVerification(photo.id, photo.verified);
      }

      // Update main record in database
      console.log('Sending to database:', updates);
      const result = await dbOperations.updateRecord(record.id, updates);
      console.log('Database update result:', result);
      
      // تسجيل إنجاز التدقيق عند جعل السجل مدقق لأول مرة
      if (result && calculatedStatus === 'مدقق' && initialVerificationStatusRef.current !== 'مدقق' && user?.id) {
        try {
          await dbOperations.createActivityLog({
            user_id: user.id,
            action: 'verify_record',
            target_type: 'record',
            target_id: record.id,
            target_name: record.subscriber_name || record.account_number || 'سجل مدقق',
            details: { verification_status: 'مدقق' }
          });
        } catch (e) {
          console.warn('Failed to log verify_record activity:', e);
        }
        initialVerificationStatusRef.current = 'مدقق';
      }
      
      // Mark as saved
      setHasUnsavedChanges(false);
      
      // إبلاغ الجدول بتحديث السجل دون تسجيل verify_record مرة ثانية (تم التسجيل أعلاه)
      if (onRecordUpdate) {
        onRecordUpdate(record.id, updates, { skipVerifyLog: true });
      }
      
      console.log('Photo verification saved to database successfully');
      
    } catch (error) {
      console.error('Error saving photo verification:', error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
    // Reset position when rotating to avoid issues
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ 
        x: e.clientX, 
        y: e.clientY, 
        initialPosition: { x: position.x, y: position.y }
      });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      setPosition({
        x: dragStart.initialPosition.x + deltaX,
        y: dragStart.initialPosition.y + deltaY
      });
      e.preventDefault();
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // دعم اللمس للأجهزة اللوحية
  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoom > 1 && e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ 
        x: touch.clientX, 
        y: touch.clientY, 
        initialPosition: { x: position.x, y: position.y }
      });
      e.preventDefault();
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && zoom > 1 && e.touches.length === 1) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStart.x;
      const deltaY = touch.clientY - dragStart.y;
      
      setPosition({
        x: dragStart.initialPosition.x + deltaX,
        y: dragStart.initialPosition.y + deltaY
      });
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Add wheel event listener with passive: false
  useEffect(() => {
    const handleWheelPassive = (e: Event) => {
      const wheelEvent = e as WheelEvent;
      wheelEvent.preventDefault();
      const zoomStep = 0.2;
      if (wheelEvent.deltaY < 0) {
        setZoom(prev => Math.min(prev + zoomStep, 5));
      } else {
        setZoom(prev => Math.max(prev - zoomStep, 0.5));
      }
    };

    const imageContainer = document.querySelector('.image-container');
    if (imageContainer) {
      imageContainer.addEventListener('wheel', handleWheelPassive, { passive: false });
      return () => {
        imageContainer.removeEventListener('wheel', handleWheelPassive);
      };
    }
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" dir="rtl">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <div className="flex items-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin ml-4"></div>
            <span className="text-gray-700 dark:text-gray-300">جاري تحميل البيانات...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" dir="rtl">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            خطأ في تحميل البيانات
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            لم يتم العثور على السجل المطلوب
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    );
  }

  const meterTimeline = buildMeterTimeline(record, photos);
  const invoiceFaceTimeline = buildInvoiceFaceTimeline(record, photos);
  const invoiceBackTimeline = buildInvoiceBackTimeline(record, photos);
  const allPhotosFlat = [...meterTimeline, ...invoiceFaceTimeline, ...invoiceBackTimeline];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4 space-x-reverse">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              مقارنة الصور - {record.subscriber_name || 'غير محدد'}
              {record.record_number && ` (رقم السجل: ${record.record_number})`}
            </h3>
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
              {(() => {
                if (allPhotosFlat.length === 0) return '0 من 0';
                const currentIndex = allPhotosFlat.findIndex(p => p.id === selectedPhoto?.id);
                const idx = currentIndex >= 0 ? currentIndex : 0;
                return `${formatNumberEn(idx + 1)} من ${formatNumberEn(allPhotosFlat.length)}`;
              })()}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex h-[calc(90vh-120px)]">
          {/* قائمة الصور - الجانب الأيسر */}
          <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
            <div className="p-4">
              <div className="space-y-4">
                {renderTimelineSection('صورة المقياس', 'text-blue-600 dark:text-blue-400', 'meter', meterTimeline)}
                {meterTimeline.length > 0 && invoiceFaceTimeline.length > 0 ? (
                  <div className="border-t border-gray-300 dark:border-gray-600 my-4" />
                ) : null}
                {renderTimelineSection(
                  'صورة الفاتورة (وجه)',
                  'text-green-600 dark:text-green-400',
                  'invoice_face',
                  invoiceFaceTimeline
                )}
                {invoiceFaceTimeline.length > 0 && invoiceBackTimeline.length > 0 ? (
                  <div className="border-t border-gray-300 dark:border-gray-600 my-4" />
                ) : null}
                {renderTimelineSection(
                  'صورة الفاتورة (ظهر)',
                  'text-amber-600 dark:text-amber-400',
                  'invoice_back',
                  invoiceBackTimeline
                )}
              </div>
            </div>
          </div>

          {/* الصورة - الجانب الأيمن */}
          <div className="flex-1 bg-gray-100 dark:bg-gray-700 relative">
            {selectedPhoto && (
              <>
                {/* الصورة مع التحكم المتقدم */}
                <div 
                  className="w-full h-full flex items-center justify-center overflow-hidden image-container"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
                >
                  <img
                    src={selectedPhoto.photo_url}
                    alt={
                      viewerCategory === 'meter'
                        ? 'صورة المقياس'
                        : viewerCategory === 'invoice_face'
                          ? 'صورة الفاتورة وجه'
                          : 'صورة الفاتورة ظهر'
                    }
                    className="max-w-full max-h-full object-contain select-none"
                    style={{ 
                      transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg) scale(${zoom})`,
                      transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                    }}
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                  />
                </div>

                {/* أزرار التحكم المتقدمة */}
                <div className="absolute top-4 left-4 flex flex-col space-y-2">
                  <button
                    onClick={handleZoomIn}
                    className="p-2 bg-white dark:bg-gray-800 shadow-lg rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    title="تكبير"
                  >
                    <ZoomIn className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </button>
                  <button
                    onClick={handleZoomOut}
                    className="p-2 bg-white dark:bg-gray-800 shadow-lg rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    title="تصغير"
                  >
                    <ZoomOut className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </button>
                  <button
                    onClick={handleRotate}
                    className="p-2 bg-white dark:bg-gray-800 shadow-lg rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    title={`دوران (${rotation}°)`}
                  >
                    <RotateCw className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </button>
                  <button
                    onClick={handleReset}
                    className="p-2 bg-white dark:bg-gray-800 shadow-lg rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    title="إعادة تعيين"
                  >
                    <Maximize2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </button>
                </div>

                {/* مؤشر التكبير والدوران */}
                <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 shadow-lg rounded-lg px-3 py-2">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {Math.round(zoom * 100)}%
                    </span>
                    {rotation !== 0 && (
                      <span className="text-sm text-blue-600 dark:text-blue-400">
                        {rotation}°
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* زر الحفظ */}
        {hasUnsavedChanges && (
          <div className="fixed bottom-4 right-4 z-50">
            <button
              onClick={handleSave}
              disabled={isUpdatingStatus}
              className="flex items-center space-x-2 space-x-reverse bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg shadow-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{isUpdatingStatus ? 'جاري الحفظ...' : 'حفظ تدقيق الصور'}</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}