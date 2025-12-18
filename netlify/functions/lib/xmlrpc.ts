/**
 * XML-RPC client for blog ping services
 *
 * Implements the weblogUpdates.ping method as per XML-RPC specification.
 * Used by Ping-o-Matic, Yandex Blogs, Twingly, Weblogs.com, and others.
 */

import type { XmlRpcPingResult, XmlRpcService } from './types';
import { DEFAULT_RETRY_COUNT, RETRY_DELAY_MS } from './types';

/**
 * Delays execution for a specified time
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determines if an error is retryable
 */
function isRetryableError(result: XmlRpcPingResult): boolean {
  // Retry on timeout or temporary unavailability
  return result.message.includes('timed out') ||
         result.message.includes('temporarily unavailable') ||
         result.message.includes('HTTP 5'); // 5xx errors
}

/**
 * Builds an XML-RPC request body for weblogUpdates.ping
 *
 * @param siteName - The name of the website being pinged
 * @param siteUrl - The URL of the website being pinged
 * @returns XML string conforming to XML-RPC specification
 */
export function buildXmlRpcRequest(siteName: string, siteUrl: string): string {
  // Escape XML special characters
  const escapedName = escapeXml(siteName);
  const escapedUrl = escapeXml(siteUrl);

  return `<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
  <methodName>weblogUpdates.ping</methodName>
  <params>
    <param>
      <value><string>${escapedName}</string></value>
    </param>
    <param>
      <value><string>${escapedUrl}</string></value>
    </param>
  </params>
</methodCall>`;
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
 * Decodes XML entities in a string
 * Handles standard XML entities and numeric character references
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Extracts text content from a value, handling CDATA and string wrappers
 */
function extractValueContent(valueBlock: string): string {
  // Try to extract from CDATA first
  const cdataMatch = valueBlock.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdataMatch) {
    return cdataMatch[1];
  }

  // Try to extract from <string> tag
  const stringMatch = valueBlock.match(/<string>([\s\S]*?)<\/string>/i);
  if (stringMatch) {
    return decodeXmlEntities(stringMatch[1]);
  }

  // Try to extract bare value (between <value> and </value>)
  const bareMatch = valueBlock.match(/<value>\s*([\s\S]*?)\s*<\/value>/i);
  if (bareMatch) {
    // Remove any nested tags and get text content
    const textContent = bareMatch[1].replace(/<[^>]+>/g, '').trim();
    return decodeXmlEntities(textContent);
  }

  return '';
}

/**
 * Parses XML-RPC response to extract flerror and message
 *
 * Expected response format:
 * <methodResponse>
 *   <params>
 *     <param>
 *       <value>
 *         <struct>
 *           <member>
 *             <name>flerror</name>
 *             <value><boolean>0</boolean></value>
 *           </member>
 *           <member>
 *             <name>message</name>
 *             <value>Thanks for the ping!</value>
 *           </member>
 *         </struct>
 *       </value>
 *     </param>
 *   </params>
 * </methodResponse>
 *
 * Handles variations:
 * - Whitespace between tags
 * - Entity-encoded content (&amp;, &lt;, etc.)
 * - CDATA sections
 * - Missing <string> wrappers
 */
export function parseXmlRpcResponse(xml: string): { flerror: boolean; message: string } {
  // Default values in case parsing fails
  let flerror = false;
  let message = 'Response received';

  try {
    // Normalize: collapse excessive whitespace between tags (but preserve content whitespace)
    const normalized = xml.replace(/>\s+</g, '><');

    // Extract flerror value
    // Look for <name>flerror</name> followed by <value><boolean>X</boolean></value>
    // Handle whitespace variations with flexible regex
    const flerrorMatch = normalized.match(
      /<name>flerror<\/name><value><boolean>(\d+)<\/boolean><\/value>/i
    );
    if (flerrorMatch) {
      flerror = flerrorMatch[1] !== '0';
    } else {
      // Fallback: try original whitespace-tolerant pattern
      const flerrorFallback = xml.match(
        /<name>\s*flerror\s*<\/name>\s*<value>\s*<boolean>\s*(\d+)\s*<\/boolean>\s*<\/value>/i
      );
      if (flerrorFallback) {
        flerror = flerrorFallback[1] !== '0';
      }
    }

    // Extract message value - find the member containing 'message' name
    // Use a multi-step approach for robustness
    const messageMemberMatch = normalized.match(
      /<member><name>message<\/name><value>([\s\S]*?)<\/value><\/member>/i
    ) || xml.match(
      /<member>\s*<name>\s*message\s*<\/name>\s*<value>([\s\S]*?)<\/value>\s*<\/member>/i
    );

    if (messageMemberMatch) {
      const valueContent = messageMemberMatch[1];
      const extracted = extractValueContent(`<value>${valueContent}</value>`);
      if (extracted) {
        message = extracted.trim();
      }
    } else {
      // Legacy fallback for simpler responses
      const legacyMatch = xml.match(
        /<name>\s*message\s*<\/name>\s*<value>(?:\s*<string>)?([^<]+)/i
      );
      if (legacyMatch) {
        message = decodeXmlEntities(legacyMatch[1].trim());
      }
    }

    // Check for fault response (error case)
    if (normalized.includes('<fault>') || xml.includes('<fault>')) {
      flerror = true;
      // Extract fault string
      const faultMatch = normalized.match(
        /<name>faultString<\/name><value>([\s\S]*?)<\/value>/i
      ) || xml.match(
        /<name>\s*faultString\s*<\/name>\s*<value>([\s\S]*?)<\/value>/i
      );
      if (faultMatch) {
        const faultContent = extractValueContent(`<value>${faultMatch[1]}</value>`);
        if (faultContent) {
          message = faultContent.trim();
        }
      }
    }
  } catch (error) {
    // If parsing fails, treat as error
    flerror = true;
    message = 'Failed to parse XML-RPC response';
  }

  return { flerror, message };
}

/**
 * Sends a single XML-RPC ping attempt (no retry)
 */
async function sendXmlRpcPingAttempt(
  service: XmlRpcService,
  siteName: string,
  siteUrl: string
): Promise<XmlRpcPingResult> {
  const startTime = Date.now();

  try {
    const requestBody = buildXmlRpcRequest(siteName, siteUrl);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), service.timeout);

    try {
      const response = await fetch(service.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'User-Agent': 'OnwardSEO-Pinger/2.0'
        },
        body: requestBody,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;

      // Check HTTP status
      if (!response.ok) {
        return {
          success: false,
          flerror: true,
          message: `HTTP ${response.status}: ${response.statusText}`,
          endpoint: service.endpoint,
          responseTime
        };
      }

      // Parse response body
      const responseText = await response.text();
      const parsed = parseXmlRpcResponse(responseText);

      return {
        success: !parsed.flerror,
        flerror: parsed.flerror,
        message: parsed.message,
        endpoint: service.endpoint,
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
          flerror: true,
          message: `Request timed out after ${service.timeout}ms`,
          endpoint: service.endpoint,
          responseTime
        };
      }

      // Log detailed error internally for debugging (not exposed to client)
      console.error(`[XMLRPC] ${service.name} (${service.endpoint}) failed:`, error.message);

      // Return generic message to prevent information disclosure
      return {
        success: false,
        flerror: true,
        message: 'Service temporarily unavailable',
        endpoint: service.endpoint,
        responseTime
      };
    }

    // Log unknown error type
    console.error(`[XMLRPC] ${service.name} unknown error:`, error);

    return {
      success: false,
      flerror: true,
      message: 'Service temporarily unavailable',
      endpoint: service.endpoint,
      responseTime
    };
  }
}

/**
 * Sends an XML-RPC ping to a blog ping service with retry logic
 *
 * @param service - The XML-RPC service configuration
 * @param siteName - The name of the website being pinged
 * @param siteUrl - The URL of the website being pinged
 * @returns Promise resolving to ping result
 */
export async function sendXmlRpcPing(
  service: XmlRpcService,
  siteName: string,
  siteUrl: string
): Promise<XmlRpcPingResult> {
  const maxRetries = service.maxRetries ?? DEFAULT_RETRY_COUNT;
  let lastResult: XmlRpcPingResult | null = null;
  let totalResponseTime = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Exponential backoff delay (skip on first attempt)
    if (attempt > 0) {
      const backoffDelay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`[XMLRPC] ${service.name} retry ${attempt}/${maxRetries} after ${backoffDelay}ms`);
      await delay(backoffDelay);
    }

    const result = await sendXmlRpcPingAttempt(service, siteName, siteUrl);
    totalResponseTime += result.responseTime;
    lastResult = result;

    // Success - return immediately
    if (result.success) {
      if (attempt > 0) {
        console.log(`[XMLRPC] ${service.name} succeeded on retry ${attempt}`);
      }
      return result;
    }

    // Check if error is retryable
    if (!isRetryableError(result)) {
      // Non-retryable error (e.g., 4xx HTTP error) - don't retry
      console.log(`[XMLRPC] ${service.name} non-retryable error: ${result.message}`);
      return result;
    }

    // Retryable error - continue to next attempt if retries remaining
    if (attempt < maxRetries) {
      console.log(`[XMLRPC] ${service.name} failed (retryable): ${result.message}`);
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
    flerror: true,
    message: 'Unknown error occurred',
    endpoint: service.endpoint,
    responseTime: totalResponseTime
  };
}

/**
 * Pings multiple XML-RPC services in parallel
 *
 * @param services - Array of XML-RPC service configurations
 * @param siteName - The name of the website being pinged
 * @param siteUrl - The URL of the website being pinged
 * @returns Promise resolving to array of ping results
 */
export async function pingAllXmlRpcServices(
  services: XmlRpcService[],
  siteName: string,
  siteUrl: string
): Promise<XmlRpcPingResult[]> {
  const pingPromises = services.map(service =>
    sendXmlRpcPing(service, siteName, siteUrl)
  );

  return Promise.all(pingPromises);
}
