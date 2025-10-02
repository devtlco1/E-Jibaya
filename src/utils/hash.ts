import bcrypt from 'bcryptjs';

/**
 * تشفير كلمة المرور باستخدام bcrypt
 * @param password كلمة المرور النصية
 * @returns كلمة المرور المشفرة
 */
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

/**
 * التحقق من كلمة المرور
 * @param password كلمة المرور النصية
 * @param hash كلمة المرور المشفرة
 * @returns true إذا كانت كلمة المرور صحيحة
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

/**
 * إنشاء كلمة مرور عشوائية قوية
 * @param length طول كلمة المرور
 * @returns كلمة مرور عشوائية
 */
export const generateRandomPassword = (length: number = 12): string => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  return password;
};

/**
 * التحقق من قوة كلمة المرور
 * @param password كلمة المرور
 * @returns معلومات عن قوة كلمة المرور
 */
export const validatePasswordStrength = (password: string): {
  isValid: boolean;
  score: number;
  feedback: string[];
} => {
  const feedback: string[] = [];
  let score = 0;

  // طول كلمة المرور
  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
  }

  // وجود أحرف صغيرة
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('يجب أن تحتوي على أحرف صغيرة');
  }

  // وجود أحرف كبيرة
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('يجب أن تحتوي على أحرف كبيرة');
  }

  // وجود أرقام
  if (/\d/.test(password)) {
    score += 1;
  } else {
    feedback.push('يجب أن تحتوي على أرقام');
  }

  // وجود رموز خاصة
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score += 1;
  } else {
    feedback.push('يجب أن تحتوي على رموز خاصة');
  }

  return {
    isValid: score >= 4,
    score,
    feedback
  };
};
