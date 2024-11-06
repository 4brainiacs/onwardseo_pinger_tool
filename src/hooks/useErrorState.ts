import { useState, useCallback } from 'react';
import { AppError, ErrorSeverity } from '../types/errors';
import { handleError } from '../utils/errorHandler';
import { logger } from '../utils/logger';

interface ErrorState {
  error: AppError | null;
  isError: boolean;
  retryCount: number;
}

interface ErrorStateOptions {
  maxRetries?: number;
  onMaxRetriesReached?: () => void;
  logErrors?: boolean;
}

export function useErrorState(options: ErrorStateOptions = {}) {
  const {
    maxRetries = 3,
    onMaxRetriesReached,
    logErrors = true
  } = options;

  const [state, setState] = useState<ErrorState>({
    error: null,
    isError: false,
    retryCount: 0
  });

  const clearError = useCallback(() => {
    setState({
      error: null,
      isError: false,
      retryCount: 0
    });
  }, []);

  const setError = useCallback((error: unknown) => {
    const appError = error instanceof AppError ? error : handleError(error);
    
    if (logErrors) {
      logger.error('Error captured by useErrorState', {
        code: appError.code,
        severity: appError.severity,
        retryCount: state.retryCount,
        maxRetries
      });
    }

    setState(prev => ({
      error: appError,
      isError: true,
      retryCount: prev.retryCount + 1
    }));

    if (appError.severity === ErrorSeverity.CRITICAL) {
      onMaxRetriesReached?.();
    }
  }, [state.retryCount, maxRetries, logErrors, onMaxRetriesReached]);

  const retry = useCallback(async (operation: () => Promise<void>) => {
    if (state.retryCount >= maxRetries) {
      onMaxRetriesReached?.();
      return;
    }

    try {
      setState(prev => ({
        ...prev,
        isError: false,
        error: null
      }));

      await operation();
    } catch (error) {
      setError(error);
    }
  }, [state.retryCount, maxRetries, onMaxRetriesReached, setError]);

  const canRetry = state.retryCount < maxRetries && 
    state.error?.retryable !== false;

  return {
    error: state.error,
    isError: state.isError,
    retryCount: state.retryCount,
    setError,
    clearError,
    retry,
    canRetry
  };
}