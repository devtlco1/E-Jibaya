/**
 * نظام تحديد معدل الطلبات للحماية من الهجمات
 */
class RateLimiter {
  private attempts: Map<string, { count: number; resetTime: number }> = new Map();
  
  /**
   * التحقق من السماح بالطلب
   * @param key معرف المستخدم أو IP
   * @param maxAttempts الحد الأقصى للطلبات
   * @param windowMs نافذة الوقت بالميلي ثانية
   * @returns true إذا كان مسموحاً
   */
  isAllowed(key: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): boolean {
    const now = Date.now();
    const userAttempts = this.attempts.get(key);
    
    // إذا لم توجد محاولات سابقة أو انتهت النافذة الزمنية
    if (!userAttempts || now > userAttempts.resetTime) {
      this.attempts.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    // إذا تجاوز الحد الأقصى
    if (userAttempts.count >= maxAttempts) {
      return false;
    }
    
    // زيادة العداد
    userAttempts.count++;
    return true;
  }
  
  /**
   * الحصول على عدد المحاولات المتبقية
   * @param key معرف المستخدم
   * @param maxAttempts الحد الأقصى
   * @returns عدد المحاولات المتبقية
   */
  getRemainingAttempts(key: string, maxAttempts: number = 5): number {
    const userAttempts = this.attempts.get(key);
    if (!userAttempts || Date.now() > userAttempts.resetTime) {
      return maxAttempts;
    }
    return Math.max(0, maxAttempts - userAttempts.count);
  }
  
  /**
   * الحصول على وقت إعادة التعيين
   * @param key معرف المستخدم
   * @returns وقت إعادة التعيين بالميلي ثانية
   */
  getResetTime(key: string): number | null {
    const userAttempts = this.attempts.get(key);
    if (!userAttempts || Date.now() > userAttempts.resetTime) {
      return null;
    }
    return userAttempts.resetTime;
  }
  
  /**
   * مسح جميع المحاولات
   */
  clear(): void {
    this.attempts.clear();
  }
  
  /**
   * مسح محاولات مستخدم معين
   * @param key معرف المستخدم
   */
  clearUser(key: string): void {
    this.attempts.delete(key);
  }
  
  /**
   * تنظيف المحاولات المنتهية الصلاحية
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, attempts] of this.attempts.entries()) {
      if (now > attempts.resetTime) {
        this.attempts.delete(key);
      }
    }
  }
}

// إنشاء مثيل واحد للاستخدام في التطبيق
export const rateLimiter = new RateLimiter();

// تنظيف دوري كل 5 دقائق
setInterval(() => {
  rateLimiter.cleanup();
}, 5 * 60 * 1000);
