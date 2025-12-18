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
      stopLoading(); // Success path - clear loading without error
      onSuccess?.();
      return result;
    } catch (err) {
      // Preserve original error message if available, otherwise use default
      const message = err instanceof Error ? err.message : errorMessage;
      const error = err instanceof AppError
        ? err
        : new AppError(message, 'OPERATION_FAILED', {
            severity,
            context: { originalError: err }
          });

      logger.error('Async operation failed', {
        code: error.code,
        severity: error.severity,
        message: error.message
      });

      stopLoading(error); // Error path - clear loading WITH error preserved
      onError?.(error);
      return null;
    }
    // NOTE: No finally block - stopLoading is called explicitly in both paths
    // to prevent the error state from being overwritten
  }, [startLoading, stopLoading, errorMessage, severity, onSuccess, onError]);

  return {
    isLoading,
    error,
    execute,
    reset: resetState
  };
}