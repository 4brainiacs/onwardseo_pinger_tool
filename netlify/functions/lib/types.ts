/**
 * Shared types for Netlify ping functions
 */

// XML-RPC ping result
export interface XmlRpcPingResult {
  success: boolean;
  flerror: boolean;
  message: string;
  endpoint: string;
  responseTime: number;
}

// WebSub notification result
export interface WebSubResult {
  success: boolean;
  statusCode: number;
  message: string;
  hubUrl: string;
  responseTime: number;
  retryAfter?: number; // Seconds to wait before retrying (from Retry-After header)
}

// Individual ping result for API response
export interface PingResult {
  service: string;
  success: boolean;
  message: string;
  method: 'xmlrpc' | 'websub';
  responseTime: number;
  error?: string;
}

// Request body for /api/ping endpoint
export interface PingRequest {
  urls: string[];
}

// Response body for /api/ping endpoint
export interface PingResponse {
  success: boolean;
  results: PingResult[];
  totalTime: number;
  feedUrl?: string;
}

// XML-RPC service configuration
export interface XmlRpcService {
  name: string;
  endpoint: string;
  timeout: number;
  maxRetries?: number; // Optional retry count (default: 2)
}

// Retry configuration
// IMPORTANT: Netlify Functions have a 30-second execution limit
// Keep retries minimal to avoid timeout
export const DEFAULT_RETRY_COUNT = 1;
export const RETRY_DELAY_MS = 500; // Reduced base delay for exponential backoff

// Function execution safety margin
// Netlify limit is 30s, we use 25s to ensure graceful completion
export const MAX_FUNCTION_EXECUTION_MS = 25000;

// List of XML-RPC ping services
// Verified working as of December 2025
// REMOVED: Yandex Blogs (deprecated/blocking automated requests)
// REMOVED: Weblogs.com (unreliable, 30s+ response times)
export const XMLRPC_SERVICES: XmlRpcService[] = [
  {
    name: 'Ping-o-Matic',           // WordPress Foundation service - most reliable
    endpoint: 'http://rpc.pingomatic.com/RPC2',
    timeout: 10000,                  // 10s timeout (reduced from 15s)
    maxRetries: 1                    // Reduced from 2
  },
  {
    name: 'Twingly',                // Swedish blog search engine
    endpoint: 'https://rpc.twingly.com/',  // HTTPS required per Twingly docs
    timeout: 10000,                  // 10s timeout (reduced from 15s)
    maxRetries: 1                    // Reduced from 2
  }
];

// WebSub hub configuration
// Google's hub still uses the PubSubHubbub name (protocol is now WebSub per W3C)
export const WEBSUB_HUB = {
  name: 'Google PubSubHubbub',       // Official Google hub name
  url: 'https://pubsubhubbub.appspot.com/',
  timeout: 10000,                    // 10s timeout (reduced from 15s)
  maxRetries: 1                      // Reduced from 2
};

// Validation constants
export const MAX_URLS = 5;
export const MAX_BODY_SIZE = 50 * 1024; // 50KB - sufficient for 5 URLs with metadata
export const URL_PATTERN = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

// Batch processing - limits concurrent requests to prevent rate limiting
// 2 URLs × 3 services (Google, Ping-o-Matic, Twingly) = 6 concurrent requests max
export const BATCH_SIZE = 2;

// SSRF prevention - block private/internal IP ranges
const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]'
];

const PRIVATE_IP_PATTERNS = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,      // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/, // 172.16.0.0/12
  /^192\.168\.\d{1,3}\.\d{1,3}$/,          // 192.168.0.0/16
  /^169\.254\.\d{1,3}\.\d{1,3}$/,          // Link-local
  /^fc[0-9a-f]{2}:/i,                       // IPv6 unique local
  /^fe80:/i                                  // IPv6 link-local
];

/**
 * Validates that a URL doesn't target internal/private networks (SSRF prevention)
 */
export function isUrlSafe(url: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Block localhost and known dangerous hosts
    if (BLOCKED_HOSTS.includes(hostname)) {
      return { safe: false, reason: 'Localhost URLs are not allowed' };
    }

    // Block private IP ranges
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { safe: false, reason: 'Private IP addresses are not allowed' };
      }
    }

    // Block file:// and other non-http schemes (shouldn't pass URL_PATTERN but double-check)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { safe: false, reason: 'Only HTTP/HTTPS URLs are allowed' };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }
}
