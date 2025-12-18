/**
 * Ping Checker - Real API Integration
 *
 * Calls the /api/ping backend endpoint to perform actual pings
 * to search engines and blog services.
 *
 * In development mode (npm run dev), returns mock responses since
 * Netlify functions are not available locally.
 */

import type { PingService, PingResponse, ApiPingResponse, ApiPingResult } from '../types/ping';
import { validateUrl } from './urlUtils';
import { logger } from './logger';
import { AppError, ErrorSeverity } from './errorHandler';
import { REQUEST_TIMEOUT } from '../constants';
import { PING_SERVICES } from '../services/pingServices';

/**
 * Check if we're running in development mode
 * In dev mode, we use mock responses since backend is not available
 */
const IS_DEV_MODE = import.meta.env.DEV;

/**
 * Mock response delay range (ms) for realistic simulation
 */
const MOCK_DELAY_MIN = 200;
const MOCK_DELAY_MAX = 1500;

/**
 * Success rate for mock responses (0-1)
 * 90% success rate for realistic testing
 */
const MOCK_SUCCESS_RATE = 0.9;

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
 * Generates a random delay within the mock delay range
 */
function getRandomDelay(): number {
  return Math.floor(Math.random() * (MOCK_DELAY_MAX - MOCK_DELAY_MIN + 1)) + MOCK_DELAY_MIN;
}

/**
 * Generates mock ping responses for development mode
 * Simulates realistic responses with varying success/failure states
 */
async function generateMockResponse(urls: string[]): Promise<ApiPingResponse> {
  const startTime = Date.now();

  logger.info('[MOCK MODE] Generating mock ping responses', { urls });

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, getRandomDelay()));

  const results: ApiPingResult[] = PING_SERVICES.map(service => {
    const success = Math.random() < MOCK_SUCCESS_RATE;
    const responseTime = getRandomDelay();

    return {
      service: service.name,
      success,
      message: success
        ? `[MOCK] Successfully pinged ${service.name}`
        : `[MOCK] Failed to ping ${service.name}`,
      method: service.method as 'websub' | 'xmlrpc',
      responseTime,
      error: success ? undefined : '[MOCK] Simulated failure for testing'
    };
  });

  const totalTime = Date.now() - startTime;

  return {
    success: results.some(r => r.success),
    results,
    totalTime,
    feedUrl: `[MOCK] http://localhost/api/feed?urls=${encodeURIComponent(urls.join(','))}`
  };
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

  // In development mode, use mock responses since backend is not available
  if (IS_DEV_MODE) {
    logger.warn('[MOCK MODE] Using mock responses - backend not available in development');
    const mockResponse = await generateMockResponse(urls);

    // Cache the mock response
    responseCache.set(cacheKey, { response: mockResponse, timestamp: Date.now() });

    return mockResponse;
  }

  logger.info('Calling ping API', { urls, urlCount: urls.length });

  try {
    // Create timeout controller for request timeout
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT);

    try {
      // Combine timeout signal with external signal (if provided)
      // Request will abort on EITHER timeout OR external cancellation
      let combinedSignal: AbortSignal;

      if (signal) {
        // Use AbortSignal.any() if available (modern browsers)
        // Falls back to manual listener-based combination for older browsers
        if (typeof AbortSignal.any === 'function') {
          combinedSignal = AbortSignal.any([timeoutController.signal, signal]);
        } else {
          // Fallback: create a new controller that aborts when either signal fires
          const combinedController = new AbortController();

          const abortHandler = () => combinedController.abort();
          timeoutController.signal.addEventListener('abort', abortHandler);
          signal.addEventListener('abort', abortHandler);

          // Check if either signal is already aborted
          if (timeoutController.signal.aborted || signal.aborted) {
            combinedController.abort();
          }

          combinedSignal = combinedController.signal;
        }
      } else {
        // No external signal, just use timeout signal
        combinedSignal = timeoutController.signal;
      }

      const response = await fetch('/api/ping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ urls }),
        signal: combinedSignal
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
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to ping response
 */
export async function pingService(
  service: PingService,
  url: string,
  signal?: AbortSignal
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
    const apiResponse = await pingAllServices([url], signal);
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
