export interface PingService {
  name: string;
  url: string;
  method: 'GET' | 'POST';
  corsEnabled?: boolean;
  requiresProxy: boolean;
  proxyUrl: string;
}

export interface PingResponse {
  success: boolean;
  message: string;
  error?: {
    code: string;
    details: string;
    service: string;
    retryable: boolean;
  };
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