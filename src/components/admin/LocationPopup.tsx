import { useState, useEffect } from 'react';
import { X, MapPin, Clock, User, ExternalLink, Navigation, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [selectedLocationIndex, setSelectedLocationIndex] = useState(0);
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

      // ترتيب المواقع حسب الوقت (الأحدث أولاً)
      locationData.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      
      setLocations(locationData);
      setSelectedLocationIndex(0);
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

  const goToPreviousLocation = () => {
    setSelectedLocationIndex(prev => 
      prev > 0 ? prev - 1 : locations.length - 1
    );
  };

  const goToNextLocation = () => {
    setSelectedLocationIndex(prev => 
      prev < locations.length - 1 ? prev + 1 : 0
    );
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
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

  const selectedLocation = locations[selectedLocationIndex];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4 space-x-reverse">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              مقارنة المواقع الجغرافية
            </h3>
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
              {selectedLocationIndex + 1} من {locations.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* قائمة المواقع - الجانب الأيسر */}
          <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
            <div className="p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-4">
                جميع المواقع ({locations.length})
              </h4>
              
              <div className="space-y-3">
                {locations.map((location, index) => (
                  <div
                    key={location.id}
                    onClick={() => setSelectedLocationIndex(index)}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedLocationIndex === index
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
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

              {/* إحصائيات المواقع */}
              {locations.length > 1 && (
                <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h5 className="font-medium text-gray-900 dark:text-white mb-3">
                    إحصائيات المواقع
                  </h5>
                  <div className="space-y-2 text-sm">
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

          {/* الخريطة - الجانب الأيمن */}
          <div className="flex-1 bg-gray-100 dark:bg-gray-700 relative">
            {selectedLocation && (
              <>
                {/* خريطة Google Maps */}
                <div className="w-full h-full">
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
                </div>

                {/* أزرار التنقل */}
                {locations.length > 1 && (
                  <>
                    <button
                      onClick={goToPreviousLocation}
                      className="absolute top-1/2 left-4 transform -translate-y-1/2 bg-white dark:bg-gray-800 shadow-lg rounded-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      title="الموقع السابق"
                    >
                      <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </button>
                    <button
                      onClick={goToNextLocation}
                      className="absolute top-1/2 right-4 transform -translate-y-1/2 bg-white dark:bg-gray-800 shadow-lg rounded-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      title="الموقع التالي"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </button>
                  </>
                )}

              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}