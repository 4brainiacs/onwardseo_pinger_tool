import { describe, test, expect } from 'vitest';
import { validateUrl, normalizeUrl, extractDomain } from '../../utils/urlUtils';

describe('URL Utilities', () => {
  describe('validateUrl', () => {
    test('validates correct URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://sub.example.com',
        'https://example.com/path',
        'http://example.com:8080'
      ];

      validUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    test('invalidates incorrect URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://example.com',
        'http:/example.com',
        'https://',
        ''
      ];

      invalidUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('normalizeUrl', () => {
    test('normalizes URLs correctly', () => {
      const tests = [
        {
          input: 'example.com',
          expected: 'https://example.com'
        },
        {
          input: 'http://www.example.com',
          expected: 'http://example.com'
        },
        {
          input: 'https://example.com/',
          expected: 'https://example.com'
        }
      ];

      tests.forEach(({ input, expected }) => {
        expect(normalizeUrl(input)).toBe(expected);
      });
    });

    test('throws error for invalid URLs', () => {
      expect(() => normalizeUrl('')).toThrow();
      expect(() => normalizeUrl('not-a-url')).toThrow();
    });
  });

  describe('extractDomain', () => {
    test('extracts domains correctly', () => {
      const tests = [
        {
          input: 'https://www.example.com/path',
          expected: 'example.com'
        },
        {
          input: 'http://sub.example.com:8080',
          expected: 'sub.example.com'
        },
        {
          input: 'https://example.com',
          expected: 'example.com'
        }
      ];

      tests.forEach(({ input, expected }) => {
        expect(extractDomain(input)).toBe(expected);
      });
    });

    test('throws error for invalid URLs', () => {
      expect(() => extractDomain('')).toThrow();
      expect(() => extractDomain('invalid')).toThrow();
    });
  });
});