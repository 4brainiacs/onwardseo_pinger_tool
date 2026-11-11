/**
 * Main Ping API Endpoint
 *
 * Receives URLs and pings multiple services:
 * 1. Google PubSubHubbub (via WebSub protocol)
 * 2. Ping-o-Matic (XML-RPC) - reaches 10+ downstream services
 * 3. Twingly (XML-RPC) - Swedish blog search engine
 *
 * IMPORTANT: Netlify Functions have a 30-second execution limit.
 * Service timeouts and retries are configured to complete within 25s.
 *
 * Endpoint: POST /api/ping
 * Body: { urls: string[] }
 */

import type { Context, Config } from '@netlify/functions';
import type { PingRequest, PingResponse, PingResult } from './lib/types';
import { XMLRPC_SERVICES, WEBSUB_HUB, MAX_URLS, MAX_BODY_SIZE, URL_PATTERN, BATCH_SIZE, MAX_FUNCTION_EXECUTION_MS, isUrlSafe } from './lib/types';
import { sendXmlRpcPing } from './lib/xmlrpc';
import { notifyGoogleHub } from './lib/websub';

/**
 * Validates the request body
 */
function validateRequest(body: unknown): { valid: boolean; urls: string[]; error?: string } {
  // Check if body exists and has urls property
  if (!body || typeof body !== 'object') {
    return { valid: false, urls: [], error: 'Invalid request body' };
  }

  const request = body as PingRequest;

  if (!request.urls || !Array.isArray(request.urls)) {
    return { valid: false, urls: [], error: 'Missing required field: urls (array)' };
  }

  // Filter and validate URLs
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

  // Validate each URL format and check for SSRF
  const invalidUrls: string[] = [];
  const unsafeUrls: string[] = [];

  for (const url of urls) {
    if (!URL_PATTERN.test(url)) {
      invalidUrls.push(url);
      continue;
    }

    // SSRF prevention - block private/internal URLs
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
 * Extracts site name from URL for XML-RPC ping
 */
function extractSiteName(url: string): string {
  try {
    const parsed = new URL(url);
    // Use hostname without www. prefix
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Pings all services for a single URL with timeout protection
 *
 * @param url - The URL to ping
 * @param feedUrl - The feed URL for WebSub
 * @param functionStartTime - When the function started (for timeout calculation)
 */
async function pingAllServices(
  url: string,
  feedUrl: string,
  functionStartTime: number
): Promise<PingResult[]> {
  const results: PingResult[] = [];
  const siteName = extractSiteName(url);

  // Check if we have enough time remaining (need at least 10s for safe execution)
  const elapsedTime = Date.now() - functionStartTime;
  const remainingTime = MAX_FUNCTION_EXECUTION_MS - elapsedTime;

  if (remainingTime < 10000) {
    console.warn(`[Ping API] Insufficient time remaining (${remainingTime}ms), skipping pings`);
    return [{
      service: 'System',
      success: false,
      message: 'Function timeout approaching, request skipped',
      method: 'xmlrpc',
      responseTime: 0,
      error: 'Timeout protection triggered'
    }];
  }

  // Create all ping promises
  const promises: Promise<void>[] = [];

  // 1. WebSub ping to Google PubSubHubbub
  promises.push(
    notifyGoogleHub(feedUrl)
      .then(result => {
        results.push({
          service: WEBSUB_HUB.name,
          success: result.success,
          message: result.message,
          method: 'websub',
          responseTime: result.responseTime,
          error: result.success ? undefined : result.message
        });
      })
      .catch(error => {
        // Catch errors in .then() callback to prevent silent failures
        console.error('[WebSub] Unexpected error:', error instanceof Error ? error.message : error);
        results.push({
          service: WEBSUB_HUB.name,
          success: false,
          message: 'Failed to notify hub',
          method: 'websub',
          responseTime: 0,
          error: 'Request failed'
        });
      })
  );

  // 2. XML-RPC pings to all services
  for (const service of XMLRPC_SERVICES) {
    promises.push(
      sendXmlRpcPing(service, siteName, url)
        .then(result => {
          results.push({
            service: service.name,
            success: result.success,
            message: result.message,
            method: 'xmlrpc',
            responseTime: result.responseTime,
            error: result.success ? undefined : result.message
          });
        })
        .catch(error => {
          // Catch errors in .then() callback to prevent silent failures
          console.error(`[XMLRPC] ${service.name} unexpected error:`, error instanceof Error ? error.message : error);
          results.push({
            service: service.name,
            success: false,
            message: 'Service request failed',
            method: 'xmlrpc',
            responseTime: 0,
            error: 'Request failed'
          });
        })
    );
  }

  // Wait for all pings to complete
  await Promise.allSettled(promises);

  return results;
}

/**
 * Main handler for the ping endpoint
 */
export default async (req: Request, context: Context): Promise<Response> => {
  const startTime = Date.now();

  // CORS headers for frontend access
  // In development (localhost), allow all origins
  // In production, restrict to specific origin for security
  // App is hosted at tools.onwardseo.com (embedded via iframe on onwardseo.com)
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
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    // Validate request body size to prevent DoS attacks
    const contentLength = req.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (size > MAX_BODY_SIZE) {
        return new Response(JSON.stringify({
          error: 'Request body too large'
        }), {
          status: 413,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
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
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const { urls } = validation;

    // Build feed URL for WebSub
    // The feed endpoint is on the same origin
    const origin = new URL(req.url).origin;
    const feedUrl = `${origin}/api/feed?urls=${encodeURIComponent(urls.join(','))}`;

    // Ping all services for all URLs using batch processing
    // This limits concurrent requests to prevent rate limiting and resource exhaustion
    // BATCH_SIZE URLs × 3 services = max 6 concurrent requests
    const allResults: PingResult[] = [];
    const resultsPerUrl: PingResult[][] = [];

    // Process URLs in batches to limit concurrent requests
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      // Check timeout before processing each batch
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > MAX_FUNCTION_EXECUTION_MS) {
        console.warn(`[Ping API] Function timeout reached after ${elapsedTime}ms, stopping batch processing`);
        break;
      }

      const batch = urls.slice(i, i + BATCH_SIZE);

      // Process this batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (url) => {
          const urlResults = await pingAllServices(url, feedUrl, startTime);
          // Add URL context to each result
          return urlResults.map(r => ({
            ...r,
            message: `${r.message} (${extractSiteName(url)})`
          }));
        })
      );

      // Collect batch results
      resultsPerUrl.push(...batchResults);
    }

    // Flatten results - for simplicity, we aggregate by service
    // In a more complex implementation, we might want per-URL results
    const serviceResults = new Map<string, PingResult>();

    for (const urlResults of resultsPerUrl) {
      for (const result of urlResults) {
        const existing = serviceResults.get(result.service);
        if (!existing) {
          // First result for this service
          serviceResults.set(result.service, result);
        } else {
          // Aggregate: if any failed, mark as partial success
          if (!result.success && existing.success) {
            serviceResults.set(result.service, {
              ...existing,
              success: false,
              message: `Partial: some URLs failed`,
              error: result.error
            });
          }
        }
      }
    }

    allResults.push(...Array.from(serviceResults.values()));

    const totalTime = Date.now() - startTime;

    // Build response
    const response: PingResponse = {
      success: allResults.some(r => r.success),
      results: allResults,
      totalTime,
      feedUrl
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;

    // Log detailed error internally for debugging (not exposed to client)
    console.error('[Ping API] Unhandled error:', error instanceof Error ? error.message : error);

    const response: PingResponse = {
      success: false,
      results: [],
      totalTime
    };

    // Return generic message to prevent information disclosure
    return new Response(JSON.stringify({
      ...response,
      error: 'An error occurred while processing your request'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};

export const config: Config = {
  path: '/api/ping'
};
