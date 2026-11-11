/**
 * Address Check API Endpoint
 *
 * Checks each address before anything is pinged: where its redirects end, the
 * canonical address the page names, and whether it may be pinged at all.
 * The page calls this endpoint first and then /api/ping with the addresses
 * returned here. This endpoint pings nothing.
 *
 * Endpoint: POST /api/check
 * Body: { urls: string[] }
 * Answer: { checks: UrlCheck[] }, in the order of the received URLs
 */

import type { PingRequest } from './lib/types';
import { MAX_URLS, MAX_BODY_SIZE, URL_PATTERN, isUrlSafe } from './lib/types';
import { checkUrl } from './lib/urlcheck';

/**
 * Validates the request body (the same rules and messages as /api/ping)
 */
function validateRequest(body: unknown): { valid: boolean; urls: string[]; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, urls: [], error: 'Invalid request body' };
  }

  const request = body as PingRequest;

  if (!request.urls || !Array.isArray(request.urls)) {
    return { valid: false, urls: [], error: 'Missing required field: urls (array)' };
  }

  const urls = request.urls
    .filter((url): url is string => typeof url === 'string')
    .map(url => url.trim())
    .filter(url => url.length > 0);

  if (urls.length === 0) {
    return { valid: false, urls: [], error: 'No valid URLs provided' };
  }

  if (urls.length > MAX_URLS) {
    return { valid: false, urls: [], error: `Maximum ${MAX_URLS} URLs allowed, received ${urls.length}` };
  }

  const invalidUrls: string[] = [];
  const unsafeUrls: string[] = [];

  for (const url of urls) {
    if (!URL_PATTERN.test(url)) {
      invalidUrls.push(url);
      continue;
    }

    const safetyCheck = isUrlSafe(url);
    if (!safetyCheck.safe) {
      unsafeUrls.push(`${url}: ${safetyCheck.reason}`);
    }
  }

  if (invalidUrls.length > 0) {
    return {
      valid: false,
      urls: [],
      error: `Invalid URL format: ${invalidUrls.slice(0, 3).join(', ')}${invalidUrls.length > 3 ? '...' : ''}`
    };
  }

  if (unsafeUrls.length > 0) {
    return {
      valid: false,
      urls: [],
      error: `Security: ${unsafeUrls[0]}`
    };
  }

  return { valid: true, urls };
}

/**
 * Main handler for the check endpoint
 */
export default async (req: Request): Promise<Response> => {
  // CORS headers for frontend access (the same logic as /api/ping)
  // In development (localhost), allow all origins
  // In production, restrict to specific origin for security
  const requestOrigin = req.headers.get('origin') || '';
  const isLocalhost = requestOrigin.includes('localhost') || requestOrigin.includes('127.0.0.1');
  const allowedOrigin = isLocalhost
    ? requestOrigin
    : (process.env.ALLOWED_ORIGIN || 'https://tools.onwardseo.com');
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  const jsonHeaders = { 'Content-Type': 'application/json', ...corsHeaders };

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: jsonHeaders
    });
  }

  try {
    // Validate request body size to prevent DoS attacks
    const contentLength = req.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (size > MAX_BODY_SIZE) {
        return new Response(JSON.stringify({ error: 'Request body too large' }), {
          status: 413,
          headers: jsonHeaders
        });
      }
    }

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: jsonHeaders
      });
    }

    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: jsonHeaders
      });
    }

    // Check all addresses in parallel; the answer keeps the order received
    const checks = await Promise.all(validation.urls.map(url => checkUrl(url)));

    return new Response(JSON.stringify({ checks }), {
      status: 200,
      headers: jsonHeaders
    });

  } catch (error) {
    // Log detailed error internally for debugging (not exposed to client)
    console.error('[Check API] Unhandled error:', error instanceof Error ? error.message : error);

    // Return generic message to prevent information disclosure
    return new Response(JSON.stringify({
      error: 'An error occurred while processing your request'
    }), {
      status: 500,
      headers: jsonHeaders
    });
  }
};

// At most 30 requests per 60 seconds from one IP address; above that Netlify
// answers 429 before this function runs. Not annotated with Config: the
// installed @netlify/functions types do not know windowLimit yet.
export const config = {
  path: '/api/check',
  rateLimit: {
    windowLimit: 30,
    windowSize: 60,
    aggregateBy: ['ip', 'domain']
  }
};
