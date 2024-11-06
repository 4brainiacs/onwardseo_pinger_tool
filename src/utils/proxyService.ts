import { logger } from './logger';
import { AppError, ErrorSeverity } from './errorHandler';

class ProxyError extends AppError {
  constructor(message: string, details?: string) {
    super(message, 'PROXY_ERROR', {
      severity: ErrorSeverity.HIGH,
      retryable: true,
      context: { details }
    });
    this.name = 'ProxyError';
  }
}

const PROXY_URLS = [
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://proxy.cors.sh/',
  'https://cors-anywhere.herokuapp.com/',
  'https://crossorigin.me/'
];

interface ProxyResponse {
  contents?: string;
  status?: {
    http_code: number;
  };
}

async function tryProxy(proxyUrl: string, targetUrl: string, options: RequestInit): Promise<Response> {
  const encodedUrl = encodeURIComponent(targetUrl);
  const proxyHeaders = {
    ...options.headers,
    'Origin': window.location.origin,
    'x-requested-with': 'XMLHttpRequest'
  };

  try {
    const response = await fetch(`${proxyUrl}${encodedUrl}`, {
      ...options,
      headers: proxyHeaders
    });

    if (!response.ok) {
      throw new ProxyError(
        `Proxy returned status ${response.status}`,
        response.statusText
      );
    }

    // Handle different proxy response formats
    if (proxyUrl.includes('allorigins')) {
      const data = await response.json() as ProxyResponse;
      if (!data.contents) {
        throw new ProxyError('Invalid proxy response format');
      }
      
      return new Response(data.contents, {
        status: data.status?.http_code || 200,
        headers: response.headers
      });
    }

    return response;
  } catch (error) {
    if (error instanceof ProxyError) {
      throw error;
    }
    
    throw new ProxyError(
      'Proxy request failed',
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function fetchWithProxy(url: string, options: RequestInit = {}): Promise<Response> {
  const errors: Error[] = [];
  
  for (const proxyUrl of PROXY_URLS) {
    try {
      logger.debug('Attempting proxy request', { proxyUrl, targetUrl: url });
      const response = await tryProxy(proxyUrl, url, options);
      logger.debug('Proxy request successful', { proxyUrl });
      return response;
    } catch (error) {
      logger.warn(`Proxy ${proxyUrl} failed`, {
        error: error instanceof Error ? error.message : String(error)
      });
      errors.push(error instanceof Error ? error : new Error(String(error)));
      continue;
    }
  }
  
  logger.error('All proxies failed', { 
    url,
    errors: errors.map(e => e.message)
  });

  throw new ProxyError(
    'All proxy servers failed',
    errors.map(e => e.message).join('; ')
  );
}