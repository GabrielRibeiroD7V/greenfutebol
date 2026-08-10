import { describe, it, expect } from 'vitest';
import { normalizeBrazilPhone, normalizePhone, isValidBrazilianPhone, maskPhone, technicalEmailFromPhone } from './phone-utils';

describe('phone-utils', () => {
  describe('normalizePhone', () => {
    it('normalizes the documented phone input to E.164', () => {
      expect(normalizeBrazilPhone('(67) 99931-4634')).toBe('+5567999314634');
    });
    it('should normalize phone with mask', () => {
      expect(normalizePhone('(67) 99999-9999')).toBe('+5567999999999');
    });

    it('should normalize phone without mask', () => {
      expect(normalizePhone('67999999999')).toBe('+5567999999999');
    });

    it('should normalize phone already with +55', () => {
      expect(normalizePhone('+5567999999999')).toBe('+5567999999999');
    });

    it('should normalize phone with 55 but no + sign', () => {
      expect(normalizePhone('5567999999999')).toBe('+5567999999999');
    });

    it('should handle incomplete numbers gracefully', () => {
      // Current implementation returns +<digits> for invalid
      expect(normalizePhone('679999')).toBe('+679999');
    });

    it('should handle too long numbers by just prepending +', () => {
      expect(normalizePhone('5567999999999123')).toBe('+5567999999999123');
    });

    it('should remove invalid characters', () => {
      expect(normalizePhone('(67) 99999-9999 abc')).toBe('+5567999999999');
    });

    it('should be idempotent', () => {
      const first = normalizePhone('(67) 99999-9999');
      expect(normalizePhone(first)).toBe(first);
    });
  });

  describe('isValidBrazilianPhone', () => {
    it('should return true for valid E.164 Brazilian mobile', () => {
      expect(isValidBrazilianPhone('+5567999999999')).toBe(true);
    });

    it('should return false for missing + sign', () => {
      expect(isValidBrazilianPhone('5567999999999')).toBe(false);
    });

    it('should return false for invalid DDD/length', () => {
      expect(isValidBrazilianPhone('+55679999999')).toBe(false); // 9 digits
      expect(isValidBrazilianPhone('+15551234567')).toBe(false);
    });
  });

  describe('technicalEmailFromPhone', () => {
    it('derives a deterministic internal email from the normalized phone', () => {
      const phone = normalizeBrazilPhone('(67) 99931-4634');
      expect(technicalEmailFromPhone(phone)).toBe('5567999314634@auth.greensport.internal');
      expect(technicalEmailFromPhone(phone)).toBe(technicalEmailFromPhone(normalizePhone(phone)));
    });

    it('rejects a non-normalized or invalid phone', () => {
      expect(() => technicalEmailFromPhone('67999999999')).toThrow();
    });
  });

  describe('maskPhone', () => {
    it('should apply mask as user types', () => {
      expect(maskPhone('6')).toBe('(6');
      expect(maskPhone('67')).toBe('(67');
      expect(maskPhone('679')).toBe('(67) 9');
      expect(maskPhone('6799999')).toBe('(67) 9999-9');
      expect(maskPhone('67999999999')).toBe('(67) 99999-9999');
    });
  });
});
