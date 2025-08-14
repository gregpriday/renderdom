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
  });
});