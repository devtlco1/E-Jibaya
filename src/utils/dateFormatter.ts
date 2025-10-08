/**
 * دالة موحدة لتنسيق التاريخ والوقت في جميع أنحاء النظام
 * الصيغة المطلوبة: "3 أكتوبر 2025 في 02:11 م"
 */

// أسماء الأشهر باللغة العربية
const arabicMonths = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

/**
 * تنسيق التاريخ والوقت بالصيغة المطلوبة
 * @param dateString - تاريخ بصيغة ISO string أو Date object
 * @returns تاريخ ووقت منسق باللغة العربية
 */
export function formatDateTime(dateString: string | Date): string {
  try {
    const date = new Date(dateString);
    
    // التحقق من صحة التاريخ
    if (isNaN(date.getTime())) {
      return 'تاريخ غير صحيح';
    }

    // التحقق من أن التاريخ ليس في المستقبل البعيد (أكثر من سنة من الآن)
    const now = new Date();
    const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    if (date > oneYearFromNow) {
      console.warn('Date seems to be in the future:', dateString);
      return 'تاريخ غير صحيح';
    }

    // استخراج مكونات التاريخ
    const day = date.getDate();
    const month = arabicMonths[date.getMonth()];
    const year = date.getFullYear();
    
    // تنسيق الوقت
    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    // تحويل إلى 12 ساعة
    const isPM = hours >= 12;
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const displayMinutes = minutes.toString().padStart(2, '0');
    const period = isPM ? 'م' : 'ص';
    
    // إرجاع التاريخ والوقت منسق
    return `${day} ${month} ${year} في ${displayHours.toString().padStart(2, '0')}:${displayMinutes} ${period}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'تاريخ غير صحيح';
  }
}

/**
 * تنسيق التاريخ فقط (بدون وقت)
 * @param dateString - تاريخ بصيغة ISO string أو Date object
 * @returns تاريخ منسق باللغة العربية
 */
export function formatDate(dateString: string | Date): string {
  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return 'تاريخ غير صحيح';
    }

    const day = date.getDate();
    const month = arabicMonths[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day} ${month} ${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'تاريخ غير صحيح';
  }
}

/**
 * تنسيق الوقت فقط (بدون تاريخ)
 * @param dateString - تاريخ بصيغة ISO string أو Date object
 * @returns وقت منسق باللغة العربية
 */
export function formatTime(dateString: string | Date): string {
  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return 'وقت غير صحيح';
    }

    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    const isPM = hours >= 12;
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const displayMinutes = minutes.toString().padStart(2, '0');
    const period = isPM ? 'م' : 'ص';
    
    return `${displayHours.toString().padStart(2, '0')}:${displayMinutes} ${period}`;
  } catch (error) {
    console.error('Error formatting time:', error);
    return 'وقت غير صحيح';
  }
}

/**
 * تنسيق التاريخ والوقت للنسخ الاحتياطية (اسم الملف)
 * @param dateString - تاريخ بصيغة ISO string أو Date object
 * @returns تاريخ ووقت منسق لاسم الملف
 */
export function formatDateTimeForFilename(dateString: string | Date): string {
  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return 'invalid-date';
    }

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  } catch (error) {
    console.error('Error formatting date for filename:', error);
    return 'invalid-date';
  }
}
