import { useState, useEffect } from 'react';
import { X, FileText, MessageSquare, ZoomIn, ZoomOut, RotateCw, Maximize2 } from 'lucide-react';
import { formatDateTime } from '../../utils/dateFormatter';
import { dbOperations } from '../../lib/supabase';
import { CollectionRecord, RecordPhoto } from '../../types';

interface PhotoComparisonProps {
  recordId: string;
  onClose: () => void;
}

export function PhotoComparison({ recordId, onClose }: PhotoComparisonProps) {
  const [record, setRecord] = useState<CollectionRecord | null>(null);
  const [photos, setPhotos] = useState<RecordPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhotoType, setSelectedPhotoType] = useState<'meter' | 'invoice'>('meter');
  const [selectedPhoto, setSelectedPhoto] = useState<RecordPhoto | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, initialPosition: { x: 0, y: 0 } });

  useEffect(() => {
    loadRecordData();
  }, [recordId]);

  const loadRecordData = async () => {
    try {
      setLoading(true);
      const { record: recordData, photos: photosData } = await dbOperations.getRecordWithPhotos(recordId);
      setRecord(recordData);
      setPhotos(photosData);
      
      // Set first photo as selected
      if (photosData.length > 0) {
        setSelectedPhoto(photosData[0]);
        setSelectedPhotoType(photosData[0].photo_type);
      }
    } catch (error) {
      console.error('Error loading record data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOriginalPhotos = () => {
    if (!record) return { meter: null, invoice: null };
    
    return {
      meter: record.meter_photo_url ? {
        id: 'original-meter',
        photo_url: record.meter_photo_url,
        photo_type: 'meter' as const,
        photo_date: record.submitted_at,
        created_by: record.field_agent_id
      } : null,
      invoice: record.invoice_photo_url ? {
        id: 'original-invoice',
        photo_url: record.invoice_photo_url,
        photo_type: 'invoice' as const,
        photo_date: record.submitted_at,
        created_by: record.field_agent_id
      } : null
    };
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

  const handlePhotoVerification = async (photoType: 'meter' | 'invoice') => {
    if (!record) return;

    try {
      const updateData = {
        [`${photoType}_photo_verified`]: !record[`${photoType}_photo_verified` as keyof CollectionRecord]
      };

      await dbOperations.updateRecord(record.id, updateData);
      
      // Update local state
      setRecord(prev => prev ? {
        ...prev,
        [`${photoType}_photo_verified`]: !prev[`${photoType}_photo_verified` as keyof CollectionRecord]
      } : null);

      console.log(`${photoType} photo verification toggled`);
    } catch (error) {
      console.error('Error updating photo verification:', error);
    }
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
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

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomStep = 0.2; // تقليل خطوة التكبير لحركة أسرع
    if (e.deltaY < 0) {
      setZoom(prev => Math.min(prev + zoomStep, 5));
    } else {
      setZoom(prev => Math.max(prev - zoomStep, 0.5));
    }
  };

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

  const originalPhotos = getOriginalPhotos();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4 space-x-reverse">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              مقارنة الصور - {record.subscriber_name || 'غير محدد'}
            </h3>
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
              {(() => {
                const allPhotos = [...(originalPhotos.meter ? [originalPhotos.meter] : []), ...(originalPhotos.invoice ? [originalPhotos.invoice] : []), ...photos];
                const currentIndex = allPhotos.findIndex(photo => photo.id === selectedPhoto?.id);
                return `${currentIndex + 1} من ${allPhotos.length}`;
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
                {/* صور المقياس */}
                <div>
                  <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 ml-2" />
                    صور المقياس
                  </h5>
                  <div className="space-y-3">
                    {originalPhotos.meter && (
                      <div
                        onClick={() => {
                          setSelectedPhotoType('meter');
                          setSelectedPhoto(originalPhotos.meter ? {
                            ...originalPhotos.meter,
                            record_id: recordId,
                            created_at: originalPhotos.meter.photo_date,
                            notes: null
                          } : null);
                        }}
                        className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                          selectedPhotoType === 'meter' && selectedPhoto?.id === 'original-meter'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 ml-2" />
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                الصورة الأصلية
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {formatDate(originalPhotos.meter.photo_date)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* صور المقياس الإضافية */}
                    {photos.filter(photo => photo.photo_type === 'meter').map((photo, index) => (
                      <div
                        key={photo.id}
                        onClick={() => {
                          setSelectedPhotoType('meter');
                          setSelectedPhoto(photo);
                        }}
                        className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                          selectedPhoto?.id === photo.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 ml-2" />
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                صورة إضافية #{index + 1}
                              </span>
                              {photo.notes && (
                                <MessageSquare className="w-3 h-3 text-blue-500 ml-1" />
                              )}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {formatDate(photo.created_at)}
                            </div>
                            {photo.notes && (
                              <div className="text-xs text-red-600 dark:text-red-400 font-bold mt-1 truncate">
                                {photo.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* فاصل */}
                <div className="border-t border-gray-300 dark:border-gray-600 my-4"></div>

                {/* صور الفاتورة */}
                <div>
                  <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                    <FileText className="w-4 h-4 text-green-600 dark:text-green-400 ml-2" />
                    صور الفاتورة
                  </h5>
                  <div className="space-y-3">
                    {originalPhotos.invoice && (
                      <div
                        onClick={() => {
                          setSelectedPhotoType('invoice');
                          setSelectedPhoto(originalPhotos.invoice ? {
                            ...originalPhotos.invoice,
                            record_id: recordId,
                            created_at: originalPhotos.invoice.photo_date,
                            notes: null
                          } : null);
                        }}
                        className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                          selectedPhotoType === 'invoice' && selectedPhoto?.id === 'original-invoice'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <FileText className="w-4 h-4 text-green-600 dark:text-green-400 ml-2" />
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                الصورة الأصلية
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {formatDate(originalPhotos.invoice.photo_date)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* صور الفاتورة الإضافية */}
                    {photos.filter(photo => photo.photo_type === 'invoice').map((photo, index) => (
                      <div
                        key={photo.id}
                        onClick={() => {
                          setSelectedPhotoType('invoice');
                          setSelectedPhoto(photo);
                        }}
                        className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                          selectedPhoto?.id === photo.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <FileText className="w-4 h-4 text-green-600 dark:text-green-400 ml-2" />
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                صورة إضافية #{index + 1}
                              </span>
                              {photo.notes && (
                                <MessageSquare className="w-3 h-3 text-blue-500 ml-1" />
                              )}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {formatDate(photo.created_at)}
                            </div>
                            {photo.notes && (
                              <div className="text-xs text-red-600 dark:text-red-400 font-bold mt-1 truncate">
                                {photo.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* الصورة - الجانب الأيمن */}
          <div className="flex-1 bg-gray-100 dark:bg-gray-700 relative">
            {selectedPhoto && (
              <>
                {/* الصورة مع التحكم المتقدم */}
                <div 
                  className="w-full h-full flex items-center justify-center overflow-hidden"
                  onWheel={handleWheel}
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
                    alt={`${selectedPhoto.photo_type === 'meter' ? 'صورة المقياس' : 'صورة الفاتورة'}`}
                    className="max-w-full max-h-full object-contain select-none"
                    style={{ 
                      transform: `scale(${zoom}) rotate(${rotation}deg) translate(${position.x}px, ${position.y}px)`,
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
                    title="دوران"
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

                {/* مؤشر التكبير */}
                <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 shadow-lg rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {Math.round(zoom * 100)}%
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer with verification buttons */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 space-x-reverse">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                تدقيق الصور:
              </span>
              <div className="flex items-center space-x-2 space-x-reverse">
                <button
                  onClick={() => handlePhotoVerification('meter')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    record?.meter_photo_verified
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-900/30'
                  }`}
                >
                  {record?.meter_photo_verified ? '✓ صورة المقياس مدققة' : 'تدقيق صورة المقياس'}
                </button>
                <button
                  onClick={() => handlePhotoVerification('invoice')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    record?.invoice_photo_verified
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-900/30'
                  }`}
                >
                  {record?.invoice_photo_verified ? '✓ صورة الفاتورة مدققة' : 'تدقيق صورة الفاتورة'}
                </button>
              </div>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}