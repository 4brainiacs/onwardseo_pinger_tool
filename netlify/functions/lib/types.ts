/**
 * Shared types for Netlify ping functions
 */

// XML-RPC ping result
export interface XmlRpcPingResult {
  success: boolean;
  flerror: boolean;
  message: string;
  endpoint: string;
  responseTime: number;
}

// WebSub notification result
export interface WebSubResult {
  success: boolean;
  statusCode: number;
  message: string;
  hubUrl: string;
  responseTime: number;
}

// Individual ping result for API response
export interface PingResult {
  service: string;
  success: boolean;
  message: string;
  method: 'xmlrpc' | 'websub';
  responseTime: number;
  error?: string;
}

// Request body for /api/ping endpoint
export interface PingRequest {
  urls: string[];
}

// Response body for /api/ping endpoint
export interface PingResponse {
  success: boolean;
  results: PingResult[];
  totalTime: number;
  feedUrl?: string;
}

// XML-RPC service configuration
export interface XmlRpcService {
  name: string;
  endpoint: string;
  timeout: number;
}

// List of XML-RPC ping services
export const XMLRPC_SERVICES: XmlRpcService[] = [
  {
    name: 'Ping-o-Matic',
    endpoint: 'http://rpc.pingomatic.com/RPC2',
    timeout: 10000
  },
  {
    name: 'Yandex Blogs',
    endpoint: 'http://ping.blogs.yandex.ru/RPC2',
    timeout: 10000
  },
  {
    name: 'Twingly',
    endpoint: 'http://rpc.twingly.com/',
    timeout: 10000
  },
  {
    name: 'Weblogs.com',
    endpoint: 'http://rpc.weblogs.com/RPC2',
    timeout: 10000
  }
];

// WebSub hub configuration
export const WEBSUB_HUB = {
  name: 'Google PubSubHubbub',
  url: 'https://pubsubhubbub.appspot.com/',
  timeout: 10000
};

// Validation constants
export const MAX_URLS = 5;
export const URL_PATTERN = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
