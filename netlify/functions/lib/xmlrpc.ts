/**
 * XML-RPC client for blog ping services
 *
 * Implements the weblogUpdates.ping method as per XML-RPC specification.
 * Used by Ping-o-Matic, Yandex Blogs, Twingly, Weblogs.com, and others.
 */

import type { XmlRpcPingResult, XmlRpcService } from './types';

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
 */
export function parseXmlRpcResponse(xml: string): { flerror: boolean; message: string } {
  // Default values in case parsing fails
  let flerror = false;
  let message = 'Response received';

  try {
    // Extract flerror value
    // Look for <name>flerror</name> followed by <value><boolean>X</boolean></value>
    const flerrorMatch = xml.match(
      /<name>\s*flerror\s*<\/name>\s*<value>\s*<boolean>\s*(\d+)\s*<\/boolean>\s*<\/value>/i
    );
    if (flerrorMatch) {
      flerror = flerrorMatch[1] !== '0';
    }

    // Extract message value
    // Look for <name>message</name> followed by <value>...</value> or <value><string>...</string></value>
    const messageMatch = xml.match(
      /<name>\s*message\s*<\/name>\s*<value>(?:\s*<string>)?([^<]+)(?:<\/string>\s*)?<\/value>/i
    );
    if (messageMatch) {
      message = messageMatch[1].trim();
    }

    // Check for fault response (error case)
    if (xml.includes('<fault>')) {
      flerror = true;
      const faultMatch = xml.match(/<name>\s*faultString\s*<\/name>\s*<value>(?:\s*<string>)?([^<]+)/i);
      if (faultMatch) {
        message = faultMatch[1].trim();
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
 * Sends an XML-RPC ping to a blog ping service
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

      return {
        success: false,
        flerror: true,
        message: `Network error: ${error.message}`,
        endpoint: service.endpoint,
        responseTime
      };
    }

    return {
      success: false,
      flerror: true,
      message: 'Unknown error occurred',
      endpoint: service.endpoint,
      responseTime
    };
  }
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
