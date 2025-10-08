import { useState, useEffect } from 'react';
import { X, Download, Eye, FileText, MessageSquare, ZoomIn, ZoomOut } from 'lucide-react';
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

  const getPhotosByType = (type: 'meter' | 'invoice') => {
    return photos.filter(photo => photo.photo_type === type);
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

  const downloadPhoto = (photoUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = photoUrl;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateString: string) => {
    return formatDateTime(dateString);
  };



  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" dir="rtl">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <div className="flex items-center">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin ml-3"></div>
            <span className="text-gray-700 dark:text-gray-300">جاري تحميل البيانات...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" dir="rtl">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <div className="text-center">
            <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
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
      </div>
    );
  }

  const originalPhotos = getOriginalPhotos();
  const meterPhotos = getPhotosByType('meter');
  const invoicePhotos = getPhotosByType('invoice');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              مقارنة الصور - {record.subscriber_name || 'غير محدد'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              رقم الحساب: {record.account_number} | رقم المقياس: {record.meter_number || 'غير محدد'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex h-[calc(90vh-120px)]">
          {/* Left Sidebar - Photo Types */}
          <div className="w-64 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800">
            <div className="space-y-4">
              {/* Meter Photos */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <FileText className="w-4 h-4 ml-2" />
                  صور المقياس
                </h3>
                <div className="space-y-2">
                  {originalPhotos.meter && (
                    <button
                      onClick={() => {
                        setSelectedPhotoType('meter');
                        setSelectedPhoto(originalPhotos.meter ? {
                          ...originalPhotos.meter,
                          record_id: recordId,
                          created_at: originalPhotos.meter.photo_date,
                          notes: null
                        } : null);
                      }}
                      className={`w-full text-right p-2 rounded-lg text-sm transition-colors ${
                        selectedPhotoType === 'meter' && selectedPhoto?.id === 'original-meter'
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                          : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="font-medium">الصورة الأصلية</div>
                      <div className="text-xs text-gray-500">
                        {formatDate(originalPhotos.meter.photo_date)}
                      </div>
                    </button>
                  )}
                  {meterPhotos.map((photo) => (
                    <button
                      key={photo.id}
                      onClick={() => {
                        setSelectedPhotoType('meter');
                        setSelectedPhoto(photo);
                      }}
                      className={`w-full text-right p-2 rounded-lg text-sm transition-colors ${
                        selectedPhotoType === 'meter' && selectedPhoto?.id === photo.id
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                          : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="font-medium flex items-center gap-1">
                        صورة إضافية
                        {photo.notes && (
                          <MessageSquare className="w-3 h-3 text-blue-500" />
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(photo.created_at)}
                      </div>
                      {photo.notes && (
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                          {photo.notes}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Invoice Photos */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <FileText className="w-4 h-4 ml-2" />
                  صور الفاتورة
                </h3>
                <div className="space-y-2">
                  {originalPhotos.invoice && (
                    <button
                      onClick={() => {
                        setSelectedPhotoType('invoice');
                        setSelectedPhoto(originalPhotos.invoice ? {
                          ...originalPhotos.invoice,
                          record_id: recordId,
                          created_at: originalPhotos.invoice.photo_date,
                          notes: null
                        } : null);
                      }}
                      className={`w-full text-right p-2 rounded-lg text-sm transition-colors ${
                        selectedPhotoType === 'invoice' && selectedPhoto?.id === 'original-invoice'
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                          : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="font-medium">الصورة الأصلية</div>
                      <div className="text-xs text-gray-500">
                        {formatDate(originalPhotos.invoice.photo_date)}
                      </div>
                    </button>
                  )}
                  {invoicePhotos.map((photo) => (
                    <button
                      key={photo.id}
                      onClick={() => {
                        setSelectedPhotoType('invoice');
                        setSelectedPhoto(photo);
                      }}
                      className={`w-full text-right p-2 rounded-lg text-sm transition-colors ${
                        selectedPhotoType === 'invoice' && selectedPhoto?.id === photo.id
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                          : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="font-medium flex items-center gap-1">
                        صورة إضافية
                        {photo.notes && (
                          <MessageSquare className="w-3 h-3 text-blue-500" />
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(photo.created_at)}
                      </div>
                      {photo.notes && (
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                          {photo.notes}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content - Photo Display */}
          <div className="flex-1 flex flex-col">
            {selectedPhoto ? (
              <>
                {/* Simple Download Button */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex justify-end">
                    <button
                      onClick={() => downloadPhoto(
                        selectedPhoto.photo_url,
                        `${selectedPhoto.photo_type}_${selectedPhoto.id}.jpg`
                      )}
                      className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                    >
                      <Download className="w-4 h-4 ml-2" />
                      تحميل
                    </button>
                  </div>
                </div>

                {/* Photo Display with Zoom */}
                <div className="flex-1 p-4 flex items-center justify-center bg-gray-100 dark:bg-gray-900 overflow-auto relative">
                  <div className="relative">
                    <img
                      src={selectedPhoto.photo_url}
                      alt={`${selectedPhoto.photo_type === 'meter' ? 'صورة المقياس' : 'صورة الفاتورة'}`}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-lg transition-transform duration-200 cursor-zoom-in"
                      style={{ transform: `scale(${zoom})` }}
                      onClick={() => setZoom(zoom === 1 ? 2 : 1)}
                    />
                    
                    {/* Zoom Controls */}
                    <div className="absolute top-4 left-4 flex flex-col space-y-2">
                      <button
                        onClick={() => setZoom(Math.min(zoom + 0.5, 3))}
                        className="p-2 bg-white dark:bg-gray-800 shadow-lg rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        title="تكبير"
                      >
                        <ZoomIn className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                      </button>
                      <button
                        onClick={() => setZoom(Math.max(zoom - 0.5, 0.5))}
                        className="p-2 bg-white dark:bg-gray-800 shadow-lg rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        title="تصغير"
                      >
                        <ZoomOut className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                      </button>
                      <button
                        onClick={() => setZoom(1)}
                        className="p-2 bg-white dark:bg-gray-800 shadow-lg rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs text-gray-600 dark:text-gray-300"
                        title="إعادة تعيين"
                      >
                        100%
                      </button>
                    </div>
                  </div>
                </div>

                {/* Photo Notes */}
                {selectedPhoto.notes && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
                    <div className="flex items-start gap-3">
                      <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                          ملاحظة المحصل
                        </h4>
                        <p className="text-blue-800 dark:text-blue-200 leading-relaxed font-medium">
                          {selectedPhoto.notes}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Eye className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    لا توجد صور متاحة
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    اختر نوع الصورة من القائمة الجانبية
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
