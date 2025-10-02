/**
 * أدوات ضغط وتحسين الصور
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

/**
 * ضغط الصورة
 * @param file ملف الصورة
 * @param options خيارات الضغط
 * @returns ملف الصورة المضغوطة
 */
export const compressImage = (
  file: File, 
  options: CompressionOptions = {}
): Promise<File> => {
  const {
    maxWidth = 800,
    maxHeight = 600,
    quality = 0.8,
    format = 'jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('لا يمكن إنشاء canvas'));
      return;
    }

    const img = new Image();
    
    img.onload = () => {
      try {
        // حساب الأبعاد الجديدة مع الحفاظ على النسبة
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }
        
        // تعيين أبعاد الـ canvas
        canvas.width = width;
        canvas.height = height;
        
        // رسم الصورة
        ctx.drawImage(img, 0, 0, width, height);
        
        // تحويل إلى blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('فشل في ضغط الصورة'));
              return;
            }
            
            const compressedFile = new File([blob], file.name, {
              type: `image/${format}`,
              lastModified: Date.now()
            });
            
            resolve(compressedFile);
          },
          `image/${format}`,
          quality
        );
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('فشل في تحميل الصورة'));
    };
    
    img.src = URL.createObjectURL(file);
  });
};

/**
 * التحقق من حجم الصورة
 * @param file ملف الصورة
 * @param maxSizeInMB الحد الأقصى بالـ MB
 * @returns true إذا كان الحجم مقبولاً
 */
export const validateImageSize = (file: File, maxSizeInMB: number = 5): boolean => {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  return file.size <= maxSizeInBytes;
};

/**
 * التحقق من نوع الصورة
 * @param file ملف الصورة
 * @returns true إذا كان النوع مقبولاً
 */
export const validateImageType = (file: File): boolean => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  return allowedTypes.includes(file.type);
};

/**
 * الحصول على معلومات الصورة
 * @param file ملف الصورة
 * @returns معلومات الصورة
 */
export const getImageInfo = (file: File): Promise<{
  width: number;
  height: number;
  size: number;
  type: string;
  aspectRatio: number;
}> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height,
        size: file.size,
        type: file.type,
        aspectRatio: img.width / img.height
      });
    };
    
    img.onerror = () => {
      reject(new Error('فشل في قراءة معلومات الصورة'));
    };
    
    img.src = URL.createObjectURL(file);
  });
};

/**
 * إنشاء thumbnail للصورة
 * @param file ملف الصورة
 * @param size حجم الـ thumbnail
 * @returns ملف الـ thumbnail
 */
export const createThumbnail = (file: File, size: number = 150): Promise<File> => {
  return compressImage(file, {
    maxWidth: size,
    maxHeight: size,
    quality: 0.7,
    format: 'jpeg'
  });
};

/**
 * تحسين الصورة للويب
 * @param file ملف الصورة
 * @returns ملف الصورة المحسن
 */
export const optimizeForWeb = (file: File): Promise<File> => {
  return compressImage(file, {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.85,
    format: 'webp'
  });
};
