import { useCallback } from 'react';
import { AppError, ErrorSeverity } from '../types/errors';
import { useErrorContext } from '../context';
import { logger } from '../utils/logger';

interface ErrorHandlerOptions {
  severity?: ErrorSeverity;
  context?: string;
  retryable?: boolean;
}

export function useErrorHandler(options: ErrorHandlerOptions = {}) {
  const { 
    severity = ErrorSeverity.MEDIUM,
    context = 'unknown',
    retryable = true
  } = options;

  const { setError, clearError } = useErrorContext();

  const handleError = useCallback((error: unknown, message?: string) => {
    const appError = error instanceof AppError
      ? error
      : new AppError(
          message || 'An error occurred',
          'HANDLED_ERROR',
          {
            severity,
            retryable,
            context: { source: context }
          }
        );

    logger.error('Error handled', {
      code: appError.code,
      severity: appError.severity,
      context
    });

    setError(appError);
    return appError;
  }, [context, severity, retryable, setError]);

  return {
    handleError,
    clearError
  };
}