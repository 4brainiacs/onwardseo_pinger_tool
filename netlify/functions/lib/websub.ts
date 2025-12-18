/**
 * WebSub/PubSubHubbub client for feed notifications
 *
 * Implements the W3C WebSub specification for notifying hubs about feed updates.
 * Used to notify Google's PubSubHubbub hub.
 *
 * @see https://www.w3.org/TR/websub/
 */

import type { WebSubResult } from './types';
import { WEBSUB_HUB, DEFAULT_RETRY_COUNT, RETRY_DELAY_MS } from './types';

/**
 * Delays execution for a specified time
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determines if a WebSub result is retryable
 */
function isRetryableError(result: WebSubResult): boolean {
  // Retry on timeout or 5xx errors
  return result.message.includes('timed out') ||
         result.message.includes('Network error') ||
         (result.statusCode >= 500 && result.statusCode < 600);
}

/**
 * Sends a single WebSub notification attempt (no retry)
 */
async function notifyHubAttempt(
  feedUrl: string,
  hubUrl: string,
  timeout: number
): Promise<WebSubResult> {
  const startTime = Date.now();

  try {
    // Build form-urlencoded body
    const body = new URLSearchParams({
      'hub.mode': 'publish',
      'hub.url': feedUrl
    });

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(hubUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'OnwardSEO-Pinger/2.0'
        },
        body: body.toString(),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;

      // Handle rate limiting (429) and service unavailable (503) specially
      if (response.status === 429 || response.status === 503) {
        const retryAfterHeader = response.headers.get('Retry-After');
        let retrySeconds = 60; // Default to 60 seconds if no header

        if (retryAfterHeader) {
          // Retry-After can be either seconds (integer) or HTTP-date
          if (/^\d+$/.test(retryAfterHeader)) {
            // It's a number of seconds
            retrySeconds = parseInt(retryAfterHeader, 10);
          } else {
            // Try parsing as HTTP-date
            try {
              const retryDate = new Date(retryAfterHeader);
              if (!isNaN(retryDate.getTime())) {
                retrySeconds = Math.max(0, Math.ceil((retryDate.getTime() - Date.now()) / 1000));
              }
            } catch {
              // Keep default if parsing fails
            }
          }
        }

        return {
          success: false,
          statusCode: response.status,
          message: response.status === 429
            ? `Rate limited. Retry after ${retrySeconds}s`
            : `Service unavailable. Retry after ${retrySeconds}s`,
          hubUrl,
          responseTime,
          retryAfter: retrySeconds
        };
      }

      // WebSub specification:
      // - 204 No Content = success
      // - 202 Accepted = success (hub will verify asynchronously)
      // - 4xx/5xx = error
      const success = response.status >= 200 && response.status < 300;

      let message: string;
      if (success) {
        message = 'Hub notified successfully';
      } else {
        // Try to get error message from response body
        try {
          const errorText = await response.text();
          message = errorText.trim() || `HTTP ${response.status}: ${response.statusText}`;
        } catch {
          message = `HTTP ${response.status}: ${response.statusText}`;
        }
      }

      return {
        success,
        statusCode: response.status,
        message,
        hubUrl,
        responseTime
      };

    } finally {
      clearTimeout(timeoutId);
    }

  } catch (error) {
    const responseTime = Date.now() - startTime;

    // Handle specific error types
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          statusCode: 0,
          message: `Request timed out after ${timeout}ms`,
          hubUrl,
          responseTime
        };
      }

      return {
        success: false,
        statusCode: 0,
        message: `Network error: ${error.message}`,
        hubUrl,
        responseTime
      };
    }

    return {
      success: false,
      statusCode: 0,
      message: 'Unknown error occurred',
      hubUrl,
      responseTime
    };
  }
}

/**
 * Notifies a WebSub hub about a feed update with retry logic
 *
 * Protocol:
 * POST to hub URL with:
 * - Content-Type: application/x-www-form-urlencoded
 * - Body: hub.mode=publish&hub.url=<feed_url>
 *
 * Expected responses:
 * - 204 No Content: Success
 * - 4xx/5xx: Error
 *
 * @param feedUrl - The URL of the Atom/RSS feed that was updated
 * @param hubUrl - The WebSub hub URL (defaults to Google PubSubHubbub)
 * @param timeout - Request timeout in milliseconds
 * @param maxRetries - Maximum number of retry attempts
 * @returns Promise resolving to notification result
 */
export async function notifyHub(
  feedUrl: string,
  hubUrl: string = WEBSUB_HUB.url,
  timeout: number = WEBSUB_HUB.timeout,
  maxRetries: number = WEBSUB_HUB.maxRetries ?? DEFAULT_RETRY_COUNT
): Promise<WebSubResult> {
  let lastResult: WebSubResult | null = null;
  let totalResponseTime = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Exponential backoff delay (skip on first attempt)
    if (attempt > 0) {
      const backoffDelay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`[WebSub] ${WEBSUB_HUB.name} retry ${attempt}/${maxRetries} after ${backoffDelay}ms`);
      await delay(backoffDelay);
    }

    const result = await notifyHubAttempt(feedUrl, hubUrl, timeout);
    totalResponseTime += result.responseTime;
    lastResult = result;

    // Success - return immediately
    if (result.success) {
      if (attempt > 0) {
        console.log(`[WebSub] ${WEBSUB_HUB.name} succeeded on retry ${attempt}`);
      }
      return result;
    }

    // Check if error is retryable
    if (!isRetryableError(result)) {
      // Non-retryable error (e.g., 4xx HTTP error, rate limited) - don't retry
      console.log(`[WebSub] ${WEBSUB_HUB.name} non-retryable error: ${result.message}`);
      return result;
    }

    // Retryable error - continue to next attempt if retries remaining
    if (attempt < maxRetries) {
      console.log(`[WebSub] ${WEBSUB_HUB.name} failed (retryable): ${result.message}`);
    }
  }

  // All retries exhausted - return last result with retry info
  if (lastResult) {
    const retriedMsg = maxRetries > 0
      ? ` (after ${maxRetries + 1} attempts)`
      : '';
    return {
      ...lastResult,
      message: `${lastResult.message}${retriedMsg}`,
      responseTime: totalResponseTime
    };
  }

  // Fallback (should never reach here)
  return {
    success: false,
    statusCode: 0,
    message: 'Unknown error occurred',
    hubUrl,
    responseTime: totalResponseTime
  };
}

/**
 * Notifies Google's PubSubHubbub hub about a feed update
 *
 * This is a convenience wrapper around notifyHub that uses
 * the Google PubSubHubbub hub URL.
 *
 * @param feedUrl - The URL of the Atom/RSS feed that was updated
 * @returns Promise resolving to notification result
 */
export async function notifyGoogleHub(feedUrl: string): Promise<WebSubResult> {
  return notifyHub(feedUrl, WEBSUB_HUB.url, WEBSUB_HUB.timeout, WEBSUB_HUB.maxRetries ?? DEFAULT_RETRY_COUNT);
}
