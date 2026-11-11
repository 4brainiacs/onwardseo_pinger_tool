import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkAddresses } from '../../utils/addressCheck';
import { logger } from '../../utils/logger';
import type { ApiUrlCheck } from '../../types';

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

const URLS = ['https://www.example.com', 'https://example.org/page'];

const CHECKS: ApiUrlCheck[] = [
  {
    input: URLS[0],
    pingUrl: 'https://example.com/',
    finalUrl: 'https://example.com/',
    canonicalUrl: null,
    status: 200,
    verdict: 'redirected',
    note: 'Corrected from https://www.example.com: it redirects to https://example.com/ — that address was pinged'
  },
  { input: URLS[1], pingUrl: URLS[1], finalUrl: URLS[1], canonicalUrl: null, status: 200, verdict: 'ok', note: '' }
];

function installFetch(answer: () => Promise<unknown>) {
  const fetchMock = vi.fn(answer);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('checkAddresses', () => {
  const warned = vi.mocked(logger.warn);

  beforeEach(() => {
    // The real code path (dev mode has no backend)
    vi.stubEnv('DEV', false);
    warned.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('200 returns the checks, after one POST /api/check with the URLs', async () => {
    const fetchMock = installFetch(async () => ({ status: 200, json: async () => ({ checks: CHECKS }) }));

    expect(await checkAddresses(URLS)).toEqual(CHECKS);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe('/api/check');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({ urls: URLS });
    expect(warned).not.toHaveBeenCalled();
  });

  test('500 returns null and logs a warning', async () => {
    installFetch(async () => ({ status: 500, json: async () => ({ error: 'An error occurred' }) }));

    expect(await checkAddresses(URLS)).toBeNull();
    expect(warned).toHaveBeenCalledTimes(1);
  });

  test.each([400, 404, 413, 429, 502])('%i returns null', async status => {
    installFetch(async () => ({ status, json: async () => ({}) }));

    expect(await checkAddresses(URLS)).toBeNull();
    expect(warned).toHaveBeenCalledTimes(1);
  });

  test('a network error returns null and logs a warning', async () => {
    installFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    expect(await checkAddresses(URLS)).toBeNull();
    expect(warned).toHaveBeenCalledTimes(1);
  });

  test('an answer that is not JSON returns null', async () => {
    installFetch(async () => ({
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      }
    }));

    expect(await checkAddresses(URLS)).toBeNull();
    expect(warned).toHaveBeenCalledTimes(1);
  });

  test('an answer without one check per address returns null', async () => {
    installFetch(async () => ({ status: 200, json: async () => ({ checks: [CHECKS[0]] }) }));

    expect(await checkAddresses(URLS)).toBeNull();
    expect(warned).toHaveBeenCalledTimes(1);
  });

  test('no answer within 15 seconds returns null', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_path: string, init: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
    }));
    vi.stubGlobal('fetch', fetchMock);

    const pending = checkAddresses(URLS);
    await vi.advanceTimersByTimeAsync(14999);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expect(await pending).toBeNull();
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });

  test('dev mode returns null without a request', async () => {
    vi.stubEnv('DEV', true);
    const fetchMock = installFetch(async () => ({ status: 200, json: async () => ({ checks: CHECKS }) }));

    expect(await checkAddresses(URLS)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
