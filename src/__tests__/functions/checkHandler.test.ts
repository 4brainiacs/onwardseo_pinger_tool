// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { UrlCheck } from '../../../netlify/functions/lib/urlcheck';

const mocks = vi.hoisted(() => ({
  checkUrl: vi.fn()
}));

vi.mock('../../../netlify/functions/lib/urlcheck', () => ({ checkUrl: mocks.checkUrl }));

import handler, { config } from '../../../netlify/functions/check.mjs';

const ENDPOINT = 'https://tools.example/api/check';

function okCheck(input: string): UrlCheck {
  return { input, pingUrl: input, finalUrl: input, canonicalUrl: null, status: 200, verdict: 'ok', note: '' };
}

function notFound(input: string): UrlCheck {
  return {
    input, pingUrl: null, finalUrl: input, canonicalUrl: null, status: 404,
    verdict: 'not_found', note: 'Not pinged: page not found (HTTP 404)'
  };
}

function post(body: string, headers: Record<string, string> = {}): Promise<Response> {
  return handler(new Request(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body
  }));
}

async function check(urls: unknown): Promise<{ status: number; body: { checks?: UrlCheck[]; error?: string } }> {
  const response = await post(JSON.stringify({ urls }));
  return { status: response.status, body: await response.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkUrl.mockImplementation(async (url: string) => okCheck(url));
});

describe('/api/check', () => {
  test('is served at /api/check', () => {
    expect(config).toEqual({ path: '/api/check' });
  });

  test('invalid JSON is rejected with 400, as /api/ping does', async () => {
    const response = await post('{not json');

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid JSON body' });
    expect(mocks.checkUrl).not.toHaveBeenCalled();
  });

  test('a body without urls is rejected with 400', async () => {
    const response = await post(JSON.stringify({ addresses: ['https://example.com'] }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Missing required field: urls (array)' });
    expect(mocks.checkUrl).not.toHaveBeenCalled();
  });

  test('6 URLs are rejected with 400', async () => {
    const urls = [1, 2, 3, 4, 5, 6].map(n => `https://example.com/${n}`);

    expect(await check(urls)).toEqual({ status: 400, body: { error: 'Maximum 5 URLs allowed, received 6' } });
    expect(mocks.checkUrl).not.toHaveBeenCalled();
  });

  test.each([
    [['www.example.com'], 'Invalid URL format: www.example.com'],
    [['ftp://example.com/'], 'Invalid URL format: ftp://example.com/'],
    [['http://localhost/admin'], 'Security: http://localhost/admin: Localhost URLs are not allowed'],
    [['http://192.168.1.1/'], 'Security: http://192.168.1.1/: Private IP addresses are not allowed'],
    [['  ', ''], 'No valid URLs provided'],
    [[], 'No valid URLs provided']
  ])('%j is rejected with 400 and never checked', async (urls, error) => {
    expect(await check(urls)).toEqual({ status: 400, body: { error } });
    expect(mocks.checkUrl).not.toHaveBeenCalled();
  });

  test('a body over the size limit is rejected with 413', async () => {
    const response = await post(JSON.stringify({ urls: ['https://example.com'] }), { 'Content-Length': String(50 * 1024 + 1) });

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'Request body too large' });
    expect(mocks.checkUrl).not.toHaveBeenCalled();
  });

  test('OPTIONS answers 204 with the CORS headers', async () => {
    const response = await handler(new Request(ENDPOINT, { method: 'OPTIONS' }));

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://tools.onwardseo.com');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
    expect(mocks.checkUrl).not.toHaveBeenCalled();
  });

  test('a localhost origin is allowed back, as /api/ping does', async () => {
    const response = await handler(new Request(ENDPOINT, { method: 'OPTIONS', headers: { Origin: 'http://localhost:8888' } }));

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8888');
  });

  test('other methods answer 405', async () => {
    const response = await handler(new Request(ENDPOINT, { method: 'GET' }));

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: 'Method not allowed' });
    expect(mocks.checkUrl).not.toHaveBeenCalled();
  });

  test('the checks are returned in the order of the received URLs', async () => {
    const urls = ['https://example.com/slow', 'https://example.com/fast', 'https://example.com/middle'];
    const delays: Record<string, number> = { [urls[0]]: 40, [urls[1]]: 0, [urls[2]]: 20 };
    mocks.checkUrl.mockImplementation(async (url: string) => {
      await new Promise(resolve => setTimeout(resolve, delays[url]));
      return okCheck(url);
    });

    const response = await post(JSON.stringify({ urls: [` ${urls[0]} `, urls[1], urls[2]] }));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://tools.onwardseo.com');
    expect(await response.json()).toEqual({ checks: urls.map(okCheck) });
    // Each address is checked once, trimmed, with no options
    expect(mocks.checkUrl.mock.calls).toEqual(urls.map(url => [url]));
  });

  test('when no address can be pinged the answer is still 200 with the checks', async () => {
    const urls = ['https://example.com/gone', 'https://example.com/gone-too'];
    mocks.checkUrl.mockImplementation(async (url: string) => notFound(url));

    expect(await check(urls)).toEqual({ status: 200, body: { checks: urls.map(notFound) } });
  });

  test('an unexpected failure answers 500 without details', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.checkUrl.mockRejectedValue(new Error('boom at 10.0.0.1'));

    const response = await post(JSON.stringify({ urls: ['https://example.com'] }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'An error occurred while processing your request' });
    expect(logged).toHaveBeenCalledTimes(1);
    logged.mockRestore();
  });
});
