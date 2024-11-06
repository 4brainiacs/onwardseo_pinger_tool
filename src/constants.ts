export const APP_VERSION = '1.2.26';

export const ERROR_MESSAGES = {
  NETWORK: 'Network error occurred. Please check your connection and try again.',
  TIMEOUT: 'The request timed out. Please try again.',
  VALIDATION: 'Invalid input provided. Please check your data and try again.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
  SERVER: 'Server error occurred. Please try again later.',
  OPERATION_FAILED: 'Operation failed. Please try again.',
  SERVICE_ERROR: 'Service is temporarily unavailable. Please try again later.'
} as const;

export const MAX_RETRIES = 3;
export const RETRY_DELAY = 1000;
export const REQUEST_TIMEOUT = 30000;