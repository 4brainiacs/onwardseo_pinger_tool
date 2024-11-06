import { useCallback } from 'react';
import { useLoadingState } from './useLoadingState';
import { AppError, ErrorSeverity } from '../utils/errorHandler';
import { logger } from '../utils/logger';

interface AsyncOperationOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  errorMessage?: string;
  severity?: ErrorSeverity;
}

export function useAsyncOperation(options: AsyncOperationOptions = {}) {
  const {
    onSuccess,
    onError,
    errorMessage = 'Operation failed',
    severity = ErrorSeverity.MEDIUM
  } = options;

  const { isLoading, error, startLoading, stopLoading, resetState } = useLoadingState();

  const execute = useCallback(async <T>(
    operation: () => Promise<T>
  ): Promise<T | null> => {
    try {
      startLoading();
      const result = await operation();
      onSuccess?.();
      return result;
    } catch (err) {
      const error = err instanceof AppError
        ? err
        : new AppError(errorMessage, 'OPERATION_FAILED', {
            severity,
            context: { originalError: err }
          });

      logger.error('Async operation failed', {
        code: error.code,
        severity: error.severity,
        message: error.message
      });

      stopLoading(error);
      onError?.(error);
      return null;
    } finally {
      stopLoading();
    }
  }, [startLoading, stopLoading, errorMessage, severity, onSuccess, onError]);

  return {
    isLoading,
    error,
    execute,
    reset: resetState
  };
}