import { useCallback, useState } from 'react';
import { AppError, ErrorSeverity, handleError } from '../utils/errorHandler';
import { logger } from '../utils/logger';

interface AsyncErrorOptions {
  onError?: (error: AppError) => void;
  severity?: ErrorSeverity;
  retryable?: boolean;
}

export function useAsyncError(options: AsyncErrorOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const handleAsyncOperation = useCallback(async <T>(
    operation: () => Promise<T>,
    errorMessage = 'Operation failed'
  ): Promise<T | null> => {
    try {
      setIsLoading(true);
      setError(null);
      return await operation();
    } catch (err) {
      const appError = err instanceof AppError ? err : new AppError(
        errorMessage,
        'OPERATION_FAILED',
        {
          severity: options.severity || ErrorSeverity.MEDIUM,
          retryable: options.retryable ?? true,
          context: { originalError: err }
        }
      );

      logger.error(errorMessage, {
        code: appError.code,
        severity: appError.severity,
        metadata: appError.metadata
      });

      setError(appError);
      options.onError?.(appError);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    handleAsyncOperation,
    clearError
  };
}