import { describe, it, expect } from 'vitest';
import { clamp } from '../src/utils/math.js';

describe('Math utils', () => {
  describe('clamp', () => {
    it('should clamp values within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should handle edge cases', () => {
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
      expect(clamp(5, 5, 5)).toBe(5);
    });

    it('should work with negative ranges', () => {
      expect(clamp(-5, -10, -1)).toBe(-5);
      expect(clamp(-15, -10, -1)).toBe(-10);
      expect(clamp(5, -10, -1)).toBe(-1);
    });

    it('should work with fractional numbers', () => {
      expect(clamp(5.5, 0, 10)).toBe(5.5);
      expect(clamp(-0.5, 0, 10)).toBe(0);
      expect(clamp(10.1, 0, 10)).toBe(10);
    });

    it('should handle reversed bounds by swapping them', () => {
      expect(clamp(5, 10, 0)).toBe(5);
      expect(clamp(-5, -1, -10)).toBe(-5);
    });

    it('should return NaN when any argument is NaN', () => {
      expect(clamp(NaN, 0, 10)).toBeNaN();
      expect(clamp(5, NaN, 10)).toBeNaN();
      expect(clamp(5, 0, NaN)).toBeNaN();
    });

    it('should respect infinity bounds', () => {
      expect(clamp(5, -Infinity, Infinity)).toBe(5);
      expect(clamp(Infinity, -10, 10)).toBe(10);
      expect(clamp(-Infinity, -10, 10)).toBe(-10);
    });
  });
});