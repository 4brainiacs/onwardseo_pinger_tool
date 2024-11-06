import { ERROR_MESSAGES } from '../constants';
import { AppError, ErrorSeverity } from '../types/errors';
import { logger } from './logger';

export function handleError(error: unknown): AppError {
  if (error instanceof AppError) {
    logError('ErrorHandler', error, error.metadata);
    return error;
  }

  if (error instanceof Error) {
    // Network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return new AppError(ERROR_MESSAGES.NETWORK, 'NETWORK_ERROR', {
        severity: ErrorSeverity.HIGH,
        retryable: true,
        context: { originalError: error }
      });
    }

    // Timeout errors
    if (error.name === 'AbortError') {
      return new AppError(ERROR_MESSAGES.TIMEOUT, 'TIMEOUT_ERROR', {
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
        context: { originalError: error }
      });
    }

    return new AppError(error.message, 'UNKNOWN_ERROR', {
      severity: ErrorSeverity.MEDIUM,
      context: { originalError: error }
    });
  }

  return new AppError(
    typeof error === 'string' ? error : ERROR_MESSAGES.UNKNOWN,
    'UNKNOWN_ERROR',
    {
      severity: ErrorSeverity.HIGH,
      context: { originalError: error }
    }
  );
}

export function logError(
  context: string,
  error: Error,
  metadata?: Record<string, unknown>
): void {
  const errorInfo = {
    context,
    timestamp: Date.now(),
    metadata: {
      ...metadata,
      stack: error.stack
    }
  };

  if (error instanceof AppError) {
    logger.error(error.message, {
      ...errorInfo,
      code: error.code,
      severity: error.severity
    });
  } else {
    logger.error(error.message, errorInfo);
  }
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.retryable && error.severity !== ErrorSeverity.CRITICAL;
  }
  return false;
}

export { AppError, ErrorSeverity };