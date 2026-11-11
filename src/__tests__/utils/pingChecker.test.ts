import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ApiUrlCheck, PingService } from '../../types';
import { PING_SERVICES } from '../../services/pingServices';

const URL_TYPED = 'https://www.example.com';

const CHECK: ApiUrlCheck = {
  input: URL_TYPED,
  pingUrl: 'https://example.com/',
  finalUrl: 'https://example.com/',
  canonicalUrl: null,
  status: 200,
  verdict: 'redirected',
  note: 'Corrected from https://www.example.com: it redirects to https://example.com/ — that address was pinged'
};

function installFetch(body: unknown): void {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => body })));
}

/** A fresh pingChecker (and a fresh, empty answer cache) on the real /api/ping code path. */
async function loadPingService() {
  vi.resetModules();
  const { pingService } = await import('../../utils/pingChecker');
  return pingService;
}

describe('pingService passes the address check through', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', false);
    for (const method of ['info', 'warn', 'error', 'debug', 'log'] as const) {
      vi.spyOn(console, method).mockImplementation(() => {});
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('a successful service result carries the check', async () => {
    installFetch({
      success: true,
      results: PING_SERVICES.map(service => ({ service: service.name, success: true, message: 'ok', method: service.method, responseTime: 1 })),
      totalTime: 1,
      checks: [CHECK]
    });
    const pingService = await loadPingService();

    const response = await pingService(PING_SERVICES[0], URL_TYPED);

    expect(response).toEqual({ success: true, message: 'ok', check: CHECK, error: undefined });
  });

  test('a failed service result carries the check', async () => {
    const notPinged: ApiUrlCheck = {
      input: URL_TYPED,
      pingUrl: null,
      finalUrl: URL_TYPED,
      canonicalUrl: null,
      status: 404,
      verdict: 'not_found',
      note: 'Not pinged: page not found (HTTP 404)'
    };
    installFetch({
      success: false,
      results: PING_SERVICES.map(service => ({
        service: service.name, success: false, message: notPinged.note, method: service.method, responseTime: 0, error: 'not_pinged'
      })),
      totalTime: 1,
      checks: [notPinged]
    });
    const pingService = await loadPingService();

    const response = await pingService(PING_SERVICES[1], URL_TYPED);

    expect(response).toEqual({
      success: false,
      message: notPinged.note,
      check: notPinged,
      error: { code: 'SERVICE_ERROR', details: 'not_pinged', service: PING_SERVICES[1].name, retryable: true }
    });
  });

  test('a service missing from the answer still carries the check', async () => {
    installFetch({ success: true, results: [], totalTime: 1, checks: [CHECK] });
    const pingService = await loadPingService();
    const unknown: PingService = { ...PING_SERVICES[0], name: 'Unknown service' };

    const response = await pingService(unknown, URL_TYPED);

    expect(response.success).toBe(false);
    expect(response.check).toEqual(CHECK);
  });

  test('an answer without checks gives no check', async () => {
    installFetch({
      success: true,
      results: PING_SERVICES.map(service => ({ service: service.name, success: true, message: 'ok', method: service.method, responseTime: 1 })),
      totalTime: 1
    });
    const pingService = await loadPingService();

    const response = await pingService(PING_SERVICES[0], URL_TYPED);

    expect(response.check).toBeUndefined();
  });
});
