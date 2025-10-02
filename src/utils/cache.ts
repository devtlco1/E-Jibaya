/**
 * نظام التخزين المؤقت لتحسين الأداء
 */
class CacheService {
  private cache = new Map<string, { data: any; expiry: number; hits: number }>();
  private maxSize = 1000; // الحد الأقصى للعناصر
  private defaultTTL = 5 * 60 * 1000; // 5 دقائق افتراضياً
  
  /**
   * حفظ البيانات في التخزين المؤقت
   * @param key المفتاح
   * @param data البيانات
   * @param ttl مدة الصلاحية بالميلي ثانية
   */
  set(key: string, data: any, ttl: number = this.defaultTTL): void {
    // تنظيف التخزين المؤقت إذا تجاوز الحد الأقصى
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
    }
    
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
      hits: 0
    });
  }
  
  /**
   * استرجاع البيانات من التخزين المؤقت
   * @param key المفتاح
   * @returns البيانات أو null إذا انتهت الصلاحية
   */
  get(key: string): any | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    // التحقق من انتهاء الصلاحية
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    // زيادة عدد الاستخدامات
    item.hits++;
    return item.data;
  }
  
  /**
   * التحقق من وجود البيانات
   * @param key المفتاح
   * @returns true إذا كانت البيانات موجودة وصالحة
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }
  
  /**
   * حذف عنصر من التخزين المؤقت
   * @param key المفتاح
   */
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * مسح جميع البيانات
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * الحصول على إحصائيات التخزين المؤقت
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    totalHits: number;
  } {
    let totalHits = 0;
    for (const item of this.cache.values()) {
      totalHits += item.hits;
    }
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.cache.size > 0 ? totalHits / this.cache.size : 0,
      totalHits
    };
  }
  
  /**
   * تنظيف البيانات المنتهية الصلاحية
   */
  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.cache.delete(key));
  }
  
  /**
   * تنظيف العناصر الأقل استخداماً
   */
  evictLRU(): void {
    if (this.cache.size < this.maxSize) {
      return;
    }
    
    // ترتيب العناصر حسب عدد الاستخدامات
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].hits - b[1].hits);
    
    // حذف 10% من العناصر الأقل استخداماً
    const toDelete = Math.floor(entries.length * 0.1);
    for (let i = 0; i < toDelete; i++) {
      this.cache.delete(entries[i][0]);
    }
  }
}

// إنشاء مثيل واحد للاستخدام في التطبيق
export const cacheService = new CacheService();

// تنظيف دوري كل دقيقة
setInterval(() => {
  cacheService.cleanup();
}, 60 * 1000);
