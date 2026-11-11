/**
 * Address check before pinging
 *
 * Opens an address from the server and reports the address the site really
 * uses: where its redirects end, or the canonical address the page names.
 * The answer comes only from the site's own signals; nothing is guessed.
 *
 * The check must never reach a private network (SSRF):
 * - only http: and https:, only the default port;
 * - an IP-literal host must be a public address, and no request is sent otherwise;
 * - a named host is resolved inside the request itself (custom lookup), and the
 *   connection fails when any of its addresses is not public;
 * - every redirect target and the canonical address pass the same guards.
 *
 * Uses only node:dns, node:http, node:https and node:net.
 */

import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

/** Result of the address check (the answer of /api/check, one per received address) */
export interface UrlCheck {
  /** The address as received */
  input: string;
  /** The address to ping, or null when the address must not be pinged */
  pingUrl: string | null;
  finalUrl: string | null;
  canonicalUrl: string | null;
  status: number | null;
  verdict: 'ok' | 'redirected' | 'canonical' | 'not_found' | 'unreachable' | 'blocked' | 'unverified';
  /** What to tell the visitor; empty for 'ok' */
  note: string;
}

const MAX_REDIRECTS = 5;
const CHECK_BUDGET_MS = 8000;
const MAX_HEAD_BYTES = 262144;
const MAX_ADDRESS_LENGTH = 2048;
const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);
const PERMANENT_REDIRECT_CODES = new Set([301, 308]);

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; onwardSEO-PingMyURL/1.5; +https://onwardseo.com/ping-my-url/)',
  Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8'
};

const NOTE_DOMAIN_MISSING = 'Not pinged: the domain does not exist';
const NOTE_PRIVATE_NETWORK = 'Not pinged: the address points to a private network';

type LookupAllCallback = (error: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void;

/** Resolves a host name to all its addresses (the shape of dns.lookup with all: true). */
export type LookupAll = (hostname: string, options: dns.LookupAllOptions, callback: LookupAllCallback) => void;

/** For tests only. The handler calls checkUrl(url). */
export interface CheckUrlOptions {
  lookup?: LookupAll;
  isPublicAddress?: (ip: string) => boolean;
  timeoutMs?: number;
}

interface CheckContext {
  signal: AbortSignal;
  isPublic: (ip: string) => boolean;
  lookup: net.LookupFunction;
}

interface Fetched {
  status: number;
  headers: http.IncomingHttpHeaders;
  /** The start of the page (up to </head>), read only for a 2xx text/html response. */
  html: string | null;
}

type Chain =
  | { kind: 'response'; url: URL; status: number; redirects: number[]; headers: http.IncomingHttpHeaders; html: string | null }
  | { kind: 'blocked' }
  | { kind: 'unreachable' }
  | { kind: 'failed'; reason: string };

function parseIPv4(ip: string): number[] | null {
  if (!net.isIPv4(ip)) {
    return null;
  }
  return ip.split('.').map(Number);
}

function isPublicIPv4(octets: number[]): boolean {
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127) return false;            // 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return false;            // 100.64.0.0/10
  if (a === 169 && b === 254) return false;                      // 169.254.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return false;             // 172.16.0.0/12
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false; // 192.0.0.0/24, 192.0.2.0/24
  if (a === 192 && b === 168) return false;                      // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return false;         // 198.18.0.0/15
  if (a === 198 && b === 51 && c === 100) return false;          // 198.51.100.0/24
  if (a === 203 && b === 0 && c === 113) return false;           // 203.0.113.0/24
  if (a >= 224) return false;                                    // 224.0.0.0/4, 240.0.0.0/4
  return true;
}

/** The eight 16-bit groups of an IPv6 address, or null when it cannot be parsed. */
function parseIPv6(ip: string): number[] | null {
  if (!net.isIPv6(ip) || ip.includes('%')) {
    return null;
  }

  let text = ip;
  const lastColon = text.lastIndexOf(':');
  const tail = text.slice(lastColon + 1);
  if (tail.includes('.')) {
    const embedded = parseIPv4(tail);
    if (!embedded) {
      return null;
    }
    const high = ((embedded[0] << 8) | embedded[1]).toString(16);
    const low = ((embedded[2] << 8) | embedded[3]).toString(16);
    text = `${text.slice(0, lastColon + 1)}${high}:${low}`;
  }

  const halves = text.split('::');
  if (halves.length > 2) {
    return null;
  }
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - rest.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) {
    return null;
  }

  const groups = [...head, ...new Array<string>(missing).fill('0'), ...rest].map(group => parseInt(group, 16));
  if (groups.length !== 8 || groups.some(group => Number.isNaN(group) || group < 0 || group > 0xffff)) {
    return null;
  }
  return groups;
}

function embeddedIPv4(groups: number[]): number[] {
  return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff];
}

function isPublicIPv6(groups: number[]): boolean {
  const zeroUpTo = (count: number) => groups.slice(0, count).every(group => group === 0);

  if (zeroUpTo(6)) return false;                                  // ::, ::1 and the rest of ::/96
  if (zeroUpTo(5) && groups[5] === 0xffff) {                      // ::ffff:0:0/96 (IPv4-mapped)
    return isPublicIPv4(embeddedIPv4(groups));
  }
  if (groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every(group => group === 0)) {
    return isPublicIPv4(embeddedIPv4(groups));                    // 64:ff9b::/96 (NAT64)
  }
  // Beyond the required list: other forms that carry an IPv4 address inside
  if (zeroUpTo(4) && groups[4] === 0xffff && groups[5] === 0) {   // ::ffff:0:0:0/96 (IPv4-translated)
    return isPublicIPv4(embeddedIPv4(groups));
  }
  if (groups[0] === 0x2002) {                                     // 2002::/16 (6to4)
    return isPublicIPv4([groups[1] >> 8, groups[1] & 0xff, groups[2] >> 8, groups[2] & 0xff]);
  }
  if (groups[0] === 0x2001 && groups[1] === 0) return false;      // 2001::/32 (Teredo)
  if (groups[0] === 0x64 && groups[1] === 0xff9b && groups[2] === 1) return false; // 64:ff9b:1::/48 (local NAT64)
  if ((groups[0] & 0xfe00) === 0xfc00) return false;              // fc00::/7
  if ((groups[0] & 0xffc0) === 0xfe80) return false;              // fe80::/10
  if ((groups[0] & 0xffc0) === 0xfec0) return false;              // fec0::/10 (site-local, deprecated)
  if ((groups[0] & 0xff00) === 0xff00) return false;              // ff00::/8
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return false; // 2001:db8::/32
  return true;
}

/**
 * True only for an IP address on the public internet.
 * Private, loopback, link-local, reserved and documentation ranges are not
 * public, and neither is anything that cannot be parsed.
 */
export function isPublicAddress(ip: string): boolean {
  const octets = parseIPv4(ip);
  if (octets) {
    return isPublicIPv4(octets);
  }
  const groups = parseIPv6(ip);
  if (groups) {
    return isPublicIPv6(groups);
  }
  return false;
}

function lookupError(code: string, hostname: string): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error(`${code} ${hostname}`);
  error.code = code;
  return error;
}

/**
 * The lookup the requests connect with: resolves all addresses of the host and
 * fails with EBLOCKED when any of them is not public. Because the connection
 * itself uses this answer, a name cannot resolve differently between a check
 * and the request.
 */
function createGuardedLookup(resolveAll: LookupAll, isPublic: (ip: string) => boolean): net.LookupFunction {
  return (hostname, options, callback) => {
    resolveAll(hostname, { family: options.family, hints: options.hints, all: true }, (error, addresses) => {
      let failure = error;
      if (!failure && (!Array.isArray(addresses) || addresses.length === 0)) {
        failure = lookupError('ENOTFOUND', hostname);
      }
      if (!failure && addresses.some(entry => !isPublic(entry.address))) {
        failure = lookupError('EBLOCKED', hostname);
      }

      if (failure) {
        if (options.all) {
          callback(failure, []);
        } else {
          callback(failure, '', 0);
        }
        return;
      }

      if (options.all) {
        callback(null, addresses);
      } else {
        callback(null, addresses[0].address, addresses[0].family);
      }
    });
  };
}

/** new URL() that answers null instead of throwing: an unusable address is a result here, not an error. */
function parseUrl(value: string, base?: URL): URL | null {
  try {
    return new URL(value, base);
  } catch {
    return null;
  }
}

/**
 * An address named by the site (a redirect target or a canonical): without a
 * fragment, and without user:password@, so that credentials a site puts into
 * such an address are neither sent nor shown nor pinged.
 */
function parseSiteUrl(value: string, base: URL): URL | null {
  // The form accepts addresses of up to 2,048 characters; a longer one named by a site is not used
  if (value.length > MAX_ADDRESS_LENGTH) {
    return null;
  }
  const url = parseUrl(value, base);
  if (url) {
    url.hash = '';
    url.username = '';
    url.password = '';
  }
  return url;
}

function hostOf(url: URL): string {
  return url.hostname.replace(/^\[|\]$/g, '');
}

/**
 * Guards 1 and 2: the reason why no request may be sent to this address, or null.
 */
function refuse(url: URL, ctx: CheckContext): Chain | null {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { kind: 'failed', reason: 'unsupported redirect' };
  }
  const host = hostOf(url);
  if (net.isIP(host) !== 0 && !ctx.isPublic(host)) {
    return { kind: 'blocked' };
  }
  // WHATWG URL drops the default port, so any port left is a non-default one
  if (url.port !== '') {
    return { kind: 'failed', reason: 'non-standard port' };
  }
  return null;
}

/**
 * One GET request without a body. Reads the start of the page only for a 2xx
 * text/html answer when readHead is set; every other response is destroyed
 * right after its status and headers.
 */
function fetchOnce(url: URL, ctx: CheckContext, readHead: boolean): Promise<Fetched> {
  return new Promise((resolve, reject) => {
    // No credentials: user:password@ in an address is never sent
    const target = new URL(url.href);
    target.username = '';
    target.password = '';

    // Set once a 2xx page is being read: from then on a failure ends the reading, not the check
    let stopReading: (() => void) | null = null;

    const transport = target.protocol === 'https:' ? https : http;
    const request = transport.request(
      target,
      { method: 'GET', headers: REQUEST_HEADERS, agent: false, lookup: ctx.lookup, signal: ctx.signal },
      response => {
        const status = response.statusCode ?? 0;
        const headers = response.headers;
        const isHtml = /^\s*text\/html\b/i.test(String(headers['content-type'] ?? ''));

        if (!readHead || status < 200 || status > 299 || !isHtml) {
          // The status and headers are all this response is needed for: whatever
          // its connection reports while it is torn down changes nothing
          response.on('error', () => undefined);
          response.destroy();
          resolve({ status, headers, html: null });
          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;
        let seen = '';
        let finished = false;
        const finish = (html: string | null) => {
          if (finished) {
            return;
          }
          finished = true;
          response.destroy();
          resolve({ status, headers, html });
        };
        const collected = () => Buffer.concat(chunks).toString('utf8');
        // The page already answered 2xx: when its body fails or the time budget
        // ends while reading it, the check goes on without a canonical.
        stopReading = () => finish(null);

        response.on('data', (chunk: Buffer) => {
          const room = MAX_HEAD_BYTES - size;
          const part = chunk.length > room ? chunk.subarray(0, room) : chunk;
          chunks.push(part);
          size += part.length;
          seen = (seen + part.toString('latin1')).slice(-(part.length + 16));
          if (size >= MAX_HEAD_BYTES || /<\/head\s*>/i.test(seen)) {
            finish(collected());
          }
        });
        response.on('end', () => finish(collected()));
        response.on('error', stopReading);
        response.on('close', stopReading);
      }
    );

    request.on('error', error => {
      if (stopReading) {
        stopReading();
      } else {
        reject(error);
      }
    });
    request.end();
  });
}

function classifyFailure(error: unknown, ctx: CheckContext): Chain {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  if (code === 'EBLOCKED') {
    return { kind: 'blocked' };
  }
  if (code === 'ENOTFOUND' || code === 'ENODATA') {
    return { kind: 'unreachable' };
  }
  if (ctx.signal.aborted || code === 'ABORT_ERR') {
    return { kind: 'failed', reason: 'timed out' };
  }
  // Connection refused or reset, TLS errors, EAI_AGAIN and everything else
  return { kind: 'failed', reason: 'connection failed' };
}

/**
 * The canonical's own check: one GET with the same guards, headers only.
 * It follows no redirect: the canonical counts only when this one answer is 2xx.
 */
async function checkCanonical(canonical: URL, ctx: CheckContext): Promise<'answers' | 'blocked' | 'not used'> {
  const refusal = refuse(canonical, ctx);
  if (refusal) {
    return refusal.kind === 'blocked' ? 'blocked' : 'not used';
  }

  try {
    const { status } = await fetchOnce(canonical, ctx, false);
    return isSuccess(status) ? 'answers' : 'not used';
  } catch (error) {
    // A host that is not public becomes the verdict the visitor sees. Any other
    // failure (timeout, connection failure, domain not found) is deliberately
    // not reported: the canonical is optional, and the check goes on without it.
    // This file logs nothing.
    return classifyFailure(error, ctx).kind === 'blocked' ? 'blocked' : 'not used';
  }
}

/**
 * Follows up to 5 redirects from the typed address and reads the start of the
 * page they end on. Every hop passes the guards.
 */
async function followChain(start: URL, ctx: CheckContext): Promise<Chain> {
  const visited = new Set<string>();
  const redirects: number[] = [];
  let current = start;

  for (;;) {
    const refusal = refuse(current, ctx);
    if (refusal) {
      return refusal;
    }
    visited.add(current.href);

    let fetched: Fetched;
    try {
      fetched = await fetchOnce(current, ctx, true);
    } catch (error) {
      // Not swallowed: the failure becomes the verdict the visitor sees
      return classifyFailure(error, ctx);
    }

    const { status, headers, html } = fetched;
    if (status < 300 || status > 399) {
      return { kind: 'response', url: current, status, redirects, headers, html };
    }

    const location = headers.location;
    if (!REDIRECT_CODES.has(status) || !location) {
      return { kind: 'failed', reason: 'unsupported redirect' };
    }
    const next = parseSiteUrl(location, current);
    if (!next) {
      return { kind: 'failed', reason: 'unsupported redirect' };
    }

    if (redirects.length >= MAX_REDIRECTS || visited.has(next.href)) {
      return { kind: 'failed', reason: 'too many redirects' };
    }
    redirects.push(status);
    current = next;
  }
}

function decodeAmpersands(value: string): string {
  return value.replace(/&(?:amp|#38|#x26);/gi, '&');
}

function canonicalFromHtml(html: string): string | null {
  const headEnd = html.search(/<\/head\s*>/i);
  const head = (headEnd === -1 ? html : html.slice(0, headEnd)).replace(/<!--[\s\S]*?-->/g, '');
  const tags = head.match(/<link\b[^>]*>/gi) ?? [];

  for (const tag of tags) {
    const attributes = new Map<string, string>();
    const pattern = /([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))/g;
    for (const match of tag.slice('<link'.length).matchAll(pattern)) {
      const name = match[1].toLowerCase();
      if (!attributes.has(name)) {
        attributes.set(name, match[2] ?? match[3] ?? match[4] ?? '');
      }
    }

    const rel = (attributes.get('rel') ?? '').toLowerCase().split(/\s+/);
    const href = decodeAmpersands((attributes.get('href') ?? '').trim());
    if (rel.includes('canonical') && href) {
      return href;
    }
  }
  return null;
}

function canonicalFromLinkHeader(header: string | string[] | undefined): string | null {
  const value = Array.isArray(header) ? header.join(', ') : header ?? '';

  for (const match of value.matchAll(/<([^>]*)>([^,]*)/g)) {
    const rel = /;\s*rel\s*=\s*(?:"([^"]*)"|([^\s";,]+))/i.exec(match[2]);
    const relations = (rel?.[1] ?? rel?.[2] ?? '').toLowerCase().split(/\s+/);
    const href = match[1].trim();
    if (relations.includes('canonical') && href) {
      return href;
    }
  }
  return null;
}

/** The canonical address a 2xx response names, resolved against the final address. */
function findCanonical(html: string | null, linkHeader: string | string[] | undefined, final: URL): URL | null {
  const href = (html ? canonicalFromHtml(html) : null) ?? canonicalFromLinkHeader(linkHeader);
  if (!href) {
    return null;
  }
  return parseSiteUrl(href, final);
}

function siteOf(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, '');
}

/** http(s), default port, same site (host names equal after removing a leading "www."). */
function mayBeUsed(canonical: URL, final: URL): boolean {
  const isHttp = canonical.protocol === 'http:' || canonical.protocol === 'https:';
  return isHttp && canonical.port === '' && siteOf(canonical) === siteOf(final);
}

function isSuccess(status: number): boolean {
  return status >= 200 && status <= 299;
}

async function runCheck(input: string, ctx: CheckContext): Promise<UrlCheck> {
  const nothing = { input, finalUrl: null, canonicalUrl: null, status: null };
  const couldNotCheck = (reason: string): string => `Could not check the page (${reason}) — pinged as typed`;

  const start = parseUrl(input);
  if (!start) {
    return { ...nothing, pingUrl: input, verdict: 'unverified', note: couldNotCheck('connection failed') };
  }
  // A fragment (#...) is never sent to the site and is not part of its address
  start.hash = '';

  const chain = await followChain(start, ctx);

  if (chain.kind === 'blocked') {
    return { ...nothing, pingUrl: null, verdict: 'blocked', note: NOTE_PRIVATE_NETWORK };
  }
  if (chain.kind === 'unreachable') {
    return { ...nothing, pingUrl: null, verdict: 'unreachable', note: NOTE_DOMAIN_MISSING };
  }
  if (chain.kind === 'failed') {
    return { ...nothing, pingUrl: input, verdict: 'unverified', note: couldNotCheck(chain.reason) };
  }

  const { status, redirects } = chain;
  const final = chain.url.href;

  if (status === 404 || status === 410) {
    return {
      input, pingUrl: null, finalUrl: final, canonicalUrl: null, status,
      verdict: 'not_found', note: `Not pinged: page not found (HTTP ${status})`
    };
  }
  if (!isSuccess(status)) {
    return {
      input, pingUrl: input, finalUrl: final, canonicalUrl: null, status,
      verdict: 'unverified', note: couldNotCheck(`HTTP ${status}`)
    };
  }

  const canonical = findCanonical(chain.html, chain.headers.link, chain.url);
  const canonicalUrl = canonical ? canonical.href : null;
  const namesItself = canonicalUrl === final;
  const found = { input, finalUrl: final, canonicalUrl, status };

  if (canonical && !namesItself && mayBeUsed(canonical, chain.url)) {
    const own = await checkCanonical(canonical, ctx);
    if (own === 'blocked') {
      return { ...found, pingUrl: null, verdict: 'blocked', note: NOTE_PRIVATE_NETWORK };
    }
    if (own === 'answers') {
      return {
        ...found, pingUrl: canonical.href, verdict: 'canonical',
        note: `Corrected from ${input}: the page names ${canonical.href} as its main address — that address was pinged`
      };
    }
    // The canonical redirects, does not answer 2xx, or the time budget ended: go on without it
  }

  if (redirects.length === 0) {
    return { ...found, pingUrl: input, verdict: 'ok', note: '' };
  }

  const allPermanent = redirects.every(code => PERMANENT_REDIRECT_CODES.has(code));
  if (allPermanent || namesItself) {
    return {
      ...found, pingUrl: final, verdict: 'redirected',
      note: `Corrected from ${input}: it redirects to ${final} — that address was pinged`
    };
  }

  return {
    ...found, pingUrl: input, verdict: 'unverified',
    note: `Not corrected: ${input} redirects temporarily to ${final} — pinged as typed`
  };
}

/**
 * Checks one address before it is pinged.
 *
 * The whole check (all redirects and the canonical's one request) has one time
 * budget of 8 seconds.
 */
export async function checkUrl(input: string, options: CheckUrlOptions = {}): Promise<UrlCheck> {
  const isPublic = options.isPublicAddress ?? isPublicAddress;
  const resolveAll: LookupAll = options.lookup
    ?? ((hostname, lookupOptions, callback) => dns.lookup(hostname, lookupOptions, callback));

  const budget = new AbortController();
  const timer = setTimeout(() => budget.abort(), options.timeoutMs ?? CHECK_BUDGET_MS);

  try {
    return await runCheck(input, {
      signal: budget.signal,
      isPublic,
      lookup: createGuardedLookup(resolveAll, isPublic)
    });
  } finally {
    clearTimeout(timer);
  }
}
