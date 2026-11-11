import { describe, test, expect } from 'vitest';
import { validateUrl, toPingUrl } from '../utils/urlUtils';
import { URL_PATTERN, isUrlSafe } from '../../netlify/functions/lib/types';

describe('every address the form accepts is accepted by the ping API', () => {
  test.each([
    'www.easyskip.uk',
    'www.prostay.com',
    'example.com',
    'example.com/blog/post?a=1',
    'sub.example.co.uk/path/',
    '//www.example.com/page',
    'http://example.com',
    'https://www.example.com/path',
    'HTTPS://EXAMPLE.COM'
  ])('%j', typed => {
    expect(validateUrl(typed).isValid).toBe(true);

    const pingUrl = toPingUrl(typed);
    expect(pingUrl).toMatch(URL_PATTERN);
    expect(isUrlSafe(pingUrl).safe).toBe(true);
  });
});
