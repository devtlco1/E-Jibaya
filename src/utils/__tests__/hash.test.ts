import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generateRandomPassword, validatePasswordStrength } from '../hash';

describe('Hash Utils', () => {
  describe('hashPassword', () => {
    it('يجب أن يشفر كلمة المرور', async () => {
      const password = 'testpassword123';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are long
    });

    it('يجب أن ينتج hashes مختلفة لنفس كلمة المرور', async () => {
      const password = 'testpassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2); // bcrypt uses random salt
    });
  });

  describe('verifyPassword', () => {
    it('يجب أن يتحقق من كلمة المرور الصحيحة', async () => {
      const password = 'testpassword123';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('يجب أن يرفض كلمة المرور الخاطئة', async () => {
      const password = 'testpassword123';
      const wrongPassword = 'wrongpassword';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });
  });

  describe('generateRandomPassword', () => {
    it('يجب أن ينتج كلمة مرور بالطول المطلوب', () => {
      const password = generateRandomPassword(12);
      expect(password).toHaveLength(12);
    });

    it('يجب أن ينتج كلمة مرور افتراضية بطول 12', () => {
      const password = generateRandomPassword();
      expect(password).toHaveLength(12);
    });

    it('يجب أن ينتج كلمات مرور مختلفة', () => {
      const password1 = generateRandomPassword(10);
      const password2 = generateRandomPassword(10);
      
      expect(password1).not.toBe(password2);
    });
  });

  describe('validatePasswordStrength', () => {
    it('يجب أن يقبل كلمة مرور قوية', () => {
      const strongPassword = 'MyStr0ng!Pass';
      const result = validatePasswordStrength(strongPassword);
      
      expect(result.isValid).toBe(true);
      expect(result.score).toBe(5);
      expect(result.feedback).toHaveLength(0);
    });

    it('يجب أن يرفض كلمة مرور ضعيفة', () => {
      const weakPassword = '123';
      const result = validatePasswordStrength(weakPassword);
      
      expect(result.isValid).toBe(false);
      expect(result.score).toBe(1);
      expect(result.feedback.length).toBeGreaterThan(0);
    });

    it('يجب أن يتحقق من طول كلمة المرور', () => {
      const shortPassword = 'Ab1!';
      const result = validatePasswordStrength(shortPassword);
      
      expect(result.feedback).toContain('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
    });

    it('يجب أن يتحقق من وجود أحرف صغيرة', () => {
      const noLowercase = 'ABC123!@#';
      const result = validatePasswordStrength(noLowercase);
      
      expect(result.feedback).toContain('يجب أن تحتوي على أحرف صغيرة');
    });

    it('يجب أن يتحقق من وجود أحرف كبيرة', () => {
      const noUppercase = 'abc123!@#';
      const result = validatePasswordStrength(noUppercase);
      
      expect(result.feedback).toContain('يجب أن تحتوي على أحرف كبيرة');
    });

    it('يجب أن يتحقق من وجود أرقام', () => {
      const noNumbers = 'Abcdef!@#';
      const result = validatePasswordStrength(noNumbers);
      
      expect(result.feedback).toContain('يجب أن تحتوي على أرقام');
    });

    it('يجب أن يتحقق من وجود رموز خاصة', () => {
      const noSpecialChars = 'Abcdef123';
      const result = validatePasswordStrength(noSpecialChars);
      
      expect(result.feedback).toContain('يجب أن تحتوي على رموز خاصة');
    });
  });
});
