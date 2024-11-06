import { useCallback, useState } from 'react';
import { AppError, ErrorSeverity } from '../utils/errorHandler';
import { logger } from '../utils/logger';

interface ErrorBoundaryState {
  error: Error | null;
  hasError: boolean;
}

export function useErrorBoundary() {
  const [state, setState] = useState<ErrorBoundaryState>({
    error: null,
    hasError: false
  });

  const handleError = useCallback((error: Error) => {
    const severity = error instanceof AppError ? error.severity : ErrorSeverity.HIGH;
    
    logger.error('Error boundary caught error', {
      severity,
      error: error instanceof AppError ? error.toJSON() : error
    });

    setState({
      error,
      hasError: true
    });
  }, []);

  const resetError = useCallback(() => {
    setState({
      error: null,
      hasError: false
    });
  }, []);

  return {
    ...state,
    handleError,
    resetError
  };
}