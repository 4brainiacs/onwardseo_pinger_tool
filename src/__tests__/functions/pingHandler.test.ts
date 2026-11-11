// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { Context } from '@netlify/functions';
import type { PingResponse, UrlCheck } from '../../../netlify/functions/lib/types';

const mocks = vi.hoisted(() => ({
  checkUrl: vi.fn(),
  sendXmlRpcPing: vi.fn(),
  notifyGoogleHub: vi.fn()
}));

vi.mock('../../../netlify/functions/lib/urlcheck', () => ({ checkUrl: mocks.checkUrl }));
vi.mock('../../../netlify/functions/lib/xmlrpc', () => ({ sendXmlRpcPing: mocks.sendXmlRpcPing }));
vi.mock('../../../netlify/functions/lib/websub', () => ({ notifyGoogleHub: mocks.notifyGoogleHub }));

import handler from '../../../netlify/functions/ping.mjs';

const SERVICES = ['Google PubSubHubbub', 'Ping-o-Matic', 'Twingly'];

function okCheck(input: string): UrlCheck {
  return { input, pingUrl: input, finalUrl: input, canonicalUrl: null, status: 200, verdict: 'ok', note: '' };
}

async function ping(urls: string[]): Promise<{ status: number; body: PingResponse }> {
  const request = new Request('https://tools.example/api/ping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls })
  });
  const response = await handler(request, {} as Context);
  return { status: response.status, body: (await response.json()) as PingResponse };
}

function feedUrls(feedUrl: string | undefined): string[] {
  const list = new URL(feedUrl as string).searchParams.get('urls');
  return (list as string).split(',');
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkUrl.mockImplementation(async (url: string) => okCheck(url));
  mocks.sendXmlRpcPing.mockImplementation(async (service: { name: string; endpoint: string }) => ({
    success: true,
    flerror: false,
    message: `Pinged ${service.name}`,
    endpoint: service.endpoint,
    responseTime: 5
  }));
  mocks.notifyGoogleHub.mockImplementation(async () => ({
    success: true,
    statusCode: 204,
    message: 'Hub notified',
    hubUrl: 'https://pubsubhubbub.appspot.com/',
    responseTime: 5
  }));
});

describe('/api/ping with the address check', () => {
  test('an address whose page is not found is not pinged', async () => {
    const check: UrlCheck = {
      input: 'https://example.com/gone',
      pingUrl: null,
      finalUrl: 'https://example.com/gone',
      canonicalUrl: null,
      status: 404,
      verdict: 'not_found',
      note: 'Not pinged: page not found (HTTP 404)'
    };
    mocks.checkUrl.mockResolvedValue(check);

    const { status, body } = await ping(['https://example.com/gone']);

    expect(status).toBe(200);
    expect(body.success).toBe(false);
    expect(body.results).toEqual([
      { service: 'Google PubSubHubbub', success: false, message: check.note, method: 'websub', responseTime: 0, error: 'not_pinged' },
      { service: 'Ping-o-Matic', success: false, message: check.note, method: 'xmlrpc', responseTime: 0, error: 'not_pinged' },
      { service: 'Twingly', success: false, message: check.note, method: 'xmlrpc', responseTime: 0, error: 'not_pinged' }
    ]);
    expect(body.checks).toEqual([check]);
    expect(body.feedUrl).toBeUndefined();
    expect(mocks.sendXmlRpcPing).not.toHaveBeenCalled();
    expect(mocks.notifyGoogleHub).not.toHaveBeenCalled();
  });

  test('a redirected address is pinged at its final address, and the feed lists it', async () => {
    const check: UrlCheck = {
      input: 'https://www.example.com',
      pingUrl: 'https://example.com/',
      finalUrl: 'https://example.com/',
      canonicalUrl: null,
      status: 200,
      verdict: 'redirected',
      note: 'Corrected from https://www.example.com: it redirects to https://example.com/ — that address was pinged'
    };
    mocks.checkUrl.mockResolvedValue(check);

    const { status, body } = await ping(['https://www.example.com']);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.checks).toEqual([check]);
    expect(body.results.map(result => result.service).sort()).toEqual([...SERVICES].sort());
    expect(body.results.every(result => result.success)).toBe(true);

    // The address check gets the address as received, and nothing else
    expect(mocks.checkUrl.mock.calls).toEqual([['https://www.example.com']]);
    // Both XML-RPC services and the hub get the final address
    expect(mocks.sendXmlRpcPing).toHaveBeenCalledTimes(2);
    for (const call of mocks.sendXmlRpcPing.mock.calls) {
      expect(call[1]).toBe('example.com');
      expect(call[2]).toBe('https://example.com/');
    }
    expect(mocks.notifyGoogleHub).toHaveBeenCalledTimes(1);
    expect(mocks.notifyGoogleHub.mock.calls[0][0]).toBe(body.feedUrl);
    expect(feedUrls(body.feedUrl)).toEqual(['https://example.com/']);
  });

  test('an unchanged address is pinged as received and its check is returned', async () => {
    const { body } = await ping(['https://example.com/page']);

    expect(body.success).toBe(true);
    expect(body.checks).toEqual([okCheck('https://example.com/page')]);
    expect(mocks.sendXmlRpcPing.mock.calls.map(call => call[2])).toEqual([
      'https://example.com/page',
      'https://example.com/page'
    ]);
    expect(feedUrls(body.feedUrl)).toEqual(['https://example.com/page']);
  });

  test('several addresses: checks in the order received, only the pingUrl values are pinged, each once', async () => {
    const notFound: UrlCheck = {
      input: 'https://example.com/gone',
      pingUrl: null,
      finalUrl: 'https://example.com/gone',
      canonicalUrl: null,
      status: 404,
      verdict: 'not_found',
      note: 'Not pinged: page not found (HTTP 404)'
    };
    const redirected: UrlCheck = {
      input: 'https://www.example.com/',
      pingUrl: 'https://example.com/',
      finalUrl: 'https://example.com/',
      canonicalUrl: null,
      status: 200,
      verdict: 'redirected',
      note: 'Corrected from https://www.example.com/: it redirects to https://example.com/ — that address was pinged'
    };
    mocks.checkUrl.mockImplementation(async (url: string) => {
      if (url === notFound.input) return notFound;
      if (url === redirected.input) return redirected;
      return okCheck(url);
    });

    const { body } = await ping(['https://example.com/gone', 'https://www.example.com/', 'https://example.com/']);

    expect(body.checks).toEqual([notFound, redirected, okCheck('https://example.com/')]);
    // Two inputs end at the same address: it is pinged once
    expect(feedUrls(body.feedUrl)).toEqual(['https://example.com/']);
    expect(mocks.sendXmlRpcPing).toHaveBeenCalledTimes(2);
    expect(mocks.notifyGoogleHub).toHaveBeenCalledTimes(1);
    // First the three results of the pinged address, then three 'not_pinged' ones with the note
    expect(body.success).toBe(true);
    expect(body.results).toHaveLength(6);
    expect(body.results.slice(0, 3).map(result => result.service).sort()).toEqual([...SERVICES].sort());
    expect(body.results.slice(0, 3).every(result => result.success)).toBe(true);
    expect(body.results.slice(3)).toEqual([
      { service: 'Google PubSubHubbub', success: false, message: notFound.note, method: 'websub', responseTime: 0, error: 'not_pinged' },
      { service: 'Ping-o-Matic', success: false, message: notFound.note, method: 'xmlrpc', responseTime: 0, error: 'not_pinged' },
      { service: 'Twingly', success: false, message: notFound.note, method: 'xmlrpc', responseTime: 0, error: 'not_pinged' }
    ]);
  });

  test('an address the API rejects is not checked', async () => {
    const { status, body } = await ping(['www.example.com']);

    expect(status).toBe(400);
    expect(body).toEqual({ error: 'Invalid URL format: www.example.com' });
    expect(mocks.checkUrl).not.toHaveBeenCalled();
  });
});
