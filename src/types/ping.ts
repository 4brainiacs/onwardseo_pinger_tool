export interface PingService {
  name: string;
  url: string;
  corsEnabled: boolean;
  method: 'GET' | 'POST';
  requiresProxy: boolean;
  proxyUrl: string;
}

export interface PingResult {
  url: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
  timestamp: number;
  error?: {
    code: string;
    details: string;
    service: string;
    retryable: boolean;
  };
}

export interface PingResponse {
  success: boolean;
  message: string;
  error?: {
    code: string;
    details: string;
    service: string;
  };
}

export type PingResults = Record<string, PingResult[]>;

export interface ProgressInfo {
  total: number;
  completed: number;
  currentUrl: string;
  currentService: string;
  errors: number;
  successes: number;
}