/**
 * WebSub/PubSubHubbub client for feed notifications
 *
 * Implements the W3C WebSub specification for notifying hubs about feed updates.
 * Used to notify Google's PubSubHubbub hub.
 *
 * @see https://www.w3.org/TR/websub/
 */

import type { WebSubResult } from './types';
import { WEBSUB_HUB } from './types';

/**
 * Notifies a WebSub hub about a feed update
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
 * @returns Promise resolving to notification result
 */
export async function notifyHub(
  feedUrl: string,
  hubUrl: string = WEBSUB_HUB.url,
  timeout: number = WEBSUB_HUB.timeout
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
 * Notifies Google's PubSubHubbub hub about a feed update
 *
 * This is a convenience wrapper around notifyHub that uses
 * the Google PubSubHubbub hub URL.
 *
 * @param feedUrl - The URL of the Atom/RSS feed that was updated
 * @returns Promise resolving to notification result
 */
export async function notifyGoogleHub(feedUrl: string): Promise<WebSubResult> {
  return notifyHub(feedUrl, WEBSUB_HUB.url, WEBSUB_HUB.timeout);
}
