/**
 * Main Ping API Endpoint
 *
 * Receives URLs and pings multiple services:
 * 1. Google PubSubHubbub (via WebSub protocol)
 * 2. Ping-o-Matic (XML-RPC) - reaches 10+ downstream services
 * 3. Yandex Blogs (XML-RPC)
 * 4. Twingly (XML-RPC)
 * 5. Weblogs.com (XML-RPC)
 *
 * Endpoint: POST /api/ping
 * Body: { urls: string[] }
 */

import type { Context, Config } from '@netlify/functions';
import type { PingRequest, PingResponse, PingResult } from './lib/types';
import { XMLRPC_SERVICES, WEBSUB_HUB, MAX_URLS, URL_PATTERN } from './lib/types';
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

  // Validate each URL format
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
      error: `Invalid URL format: ${invalidUrls.slice(0, 3).join(', ')}${invalidUrls.length > 3 ? '...' : ''}`
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
 * Pings all services for a single URL
 */
async function pingAllServices(
  url: string,
  feedUrl: string
): Promise<PingResult[]> {
  const results: PingResult[] = [];
  const siteName = extractSiteName(url);

  // Create all ping promises
  const promises: Promise<void>[] = [];

  // 1. WebSub ping to Google PubSubHubbub
  promises.push(
    notifyGoogleHub(feedUrl).then(result => {
      results.push({
        service: WEBSUB_HUB.name,
        success: result.success,
        message: result.message,
        method: 'websub',
        responseTime: result.responseTime,
        error: result.success ? undefined : result.message
      });
    })
  );

  // 2. XML-RPC pings to all services
  for (const service of XMLRPC_SERVICES) {
    promises.push(
      sendXmlRpcPing(service, siteName, url).then(result => {
        results.push({
          service: service.name,
          success: result.success,
          message: result.message,
          method: 'xmlrpc',
          responseTime: result.responseTime,
          error: result.success ? undefined : result.message
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
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
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

    // Ping all services for all URLs in parallel
    const allResults: PingResult[] = [];

    // For each URL, ping all services
    // We'll aggregate results across all URLs
    const urlPromises = urls.map(async (url) => {
      const urlResults = await pingAllServices(url, feedUrl);
      // Add URL context to each result
      return urlResults.map(r => ({
        ...r,
        message: `${r.message} (${extractSiteName(url)})`
      }));
    });

    const resultsPerUrl = await Promise.all(urlPromises);

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

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    const response: PingResponse = {
      success: false,
      results: [],
      totalTime
    };

    return new Response(JSON.stringify({
      ...response,
      error: `Server error: ${errorMessage}`
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};

export const config: Config = {
  path: '/api/ping'
};
