import {
  detectEmail,
  detectPhone,
  detectUrl,
  containsPotentialPii,
} from '../utils/pii-detector.util';

describe('pii-detector.util', () => {
  describe('detectEmail', () => {
    it('should detect standard email addresses', () => {
      expect(detectEmail('john.doe@example.com')).toBe(true);
      expect(detectEmail('user+tag@company.co.uk')).toBe(true);
    });

    it('should not flag normal text as email', () => {
      expect(detectEmail('Hello world')).toBe(false);
      expect(detectEmail('I am a software developer')).toBe(false);
    });

    it('should detect emails embedded in sentences', () => {
      expect(detectEmail('Contact me at dev@example.com for details.')).toBe(true);
    });
  });

  describe('detectPhone', () => {
    it('should detect international phone formats with + prefix', () => {
      expect(detectPhone('+251911234567')).toBe(true);
      expect(detectPhone('+1-555-123-4567')).toBe(true);
    });

    it('should detect phone numbers with spaces and parentheses', () => {
      expect(detectPhone('(555) 123-4567')).toBe(true);
    });

    it('should not flag normal text as phone', () => {
      expect(detectPhone('I have 8 years of experience')).toBe(false);
    });
  });

  describe('detectUrl', () => {
    it('should detect http URLs', () => {
      expect(detectUrl('http://example.com')).toBe(true);
    });

    it('should detect https URLs', () => {
      expect(detectUrl('https://github.com/user')).toBe(true);
    });

    it('should not flag text without URLs', () => {
      expect(detectUrl('This is a normal sentence.')).toBe(false);
    });
  });

  describe('containsPotentialPii', () => {
    it('should return true when email is present', () => {
      expect(containsPotentialPii('Send email to user@test.com')).toBe(true);
    });

    it('should return true when phone is present', () => {
      expect(containsPotentialPii('Call +251911234567')).toBe(true);
    });

    it('should return true when URL is present', () => {
      expect(containsPotentialPii('See https://portfolio.dev')).toBe(true);
    });

    it('should return false for clean text with no PII', () => {
      expect(containsPotentialPii('Just a regular developer biography with no contact info.')).toBe(
        false,
      );
    });
  });
});
