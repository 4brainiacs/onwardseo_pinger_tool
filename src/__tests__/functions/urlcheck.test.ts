// @vitest-environment node
import { describe, test, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo, LookupFunction } from 'node:net';
import { readFileSync } from 'node:fs';
import { checkUrl, isPublicAddress } from '../../../netlify/functions/lib/urlcheck';
import type { LookupAll, CheckUrlOptions } from '../../../netlify/functions/lib/urlcheck';

/**
 * The harness: a local HTTP server on 127.0.0.1 and test host names.
 *
 * checkUrl sends requests only to the default port, and the test server
 * listens on a free port. So the tests leave checkUrl untouched and wrap
 * http.request: every request checkUrl sends keeps its options (among them the
 * guarded lookup) and only gets the test server's port. The injected lookup
 * maps the test names to 127.0.0.1.
 */

type Route = (req: http.IncomingMessage, res: http.ServerResponse) => void;

interface SeenRequest {
  key: string;
  method: string | undefined;
  headers: http.IncomingHttpHeaders;
  bodyBytes: number;
}

const routes = new Map<string, Route>();
const seen: SeenRequest[] = [];
const lookupForms: Array<boolean | undefined> = [];
const openTimers = new Set<NodeJS.Timeout>();

let server: http.Server;
let port = 0;
let requestsSent = 0;
let singleAddressForm = false;

const ADDRESSES: Record<string, string> = {
  'site.test': '127.0.0.1',
  'www.site.test': '127.0.0.1',
  'other.test': '127.0.0.1',
  'internal.test': '10.0.0.5',
  // "www.split.test" is public here, the same site without "www." is not
  'www.split.test': '127.0.0.1',
  'split.test': '192.168.1.10'
};

function lookupFailure(code: string): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error(code);
  error.code = code;
  return error;
}

const lookedUp: string[] = [];
const testLookup: LookupAll = (hostname, _options, callback) => {
  lookedUp.push(hostname);
  const address = ADDRESSES[hostname];
  if (!address) {
    callback(lookupFailure('ENOTFOUND'), []);
    return;
  }
  callback(null, [{ address, family: 4 }]);
};

/** The harness options: only 127.0.0.1 counts as public. */
const local: CheckUrlOptions = {
  lookup: testLookup,
  isPublicAddress: ip => ip === '127.0.0.1'
};

function route(host: string, path: string, handler: Route): string {
  routes.set(`${host}${path}`, handler);
  return `http://${host}${path}`;
}

function html(head: string, extraHeaders: http.OutgoingHttpHeaders = {}): Route {
  return (_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...extraHeaders });
    res.end(`<!doctype html><html><head><title>t</title>${head}</head><body>page</body></html>`);
  };
}

function redirect(status: number, location: string): Route {
  return (_req, res) => {
    res.writeHead(status, { Location: location });
    res.end();
  };
}

function answer(status: number): Route {
  return (_req, res) => {
    res.writeHead(status, { 'Content-Type': 'text/html' });
    res.end('<html><head></head><body></body></html>');
  };
}

function requestsTo(host: string, path: string): number {
  return seen.filter(request => request.key === `${host}${path}`).length;
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const host = (req.headers.host ?? '').replace(/:\d+$/, '');
    const key = `${host}${req.url}`;
    const entry: SeenRequest = { key, method: req.method, headers: req.headers, bodyBytes: 0 };
    seen.push(entry);
    req.on('data', (chunk: Buffer) => {
      entry.bodyBytes += chunk.length;
    });

    const handler = routes.get(key);
    if (!handler) {
      res.writeHead(599);
      res.end(`no route for ${key}`);
      return;
    }
    handler(req, res);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

beforeEach(() => {
  routes.clear();
  seen.length = 0;
  lookedUp.length = 0;
  lookupForms.length = 0;
  requestsSent = 0;
  singleAddressForm = false;

  const realRequest = http.request;
  const toTestServer = (
    url: URL,
    options: http.RequestOptions,
    callback: (res: http.IncomingMessage) => void
  ): http.ClientRequest => {
    requestsSent++;
    const guarded = options.lookup as LookupFunction;
    const recordingLookup: LookupFunction = (hostname, lookupOptions, lookupCallback) => {
      lookupForms.push(lookupOptions.all);
      guarded(hostname, lookupOptions, lookupCallback);
    };
    const extra = singleAddressForm ? { autoSelectFamily: false } : {};
    return realRequest(url, { ...options, ...extra, lookup: recordingLookup, port }, callback);
  };
  vi.spyOn(http, 'request').mockImplementation(toTestServer as unknown as typeof http.request);
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const timer of openTimers) {
    clearInterval(timer);
  }
  openTimers.clear();
});

describe('isPublicAddress', () => {
  test.each([
    '0.0.0.0', '0.1.2.3',            // 0.0.0.0/8
    '10.0.0.1', '10.255.255.255',    // 10.0.0.0/8
    '100.64.0.1', '100.127.255.254', // 100.64.0.0/10
    '127.0.0.1', '127.0.0.2',        // 127.0.0.0/8
    '169.254.169.254',               // 169.254.0.0/16
    '172.16.0.1', '172.31.255.254',  // 172.16.0.0/12
    '192.0.0.1',                     // 192.0.0.0/24
    '192.0.2.1',                     // 192.0.2.0/24
    '192.168.0.1',                   // 192.168.0.0/16
    '198.18.0.1', '198.19.255.254',  // 198.18.0.0/15
    '198.51.100.1',                  // 198.51.100.0/24
    '203.0.113.1',                   // 203.0.113.0/24
    '224.0.0.1', '239.255.255.255',  // 224.0.0.0/4
    '240.0.0.1', '255.255.255.255',  // 240.0.0.0/4
    '::',
    '::1',
    'fc00::1', 'fd12:3456:789a::1',  // fc00::/7
    'fe80::1', 'febf::1',            // fe80::/10
    'ff02::1',                       // ff00::/8
    '2001:db8::1',                   // 2001:db8::/32
    '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.0.0.1', // ::ffff:0:0/96 by its IPv4
    '64:ff9b::7f00:1', '64:ff9b::a00:1',                    // 64:ff9b::/96 by its IPv4
    // Beyond the required list: other forms that carry an IPv4 address inside
    '::ffff:0:127.0.0.1',                                   // IPv4-translated
    '2002:a00:5::1', '2002:7f00:1::1',                      // 6to4 of 10.0.0.5 and 127.0.0.1
    '2001:0:4136:e378:8000:63bf:3fff:fdd2',                 // Teredo
    '64:ff9b:1::a00:1'                                      // local-use NAT64
  ])('%s is not public', ip => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  test.each([
    '8.8.8.8',
    '1.1.1.1',
    '100.63.255.255',
    '100.128.0.1',
    '172.15.255.255',
    '172.32.0.1',
    '198.17.255.255',
    '198.20.0.1',
    '223.255.255.255',
    '2606:4700:4700::1111',
    '::ffff:8.8.8.8',
    '64:ff9b::808:808',
    '2002:808:808::1',
    '2001:4860:4860::8888'
  ])('%s is public', ip => {
    expect(isPublicAddress(ip)).toBe(true);
  });

  test.each(['', 'example.com', '127.0.0.1.', '1.2.3', '256.1.1.1', '0x7f.0.0.1', 'fe80::1%eth0', '[::1]', '12345::1'])(
    'unparseable %j is not public',
    value => {
      expect(isPublicAddress(value)).toBe(false);
    }
  );
});

describe('checkUrl: redirects and statuses', () => {
  test('200 is ok and pinged as received', async () => {
    const input = route('site.test', '/', html(''));

    expect(await checkUrl(input, local)).toEqual({
      input,
      pingUrl: input,
      finalUrl: 'http://site.test/',
      canonicalUrl: null,
      status: 200,
      verdict: 'ok',
      note: ''
    });
  });

  test('an address without a path is pinged exactly as received', async () => {
    route('site.test', '/', html(''));

    const check = await checkUrl('http://site.test', local);

    expect(check).toMatchObject({ verdict: 'ok', pingUrl: 'http://site.test', finalUrl: 'http://site.test/', note: '' });
  });

  test('301 to a 200 page without canonical corrects the address', async () => {
    const final = route('site.test', '/new', html(''));
    const input = route('www.site.test', '/old', redirect(301, final));

    expect(await checkUrl(input, local)).toEqual({
      input,
      pingUrl: final,
      finalUrl: final,
      canonicalUrl: null,
      status: 200,
      verdict: 'redirected',
      note: `Corrected from ${input}: it redirects to ${final} — that address was pinged`
    });
  });

  test('308 to a 200 page corrects the address', async () => {
    const final = route('site.test', '/new', html(''));
    const input = route('site.test', '/old', redirect(308, '/new'));

    expect(await checkUrl(input, local)).toMatchObject({
      verdict: 'redirected',
      pingUrl: final,
      note: `Corrected from ${input}: it redirects to ${final} — that address was pinged`
    });
  });

  test('302 to a 200 page that names itself as canonical corrects the address', async () => {
    const final = 'http://site.test/home';
    route('site.test', '/home', html(`<link rel="canonical" href="${final}">`));
    const input = route('site.test', '/', redirect(302, '/home'));

    expect(await checkUrl(input, local)).toEqual({
      input,
      pingUrl: final,
      finalUrl: final,
      canonicalUrl: final,
      status: 200,
      verdict: 'redirected',
      note: `Corrected from ${input}: it redirects to ${final} — that address was pinged`
    });
  });

  test.each([302, 303, 307])('%i to a 200 page without canonical is not corrected', async status => {
    const final = route('site.test', '/login', html(''));
    const input = route('site.test', '/account', redirect(status, '/login'));

    expect(await checkUrl(input, local)).toEqual({
      input,
      pingUrl: input,
      finalUrl: final,
      canonicalUrl: null,
      status: 200,
      verdict: 'unverified',
      note: `Not corrected: ${input} redirects temporarily to ${final} — pinged as typed`
    });
  });

  test('a chain with one temporary redirect among permanent ones is not corrected', async () => {
    const final = route('site.test', '/c', html(''));
    route('site.test', '/b', redirect(302, '/c'));
    const input = route('site.test', '/a', redirect(301, '/b'));

    expect(await checkUrl(input, local)).toMatchObject({
      verdict: 'unverified',
      pingUrl: input,
      note: `Not corrected: ${input} redirects temporarily to ${final} — pinged as typed`
    });
  });

  test('307 to a 200 page with a same-site canonical elsewhere that answers 200 pings the canonical', async () => {
    const canonical = route('site.test', '/main', html(''));
    route('site.test', '/landing', html(`<link rel="canonical" href="${canonical}">`));
    const input = route('site.test', '/promo', redirect(307, '/landing'));

    expect(await checkUrl(input, local)).toEqual({
      input,
      pingUrl: canonical,
      finalUrl: 'http://site.test/landing',
      canonicalUrl: canonical,
      status: 200,
      verdict: 'canonical',
      note: `Corrected from ${input}: the page names ${canonical} as its main address — that address was pinged`
    });
  });

  test('300 is an unsupported redirect', async () => {
    const input = route('site.test', '/', redirect(300, '/elsewhere'));

    expect(await checkUrl(input, local)).toEqual({
      input,
      pingUrl: input,
      finalUrl: null,
      canonicalUrl: null,
      status: null,
      verdict: 'unverified',
      note: 'Could not check the page (unsupported redirect) — pinged as typed'
    });
    expect(requestsTo('site.test', '/elsewhere')).toBe(0);
  });

  test('a redirect without Location is an unsupported redirect', async () => {
    const input = route('site.test', '/', (_req, res) => {
      res.writeHead(301);
      res.end();
    });

    expect(await checkUrl(input, local)).toMatchObject({
      verdict: 'unverified',
      pingUrl: input,
      note: 'Could not check the page (unsupported redirect) — pinged as typed'
    });
  });

  test('5 redirects are followed', async () => {
    const final = route('site.test', '/r6', html(''));
    for (let i = 1; i <= 5; i++) {
      route('site.test', `/r${i}`, redirect(301, `/r${i + 1}`));
    }

    expect(await checkUrl('http://site.test/r1', local)).toMatchObject({ verdict: 'redirected', pingUrl: final });
  });

  test('a chain of 6 redirects is too many', async () => {
    route('site.test', '/r7', html(''));
    for (let i = 1; i <= 6; i++) {
      route('site.test', `/r${i}`, redirect(301, `/r${i + 1}`));
    }
    const input = 'http://site.test/r1';

    expect(await checkUrl(input, local)).toMatchObject({
      verdict: 'unverified',
      pingUrl: input,
      note: 'Could not check the page (too many redirects) — pinged as typed'
    });
    // The 6th redirect is not followed
    expect(requestsTo('site.test', '/r7')).toBe(0);
    expect(requestsSent).toBe(6);
  });

  test('a repeated address counts as too many redirects', async () => {
    route('site.test', '/b', redirect(301, '/a'));
    const input = route('site.test', '/a', redirect(301, '/b'));

    expect(await checkUrl(input, local)).toMatchObject({
      verdict: 'unverified',
      note: 'Could not check the page (too many redirects) — pinged as typed'
    });
    expect(requestsSent).toBe(2);
  });

  test.each([404, 410])('%i is not found and not pinged', async status => {
    const input = route('site.test', '/gone', answer(status));

    expect(await checkUrl(input, local)).toEqual({
      input,
      pingUrl: null,
      finalUrl: input,
      canonicalUrl: null,
      status,
      verdict: 'not_found',
      note: `Not pinged: page not found (HTTP ${status})`
    });
  });

  test('404 after a redirect is not found', async () => {
    route('site.test', '/missing', answer(404));
    const input = route('site.test', '/old', redirect(301, '/missing'));

    expect(await checkUrl(input, local)).toMatchObject({
      verdict: 'not_found',
      pingUrl: null,
      note: 'Not pinged: page not found (HTTP 404)'
    });
  });

  test.each([401, 403, 405, 429, 500, 503])('%i cannot be checked and is pinged as typed', async status => {
    const input = route('site.test', '/', answer(status));

    expect(await checkUrl(input, local)).toEqual({
      input,
      pingUrl: input,
      finalUrl: input,
      canonicalUrl: null,
      status,
      verdict: 'unverified',
      note: `Could not check the page (HTTP ${status}) — pinged as typed`
    });
  });

  test('a response slower than the time budget times out', async () => {
    const input = route('site.test', '/slow', () => {
      // never answers
    });

    const startedAt = Date.now();
    const check = await checkUrl(input, { ...local, timeoutMs: 300 });

    expect(check).toEqual({
      input,
      pingUrl: input,
      finalUrl: null,
      canonicalUrl: null,
      status: null,
      verdict: 'unverified',
      note: 'Could not check the page (timed out) — pinged as typed'
    });
    expect(Date.now() - startedAt).toBeLessThan(2000);
  });

  test('the time budget covers all hops together', async () => {
    const slowRedirect = (location: string): Route => (_req, res) => {
      setTimeout(() => {
        res.writeHead(301, { Location: location });
        res.end();
      }, 200);
    };
    route('site.test', '/c', html(''));
    route('site.test', '/b', slowRedirect('/c'));
    const input = route('site.test', '/a', slowRedirect('/b'));

    expect(await checkUrl(input, { ...local, timeoutMs: 300 })).toMatchObject({
      verdict: 'unverified',
      pingUrl: input,
      note: 'Could not check the page (timed out) — pinged as typed'
    });
  });

  test('a redirect to a non-http(s) address is an unsupported redirect', async () => {
    const input = route('site.test', '/', redirect(301, 'ftp://example.com/'));

    expect(await checkUrl(input, local)).toMatchObject({
      verdict: 'unverified',
      pingUrl: input,
      note: 'Could not check the page (unsupported redirect) — pinged as typed'
    });
    expect(requestsSent).toBe(1);
  });

  test('a redirect to a non-default port is not followed', async () => {
    const input = route('site.test', '/', redirect(301, 'http://site.test:8080/'));

    expect(await checkUrl(input, local)).toMatchObject({
      verdict: 'unverified',
      pingUrl: input,
      note: 'Could not check the page (non-standard port) — pinged as typed'
    });
    expect(requestsSent).toBe(1);
  });

  test('a redirect to an IP address that is not public is blocked, and no request is sent to it', async () => {
    const input = route('site.test', '/', redirect(301, `http://127.0.0.2:${port}/`));

    expect(await checkUrl(input, local)).toEqual({
      input,
      pingUrl: null,
      finalUrl: null,
      canonicalUrl: null,
      status: null,
      verdict: 'blocked',
      note: 'Not pinged: the address points to a private network'
    });
    expect(requestsSent).toBe(1);
  });

  test('a redirect to a name that resolves to a private address is blocked at connection time', async () => {
    const input = route('site.test', '/', redirect(302, 'http://internal.test/admin'));

    expect(await checkUrl(input, local)).toMatchObject({
      verdict: 'blocked',
      pingUrl: null,
      note: 'Not pinged: the address points to a private network'
    });
    expect(lookedUp).toContain('internal.test');
    expect(seen.map(request => request.key)).toEqual(['site.test/']);
  });

  test('a redirect to a domain that does not exist is unreachable', async () => {
    const input = route('site.test', '/', redirect(301, 'http://missing.test/'));

    expect(await checkUrl(input, local)).toMatchObject({
      verdict: 'unreachable',
      pingUrl: null,
      note: 'Not pinged: the domain does not exist'
    });
  });

  test('an endless non-HTML body: the check returns before the body ends', async () => {
    let closed = false;
    const input = route('site.test', '/stream', (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      const timer = setInterval(() => res.write(Buffer.alloc(1024, 1)), 5);
      openTimers.add(timer);
      res.on('close', () => {
        closed = true;
        clearInterval(timer);
      });
    });

    const startedAt = Date.now();
    const check = await checkUrl(input, local);

    expect(check).toMatchObject({ verdict: 'ok', pingUrl: input, status: 200 });
    expect(Date.now() - startedAt).toBeLessThan(2000);
    // The response was destroyed after its status and headers
    await vi.waitFor(() => expect(closed).toBe(true));
  });

  test('an endless HTML page: reading stops at </head>', async () => {
    let closed = false;
    const canonical = route('site.test', '/main', html(''));
    const input = route('site.test', '/endless', (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.write(`<html><head><link rel="canonical" href="${canonical}"></head><body>`);
      const timer = setInterval(() => res.write('<p>more</p>'), 5);
      openTimers.add(timer);
      res.on('close', () => {
        closed = true;
        clearInterval(timer);
      });
    });

    const startedAt = Date.now();
    const check = await checkUrl(input, local);

    expect(check).toMatchObject({ verdict: 'canonical', pingUrl: canonical });
    expect(Date.now() - startedAt).toBeLessThan(2000);
    await vi.waitFor(() => expect(closed).toBe(true));
  });

  test('an endless HTML head: reading stops after 262,144 bytes', async () => {
    let written = 0;
    let closed = false;
    const input = route('site.test', '/bighead', (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.write('<html><head>');
      const timer = setInterval(() => {
        written += 4096;
        res.write('a'.repeat(4096));
      }, 1);
      openTimers.add(timer);
      res.on('close', () => {
        closed = true;
        clearInterval(timer);
      });
    });

    const check = await checkUrl(input, local);

    expect(check).toMatchObject({ verdict: 'ok', canonicalUrl: null });
    await vi.waitFor(() => expect(closed).toBe(true));
    expect(written).toBeLessThan(16 * 1024 * 1024);
  });
});

describe('checkUrl: canonical', () => {
  test('a same-site canonical (www to non-www, absolute href) that answers 200 is pinged', async () => {
    const canonical = route('site.test', '/page', html(''));
    const input = route('www.site.test', '/page', html(`<link rel="canonical" href="${canonical}" />`));

    expect(await checkUrl(input, local)).toEqual({
      input,
      pingUrl: canonical,
      finalUrl: input,
      canonicalUrl: canonical,
      status: 200,
      verdict: 'canonical',
      note: `Corrected from ${input}: the page names ${canonical} as its main address — that address was pinged`
    });
  });

  test('a same-site canonical (non-www to www) with another attribute order and single quotes', async () => {
    const canonical = route('www.site.test', '/page', html(''));
    const input = route('site.test', '/page', html(`<LINK data-x="1" href='${canonical}' REL='Canonical'>`));

    expect(await checkUrl(input, local)).toMatchObject({ verdict: 'canonical', pingUrl: canonical });
  });

  test('a relative, unquoted canonical is resolved against the final address', async () => {
    const canonical = route('site.test', '/main?a=1&b=2', html(''));
    route('site.test', '/dir/page', html('<link href=/main?a=1&amp;b=2 rel=canonical>'));
    const input = route('www.site.test', '/start', redirect(301, 'http://site.test/dir/page'));

    expect(await checkUrl(input, local)).toEqual({
      input,
      pingUrl: canonical,
      finalUrl: 'http://site.test/dir/page',
      canonicalUrl: canonical,
      status: 200,
      verdict: 'canonical',
      note: `Corrected from ${input}: the page names ${canonical} as its main address — that address was pinged`
    });
  });

  test('a canonical that redirects is pinged at its final address', async () => {
    const final = route('site.test', '/new', html(''));
    route('site.test', '/old', redirect(302, '/new'));
    const input = route('site.test', '/page', html('<link rel="canonical" href="/old">'));

    expect(await checkUrl(input, local)).toEqual({
      input,
      pingUrl: final,
      finalUrl: input,
      canonicalUrl: 'http://site.test/old',
      status: 200,
      verdict: 'canonical',
      note: `Corrected from ${input}: the page names ${final} as its main address — that address was pinged`
    });
  });

  test('the canonical page itself is not read for a further canonical', async () => {
    const canonical = route('site.test', '/b', html('<link rel="canonical" href="/c">'));
    route('site.test', '/c', html(''));
    const input = route('site.test', '/a', html('<link rel="canonical" href="/b">'));

    expect(await checkUrl(input, local)).toMatchObject({ verdict: 'canonical', pingUrl: canonical });
    expect(requestsTo('site.test', '/c')).toBe(0);
  });

  test('a canonical on another site is ignored and never requested', async () => {
    route('other.test', '/', html(''));
    const input = route('site.test', '/', html('<link rel="canonical" href="http://other.test/">'));

    expect(await checkUrl(input, local)).toEqual({
      input,
      pingUrl: input,
      finalUrl: input,
      canonicalUrl: 'http://other.test/',
      status: 200,
      verdict: 'ok',
      note: ''
    });
    expect(requestsTo('other.test', '/')).toBe(0);
    expect(lookedUp).not.toContain('other.test');
  });

  test('a canonical that answers 404 is ignored', async () => {
    route('site.test', '/gone', answer(404));
    const input = route('site.test', '/', html('<link rel="canonical" href="/gone">'));

    expect(await checkUrl(input, local)).toMatchObject({ verdict: 'ok', pingUrl: input, note: '' });
    expect(requestsTo('site.test', '/gone')).toBe(1);
  });

  test('a canonical in a Link header is used', async () => {
    const canonical = route('site.test', '/doc', html(''));
    const input = route('site.test', '/doc.pdf', (_req, res) => {
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        Link: `<http://site.test/style.css>; rel="preload"; as="style", <${canonical}>; rel="canonical"`
      });
      res.end('%PDF');
    });

    expect(await checkUrl(input, local)).toMatchObject({
      verdict: 'canonical',
      pingUrl: canonical,
      canonicalUrl: canonical
    });
  });

  test('a canonical after 70,000 bytes of head is found and used', async () => {
    const canonical = route('site.test', '/main', html(''));
    const filler = `<meta name="filler" content="${'a'.repeat(70000)}">`;
    const input = route('site.test', '/', html(`${filler}<link rel="canonical" href="/main">`));

    expect(await checkUrl(input, local)).toMatchObject({
      verdict: 'canonical',
      pingUrl: canonical,
      canonicalUrl: canonical
    });
  });

  test('a canonical after 270,000 bytes of head is not found', async () => {
    route('site.test', '/main', html(''));
    const filler = `<meta name="filler" content="${'a'.repeat(270000)}">`;
    const input = route('site.test', '/', html(`${filler}<link rel="canonical" href="/main">`));

    expect(await checkUrl(input, local)).toMatchObject({ verdict: 'ok', canonicalUrl: null, note: '' });
    expect(requestsTo('site.test', '/main')).toBe(0);
  });

  test('a canonical in the body, after </head>, is not used', async () => {
    const input = route('site.test', '/', (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><head></head><body><link rel="canonical" href="/main"></body></html>');
    });

    expect(await checkUrl(input, local)).toMatchObject({ verdict: 'ok', canonicalUrl: null });
  });

  test('a canonical inside an HTML comment is not used', async () => {
    const input = route('site.test', '/', html('<!-- <link rel="canonical" href="/main"> -->'));

    expect(await checkUrl(input, local)).toMatchObject({ verdict: 'ok', canonicalUrl: null });
  });

  test('a canonical equal to the final address is ok, without a note', async () => {
    const input = route('site.test', '/', html('<link rel="canonical" href="http://site.test">'));

    expect(await checkUrl(input, local)).toEqual({
      input,
      pingUrl: input,
      finalUrl: input,
      canonicalUrl: input,
      status: 200,
      verdict: 'ok',
      note: ''
    });
    expect(requestsSent).toBe(1);
  });

  test('a fragment in the typed address does not make a self-canonical a correction', async () => {
    route('site.test', '/page', html('<link rel="canonical" href="http://site.test/page">'));
    const input = 'http://site.test/page#section';

    expect(await checkUrl(input, local)).toEqual({
      input,
      pingUrl: input,
      finalUrl: 'http://site.test/page',
      canonicalUrl: 'http://site.test/page',
      status: 200,
      verdict: 'ok',
      note: ''
    });
    expect(requestsSent).toBe(1);
  });

  test('a canonical on a non-default port is ignored and never requested', async () => {
    const input = route('site.test', '/', html('<link rel="canonical" href="http://site.test:8080/main">'));

    expect(await checkUrl(input, local)).toMatchObject({ verdict: 'ok', pingUrl: input });
    expect(requestsSent).toBe(1);
  });

  test('a canonical longer than 2,048 characters is not used', async () => {
    const long = `/main?q=${'a'.repeat(2048)}`;
    route('site.test', long, html(''));
    const input = route('site.test', '/', html(`<link rel="canonical" href="${long}">`));

    expect(await checkUrl(input, local)).toMatchObject({ verdict: 'ok', pingUrl: input, canonicalUrl: null });
    expect(requestsSent).toBe(1);
  });

  test('a redirect target longer than 2,048 characters is not followed', async () => {
    const long = `/next?q=${'a'.repeat(2048)}`;
    route('site.test', long, html(''));
    const input = route('site.test', '/', redirect(301, long));

    expect(await checkUrl(input, local)).toMatchObject({
      verdict: 'unverified',
      pingUrl: input,
      note: 'Could not check the page (unsupported redirect) — pinged as typed'
    });
    expect(requestsSent).toBe(1);
  });

  test('a canonical with another scheme is ignored', async () => {
    const input = route('site.test', '/', html('<link rel="canonical" href="ftp://site.test/main">'));

    expect(await checkUrl(input, local)).toMatchObject({ verdict: 'ok', pingUrl: input });
    expect(requestsSent).toBe(1);
  });

  test('a same-site canonical whose address is not public is blocked', async () => {
    const input = route('www.split.test', '/', html('<link rel="canonical" href="http://split.test/">'));

    expect(await checkUrl(input, local)).toMatchObject({
      verdict: 'blocked',
      pingUrl: null,
      note: 'Not pinged: the address points to a private network'
    });
    expect(seen.map(request => request.key)).toEqual(['www.split.test/']);
  });

  test('a canonical that redirects to a private address is blocked', async () => {
    route('site.test', '/main', redirect(301, 'http://10.0.0.1/'));
    const input = route('site.test', '/', html('<link rel="canonical" href="/main">'));

    expect(await checkUrl(input, local)).toMatchObject({ verdict: 'blocked', pingUrl: null });
  });

  test('when the time budget ends during the canonical check, the canonical is ignored', async () => {
    route('site.test', '/slow', () => {
      // never answers
    });
    const input = route('site.test', '/', html('<link rel="canonical" href="/slow">'));

    expect(await checkUrl(input, { ...local, timeoutMs: 300 })).toMatchObject({
      verdict: 'ok',
      pingUrl: input,
      status: 200,
      note: ''
    });
  });

  test('when the time budget ends while the page is read, the redirect rows apply without a canonical', async () => {
    const final = 'http://site.test/stalled';
    route('site.test', '/stalled', (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.write('<html><head>');
      // the head never ends
    });
    const input = route('site.test', '/', redirect(301, '/stalled'));

    expect(await checkUrl(input, { ...local, timeoutMs: 300 })).toMatchObject({
      verdict: 'redirected',
      pingUrl: final,
      canonicalUrl: null
    });
  });
});

describe('checkUrl: the request', () => {
  test('GET without a body, with the tool\'s headers, without cookies or credentials', async () => {
    route('site.test', '/next', html(''));
    const input = route('site.test', '/', (_req, res) => {
      res.writeHead(302, { Location: '/next', 'Set-Cookie': 'session=abc; Path=/' });
      res.end();
    });

    await checkUrl('http://user:secret@site.test/', local);

    expect(input).toBe('http://site.test/');
    expect(seen).toHaveLength(2);
    for (const request of seen) {
      expect(request.method).toBe('GET');
      expect(request.bodyBytes).toBe(0);
      expect(request.headers['content-length']).toBeUndefined();
      expect(request.headers['transfer-encoding']).toBeUndefined();
      expect(request.headers['user-agent']).toBe(
        'Mozilla/5.0 (compatible; onwardSEO-PingMyURL/1.5; +https://onwardseo.com/ping-my-url/)'
      );
      expect(request.headers.accept).toBe('text/html,application/xhtml+xml;q=0.9,*/*;q=0.8');
      expect(request.headers.cookie).toBeUndefined();
      expect(request.headers.authorization).toBeUndefined();
    }
  });

  test('credentials in a redirect target or a canonical are not sent, shown or pinged', async () => {
    route('site.test', '/main', html(''));
    route('site.test', '/new', html('<link rel="canonical" href="http://user:secret@site.test/main">'));
    const input = route('site.test', '/', redirect(301, 'http://user:secret@site.test/new'));

    const check = await checkUrl(input, local);

    expect(check).toMatchObject({
      verdict: 'canonical',
      pingUrl: 'http://site.test/main',
      finalUrl: 'http://site.test/new',
      canonicalUrl: 'http://site.test/main'
    });
    expect(JSON.stringify(check)).not.toContain('secret');
    expect(seen).toHaveLength(3);
    for (const request of seen) {
      expect(request.headers.authorization).toBeUndefined();
    }
  });

  test('the lookup inside the request answers both callback forms', async () => {
    const input = route('site.test', '/', html(''));

    // Node asks for the address list (all: true) when it may try several addresses
    expect(await checkUrl(input, local)).toMatchObject({ verdict: 'ok' });
    // ... and for a single address otherwise
    singleAddressForm = true;
    expect(await checkUrl(input, local)).toMatchObject({ verdict: 'ok' });

    expect(lookupForms).toHaveLength(2);
    expect(lookupForms.filter(all => all === true)).toHaveLength(1);
    expect(lookupForms.filter(all => !all)).toHaveLength(1);
  });

  test.each([false, true])('a private address is refused in both lookup forms (single address form: %s)', async single => {
    singleAddressForm = single;

    expect(await checkUrl('http://internal.test/', local)).toMatchObject({ verdict: 'blocked', pingUrl: null });
    expect(seen).toHaveLength(0);
  });

  test('a name with one public and one private address is blocked', async () => {
    const mixed: LookupAll = (_hostname, _options, callback) => {
      callback(null, [{ address: '127.0.0.1', family: 4 }, { address: '10.0.0.1', family: 4 }]);
    };

    expect(await checkUrl('http://site.test/', { ...local, lookup: mixed })).toMatchObject({ verdict: 'blocked' });
    expect(seen).toHaveLength(0);
  });
});

describe('checkUrl: with the real isPublicAddress', () => {
  test('a name that resolves to 127.0.0.1 is blocked and the server is never reached', async () => {
    route('site.test', '/', html(''));

    expect(await checkUrl('http://site.test/', { lookup: testLookup })).toEqual({
      input: 'http://site.test/',
      pingUrl: null,
      finalUrl: null,
      canonicalUrl: null,
      status: null,
      verdict: 'blocked',
      note: 'Not pinged: the address points to a private network'
    });
    expect(seen).toHaveLength(0);
  });

  test.each([
    'http://127.0.0.2/',
    'http://[::ffff:7f00:1]/',
    'http://[::1]/',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.1:8080/',
    'http://2130706433/',
    'http://0x7f.1/'
  ])('%s is blocked without a request', async input => {
    expect(await checkUrl(input, { lookup: testLookup })).toMatchObject({
      verdict: 'blocked',
      pingUrl: null,
      note: 'Not pinged: the address points to a private network'
    });
    expect(requestsSent).toBe(0);
    expect(lookedUp).toHaveLength(0);
  });

  test('a domain that does not resolve is unreachable', async () => {
    const notFound: LookupAll = (_hostname, _options, callback) => callback(lookupFailure('ENOTFOUND'), []);

    expect(await checkUrl('http://nowhere.example/', { lookup: notFound })).toEqual({
      input: 'http://nowhere.example/',
      pingUrl: null,
      finalUrl: null,
      canonicalUrl: null,
      status: null,
      verdict: 'unreachable',
      note: 'Not pinged: the domain does not exist'
    });
  });

  test('ENODATA is unreachable too', async () => {
    const noData: LookupAll = (_hostname, _options, callback) => callback(lookupFailure('ENODATA'), []);

    expect(await checkUrl('http://nowhere.example/', { lookup: noData })).toMatchObject({ verdict: 'unreachable' });
  });

  test('a temporary DNS failure is pinged as typed', async () => {
    const tryAgain: LookupAll = (_hostname, _options, callback) => callback(lookupFailure('EAI_AGAIN'), []);

    expect(await checkUrl('http://example.com/', { lookup: tryAgain })).toMatchObject({
      verdict: 'unverified',
      pingUrl: 'http://example.com/',
      note: 'Could not check the page (connection failed) — pinged as typed'
    });
  });

  test.each(['http://example.com:8080/', 'https://example.com:8443/', 'http://example.com:443/', 'https://example.com:80/'])(
    '%s is a non-standard port: no lookup and no request',
    async input => {
      expect(await checkUrl(input, { lookup: testLookup })).toEqual({
        input,
        pingUrl: input,
        finalUrl: null,
        canonicalUrl: null,
        status: null,
        verdict: 'unverified',
        note: 'Could not check the page (non-standard port) — pinged as typed'
      });
      expect(requestsSent).toBe(0);
      expect(lookedUp).toHaveLength(0);
    }
  );
});

describe('urlcheck.ts source', () => {
  const source = readFileSync('netlify/functions/lib/urlcheck.ts', 'utf8');

  test('imports only node:dns, node:http, node:https and node:net', () => {
    const imported = Array.from(source.matchAll(/^import\s[^;]*?from\s+'([^']+)';/gm), match => match[1]);

    expect(imported.sort()).toEqual(['node:dns', 'node:http', 'node:https', 'node:net']);
    expect(source).not.toMatch(/\brequire\s*\(|\bimport\s*\(/);
  });

  test('logs nothing', () => {
    expect(source).not.toMatch(/console\s*\./);
  });
});
