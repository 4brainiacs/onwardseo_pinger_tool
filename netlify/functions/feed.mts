/**
 * Atom Feed Generator for WebSub/PubSubHubbub
 *
 * Generates a valid Atom feed containing submitted URLs.
 * The feed includes WebSub hub discovery links so that
 * when we notify the hub, it can fetch this feed and
 * discover the URLs.
 *
 * Endpoint: GET /api/feed?urls=url1,url2,url3
 */

import type { Context, Config } from '@netlify/functions';
import { WEBSUB_HUB, MAX_URLS, URL_PATTERN } from './lib/types';

/**
 * Generates a unique ID for an Atom entry
 */
function generateEntryId(url: string, timestamp: string): string {
  // Create a deterministic but unique ID based on URL and timestamp
  const hash = Array.from(url + timestamp)
    .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0)
    .toString(16);
  return `urn:uuid:onwardseo-${Math.abs(parseInt(hash, 16)).toString(16).padStart(8, '0')}`;
}

/**
 * Escapes XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Extracts domain from URL for display purposes
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return url;
  }
}

/**
 * Generates Atom feed XML
 */
function generateAtomFeed(urls: string[], feedUrl: string): string {
  const now = new Date().toISOString();
  const feedId = 'urn:uuid:onwardseo-pinger-feed';

  // Generate entries for each URL
  const entries = urls.map(url => {
    const domain = extractDomain(url);
    const entryId = generateEntryId(url, now);

    return `
  <entry>
    <title>URL Submission: ${escapeXml(domain)}</title>
    <link href="${escapeXml(url)}" rel="alternate" type="text/html"/>
    <id>${entryId}</id>
    <updated>${now}</updated>
    <summary>URL submitted for indexing: ${escapeXml(url)}</summary>
    <author>
      <name>OnwardSEO Pinger</name>
    </author>
  </entry>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>OnwardSEO URL Submissions</title>
  <subtitle>URLs submitted for search engine indexing</subtitle>
  <link href="${escapeXml(feedUrl)}" rel="self" type="application/atom+xml"/>
  <link href="${escapeXml(WEBSUB_HUB.url)}" rel="hub"/>
  <updated>${now}</updated>
  <id>${feedId}</id>
  <author>
    <name>OnwardSEO Pinger</name>
    <uri>https://onwardseo.com/</uri>
  </author>
  <generator uri="https://onwardseo.com/" version="2.0">OnwardSEO Pinger</generator>
${entries}
</feed>`;
}

/**
 * Validates URLs from query parameter
 */
function validateUrls(urlsParam: string | null): { valid: boolean; urls: string[]; error?: string } {
  if (!urlsParam) {
    return { valid: false, urls: [], error: 'Missing required parameter: urls' };
  }

  const urls = urlsParam.split(',').map(u => u.trim()).filter(u => u.length > 0);

  if (urls.length === 0) {
    return { valid: false, urls: [], error: 'No valid URLs provided' };
  }

  if (urls.length > MAX_URLS) {
    return { valid: false, urls: [], error: `Maximum ${MAX_URLS} URLs allowed` };
  }

  // Validate each URL
  const invalidUrls: string[] = [];
  for (const url of urls) {
    if (!URL_PATTERN.test(url)) {
      invalidUrls.push(url);
    }
  }

  if (invalidUrls.length > 0) {
    return {
      valid: false,
      urls: [],
      error: `Invalid URL format: ${invalidUrls.join(', ')}`
    };
  }

  return { valid: true, urls };
}

/**
 * Main handler for the feed endpoint
 */
export default async (req: Request, context: Context): Promise<Response> => {
  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse query parameters
    const url = new URL(req.url);
    const urlsParam = url.searchParams.get('urls');

    // Validate URLs
    const validation = validateUrls(urlsParam);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate feed URL (the URL of this endpoint)
    const feedUrl = `${url.origin}${url.pathname}?urls=${encodeURIComponent(urlsParam!)}`;

    // Generate Atom feed
    const atomFeed = generateAtomFeed(validation.urls, feedUrl);

    // Return feed with proper headers
    return new Response(atomFeed, {
      status: 200,
      headers: {
        'Content-Type': 'application/atom+xml; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        // WebSub discovery headers (redundant with in-feed links, but good practice)
        'Link': `<${WEBSUB_HUB.url}>; rel="hub", <${feedUrl}>; rel="self"`
      }
    });
  } catch (error) {
    // Log detailed error internally for debugging
    console.error('[Feed API] Unhandled error:', error instanceof Error ? error.message : error);

    // Return generic error to prevent information disclosure
    return new Response(JSON.stringify({
      error: 'Failed to generate feed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config: Config = {
  path: '/api/feed'
};
