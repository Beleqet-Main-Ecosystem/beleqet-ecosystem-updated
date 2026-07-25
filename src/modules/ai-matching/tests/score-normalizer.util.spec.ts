import { normalizeScore, validateScore } from '../utils/score-normalizer.util';

describe('score-normalizer.util', () => {
  describe('normalizeScore', () => {
    it('should normalize 75 to 0.75 (percentage input)', () => {
      expect(normalizeScore(75)).toBe(0.75);
    });

    it('should return 0.75 unchanged', () => {
      expect(normalizeScore(0.75)).toBe(0.75);
    });

    it('should return 0 unchanged', () => {
      expect(normalizeScore(0)).toBe(0);
    });

    it('should return 1 unchanged', () => {
      expect(normalizeScore(1)).toBe(1);
    });

    it('should treat 1.5 as a percentage → 0.015', () => {
      expect(normalizeScore(1.5)).toBe(0.015);
    });

    it('should clamp -0.5 to 0', () => {
      expect(normalizeScore(-0.5)).toBe(0);
    });

    it('should treat 100 as 1 (percentage → 1.0)', () => {
      expect(normalizeScore(100)).toBe(1);
    });

    it('should clamp 200 to 1 (percentage division yields 2, then clamped)', () => {
      expect(normalizeScore(200)).toBe(1);
    });
  });

  describe('validateScore', () => {
    it('should return true for values between 0 and 1 inclusive', () => {
      expect(validateScore(0)).toBe(true);
      expect(validateScore(0.5)).toBe(true);
      expect(validateScore(1)).toBe(true);
    });

    it('should return false for values outside 0–1', () => {
      expect(validateScore(-0.1)).toBe(false);
      expect(validateScore(1.1)).toBe(false);
      expect(validateScore(75)).toBe(false);
    });
  });
});
