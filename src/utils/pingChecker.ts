/**
 * Ping Checker - Real API Integration
 *
 * Calls the /api/ping backend endpoint to perform actual pings
 * to search engines and blog services.
 */

import type { PingService, PingResponse, ApiPingResponse, ApiPingResult } from '../types/ping';
import { validateUrl } from './urlUtils';
import { logger } from './logger';
import { AppError, ErrorSeverity } from './errorHandler';
import { REQUEST_TIMEOUT } from '../constants';

/**
 * Custom error class for ping operations
 */
export class PingError extends AppError {
  constructor(
    message: string,
    code: string,
    public readonly service: string,
    options: {
      severity?: ErrorSeverity;
      retryable?: boolean;
      details?: string;
    } = {}
  ) {
    super(message, code, {
      severity: options.severity || ErrorSeverity.MEDIUM,
      retryable: options.retryable ?? true,
      context: {
        service,
        details: options.details
      }
    });
    this.name = 'PingError';
  }
}

/**
 * Cache for API responses to avoid duplicate calls
 * Key: comma-separated sorted URLs
 * Value: API response with timestamp
 */
const responseCache = new Map<string, { response: ApiPingResponse; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

/**
 * Generates a cache key from URLs
 */
function getCacheKey(urls: string[]): string {
  return [...urls].sort().join(',');
}

/**
 * Clears expired cache entries
 */
function clearExpiredCache(): void {
  const now = Date.now();
  for (const [key, value] of responseCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      responseCache.delete(key);
    }
  }
}

/**
 * Validates an array of URLs
 */
function validateUrls(urls: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!urls || urls.length === 0) {
    return { valid: false, errors: ['No URLs provided'] };
  }

  if (urls.length > 5) {
    return { valid: false, errors: ['Maximum 5 URLs allowed'] };
  }

  for (const url of urls) {
    const validation = validateUrl(url);
    if (!validation.isValid) {
      errors.push(`${url}: ${validation.errors.join(', ')}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Calls the /api/ping backend endpoint
 *
 * This function makes the actual HTTP request to the Netlify function
 * that performs real pings to search engines and blog services.
 *
 * @param urls - Array of URLs to ping (max 5)
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to the API response
 */
export async function pingAllServices(
  urls: string[],
  signal?: AbortSignal
): Promise<ApiPingResponse> {
  // Clear expired cache entries
  clearExpiredCache();

  // Check cache first
  const cacheKey = getCacheKey(urls);
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.debug('Returning cached ping response', { urls });
    return cached.response;
  }

  // Validate URLs
  const validation = validateUrls(urls);
  if (!validation.valid) {
    throw new PingError(
      'Invalid URLs',
      'VALIDATION_ERROR',
      'API',
      {
        severity: ErrorSeverity.HIGH,
        retryable: false,
        details: validation.errors.join('; ')
      }
    );
  }

  logger.info('Calling ping API', { urls, urlCount: urls.length });

  try {
    // Create timeout signal if not provided
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    // Combine signals if one was provided
    const effectiveSignal = signal || controller.signal;

    try {
      const response = await fetch('/api/ping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ urls }),
        signal: effectiveSignal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Use default error message
        }

        throw new PingError(
          errorMessage,
          'SERVER_ERROR',
          'API',
          {
            severity: ErrorSeverity.HIGH,
            retryable: response.status >= 500
          }
        );
      }

      const data: ApiPingResponse = await response.json();

      // Cache the response
      responseCache.set(cacheKey, { response: data, timestamp: Date.now() });

      logger.info('Ping API response received', {
        success: data.success,
        resultCount: data.results.length,
        totalTime: data.totalTime
      });

      return data;

    } finally {
      clearTimeout(timeoutId);
    }

  } catch (error) {
    if (error instanceof PingError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new PingError(
          'Request timed out or was cancelled',
          'TIMEOUT_ERROR',
          'API',
          {
            severity: ErrorSeverity.MEDIUM,
            retryable: true
          }
        );
      }

      throw new PingError(
        `Network error: ${error.message}`,
        'NETWORK_ERROR',
        'API',
        {
          severity: ErrorSeverity.HIGH,
          retryable: true
        }
      );
    }

    throw new PingError(
      'Unknown error occurred',
      'UNKNOWN_ERROR',
      'API',
      {
        severity: ErrorSeverity.HIGH,
        retryable: true
      }
    );
  }
}

/**
 * Gets the result for a specific service from the API response
 *
 * @param apiResponse - The full API response
 * @param serviceName - Name of the service to get result for
 * @returns The service result or undefined if not found
 */
export function getServiceResult(
  apiResponse: ApiPingResponse,
  serviceName: string
): ApiPingResult | undefined {
  return apiResponse.results.find(r => r.service === serviceName);
}

/**
 * Pings a single service (legacy interface for backward compatibility)
 *
 * This function is maintained for backward compatibility with existing code.
 * It calls pingAllServices internally and returns the result for the specified service.
 *
 * @param service - The service to ping
 * @param url - The URL to ping
 * @returns Promise resolving to ping response
 */
export async function pingService(
  service: PingService,
  url: string
): Promise<PingResponse> {
  const validation = validateUrl(url);
  if (!validation.isValid) {
    throw new PingError(
      'Invalid URL format',
      'VALIDATION_ERROR',
      service.name,
      {
        severity: ErrorSeverity.HIGH,
        retryable: false,
        details: validation.errors.join(', ')
      }
    );
  }

  try {
    const apiResponse = await pingAllServices([url]);
    const serviceResult = getServiceResult(apiResponse, service.name);

    if (!serviceResult) {
      // Service not found in response - this shouldn't happen with proper configuration
      logger.warn('Service not found in API response', { service: service.name });
      return {
        success: false,
        message: `Service ${service.name} not found in response`
      };
    }

    return {
      success: serviceResult.success,
      message: serviceResult.message,
      error: serviceResult.error ? {
        code: 'SERVICE_ERROR',
        details: serviceResult.error,
        service: service.name,
        retryable: true
      } : undefined
    };

  } catch (error) {
    if (error instanceof PingError) {
      return {
        success: false,
        message: error.message,
        error: {
          code: error.code,
          details: error.metadata?.details as string || error.message,
          service: service.name,
          retryable: error.retryable
        }
      };
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      error: {
        code: 'UNKNOWN_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
        service: service.name,
        retryable: true
      }
    };
  }
}

/**
 * Clears the response cache
 * Useful for forcing fresh pings
 */
export function clearPingCache(): void {
  responseCache.clear();
  logger.debug('Ping cache cleared');
}
