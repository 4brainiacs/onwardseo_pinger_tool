/**
 * Ping-related type definitions
 */

/**
 * Ping service definition
 * Represents a real ping service that the backend calls
 */
export interface PingService {
  /** Display name of the service */
  name: string;
  /** Ping method used by the backend */
  method: 'websub' | 'xmlrpc';
  /** Service category for filtering */
  category: string;
  /** Human-readable description */
  description: string;
  /** List of downstream services this ping reaches */
  reachesServices: string[];
}

/**
 * Result of the address check the backend runs before pinging
 * (same shape as UrlCheck in netlify/functions/lib/types.ts)
 */
export interface ApiUrlCheck {
  /** The address as received */
  input: string;
  /** The address that was pinged, or null when nothing was pinged */
  pingUrl: string | null;
  finalUrl: string | null;
  canonicalUrl: string | null;
  status: number | null;
  verdict: 'ok' | 'redirected' | 'canonical' | 'not_found' | 'unreachable' | 'blocked' | 'unverified';
  /** What to tell the visitor; empty for 'ok' */
  note: string;
}

/**
 * Response from a ping operation
 */
export interface PingResponse {
  success: boolean;
  message: string;
  check?: ApiUrlCheck;
  error?: {
    code: string;
    details: string;
    service: string;
    retryable: boolean;
  };
}

/**
 * Result of a single ping operation for display
 */
export interface PingResult {
  url: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
  timestamp: number;
  check?: ApiUrlCheck;
  error?: {
    code: string;
    details: string;
    service: string;
    retryable: boolean;
  };
}

/**
 * Map of URL to array of ping results (one per service)
 */
export type PingResults = Record<string, PingResult[]>;

/**
 * Progress information for the UI
 */
export interface ProgressInfo {
  /** Total number of ping operations */
  total: number;
  /** Number of completed operations */
  completed: number;
  /** Currently processing URL */
  currentUrl: string;
  /** Currently processing service */
  currentService: string;
  /** Number of errors */
  errors: number;
  /** Number of successes */
  successes: number;
}

/**
 * Response from the /api/ping backend endpoint
 */
export interface ApiPingResponse {
  success: boolean;
  results: ApiPingResult[];
  totalTime: number;
  feedUrl?: string;
  checks?: ApiUrlCheck[];
  error?: string;
}

/**
 * Individual service result from the backend
 */
export interface ApiPingResult {
  service: string;
  success: boolean;
  message: string;
  method: 'xmlrpc' | 'websub';
  responseTime: number;
  error?: string;
}
