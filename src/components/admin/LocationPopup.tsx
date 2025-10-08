import React, { useState, useEffect } from 'react';
import { X, MapPin, Clock, User, ExternalLink, Navigation, Layers } from 'lucide-react';
import { dbOperations } from '../../lib/supabase';
import { formatDateTime } from '../../utils/dateFormatter';

interface LocationData {
  id: string;
  gps_latitude: number;
  gps_longitude: number;
  submitted_at: string;
  updated_at: string;
  field_agent_id: string | null;
  notes?: string;
}

interface LocationPopupProps {
  recordId: string;
  onClose: () => void;
}

export function LocationPopup({ recordId, onClose }: LocationPopupProps) {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    loadLocationData();
    loadUsers();
  }, [recordId]);

  const loadLocationData = async () => {
    try {
      setLoading(true);
      
      // جلب السجل الأساسي
      const { record } = await dbOperations.getRecordWithPhotos(recordId);
      
      if (!record) {
        setLocations([]);
        return;
      }

      const locationData: LocationData[] = [];

      // إضافة الموقع الأساسي للسجل
      if (record.gps_latitude && record.gps_longitude) {
        locationData.push({
          id: record.id,
          gps_latitude: record.gps_latitude,
          gps_longitude: record.gps_longitude,
          submitted_at: record.submitted_at,
          updated_at: record.updated_at,
          field_agent_id: record.field_agent_id,
          notes: record.notes || undefined
        });
      }

      // جلب جميع الصور الإضافية مع المواقع
      const photos = await dbOperations.getRecordPhotos(recordId);
      
      // إضافة المواقع من الصور الإضافية (إذا كانت تحتوي على معلومات موقع)
      photos.forEach(photo => {
        // يمكن إضافة منطق هنا لجلب معلومات الموقع من الصور إذا كانت متاحة
        // حالياً سنركز على الموقع الأساسي للسجل
      });

      // ترتيب المواقع حسب الوقت (الأحدث أولاً)
      locationData.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      
      setLocations(locationData);
      
      // تحديد أول موقع كافتراضي
      if (locationData.length > 0) {
        setSelectedLocation(locationData[0]);
      }
    } catch (error) {
      console.error('Error loading location data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const userData = await dbOperations.getUsers();
      setUsers(userData);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return 'غير محدد';
    const user = users.find(u => u.id === userId);
    if (!user) return 'مستخدم محذوف';
    
    if (user.username.includes('(محذوف)')) {
      return `${user.full_name} (محذوف)`;
    }
    
    return user.full_name;
  };

  const openInGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://maps.google.com/?q=${lat},${lng}`, '_blank');
  };

  const openInGoogleMapsDirections = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="mr-3 text-gray-600 dark:text-gray-400">جاري تحميل المواقع...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                المواقع الجغرافية
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="text-center py-12">
              <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                لا توجد مواقع متاحة
              </h4>
              <p className="text-gray-600 dark:text-gray-400">
                لم يتم تحديد موقع جغرافي لهذا السجل
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              المواقع الجغرافية ({locations.length})
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[70vh]">
            {/* قائمة المواقع */}
            <div className="lg:col-span-1 overflow-y-auto">
              <div className="space-y-3">
                {locations.map((location, index) => (
                  <div
                    key={location.id}
                    onClick={() => setSelectedLocation(location)}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedLocation?.id === location.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 ml-2" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            موقع #{index + 1}
                          </span>
                        </div>
                        
                        <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                          <div className="flex items-center">
                            <Clock className="w-3 h-3 ml-1" />
                            <span>{formatDateTime(location.updated_at)}</span>
                          </div>
                          
                          <div className="flex items-center">
                            <User className="w-3 h-3 ml-1" />
                            <span>{getUserName(location.field_agent_id)}</span>
                          </div>
                          
                          <div className="text-xs font-mono">
                            {location.gps_latitude.toFixed(6)}, {location.gps_longitude.toFixed(6)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col space-y-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openInGoogleMaps(location.gps_latitude, location.gps_longitude);
                          }}
                          className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          title="عرض في الخريطة"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openInGoogleMapsDirections(location.gps_latitude, location.gps_longitude);
                          }}
                          className="p-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                          title="التوجه للموقع"
                        >
                          <Navigation className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* الخريطة التفاعلية */}
            <div className="lg:col-span-2">
              {selectedLocation ? (
                <div className="h-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                  {/* خريطة Google Maps مدمجة */}
                  <iframe
                    src={`https://www.google.com/maps/embed/v1/view?center=${selectedLocation.gps_latitude},${selectedLocation.gps_longitude}&zoom=18&maptype=satellite`}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="خريطة الموقع"
                  />
                  
                  {/* معلومات الموقع المحدد */}
                  <div className="absolute bottom-4 left-4 right-4 bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                          الموقع المحدد
                        </h4>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          <div className="flex items-center">
                            <Clock className="w-3 h-3 ml-1" />
                            <span>{formatDateTime(selectedLocation.updated_at)}</span>
                          </div>
                          <div className="flex items-center">
                            <User className="w-3 h-3 ml-1" />
                            <span>{getUserName(selectedLocation.field_agent_id)}</span>
                          </div>
                          <div className="text-xs font-mono">
                            {selectedLocation.gps_latitude.toFixed(6)}, {selectedLocation.gps_longitude.toFixed(6)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2 space-x-reverse">
                        <button
                          onClick={() => openInGoogleMaps(selectedLocation.gps_latitude, selectedLocation.gps_longitude)}
                          className="inline-flex items-center px-3 py-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg text-sm hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4 ml-1" />
                          فتح في الخريطة
                        </button>
                        <button
                          onClick={() => openInGoogleMapsDirections(selectedLocation.gps_latitude, selectedLocation.gps_longitude)}
                          className="inline-flex items-center px-3 py-2 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-lg text-sm hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                        >
                          <Navigation className="w-4 h-4 ml-1" />
                          التوجه
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <div className="text-center">
                    <Layers className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      اختر موقعاً لعرضه على الخريطة
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* إحصائيات المواقع */}
          {locations.length > 1 && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                إحصائيات المواقع
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">إجمالي المواقع:</span>
                  <p className="text-gray-900 dark:text-white font-medium">{locations.length}</p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">أول موقع:</span>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {formatDateTime(locations[locations.length - 1].updated_at)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">آخر موقع:</span>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {formatDateTime(locations[0].updated_at)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
