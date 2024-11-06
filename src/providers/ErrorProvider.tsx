import React, { useState, useCallback } from 'react';
import { ErrorContext } from '../context/ErrorContext';
import { AppError, ErrorSeverity, handleError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { useErrorMetrics } from '../hooks/useErrorMetrics';
import { useErrorNotification } from '../hooks/useErrorNotification';

interface ErrorProviderProps {
  children: React.ReactNode;
}

export function ErrorProvider({ children }: ErrorProviderProps) {
  const [error, setErrorState] = useState<AppError | null>(null);
  const { trackError } = useErrorMetrics();
  const { showNotification } = useErrorNotification();

  const setError = useCallback((err: unknown) => {
    const appError = err instanceof AppError ? err : handleError(err);
    
    logger.error('Error set in context', {
      code: appError.code,
      severity: appError.severity
    });
    
    trackError(appError);
    showNotification(appError);
    setErrorState(appError);
  }, [trackError, showNotification]);

  const clearError = useCallback(() => {
    setErrorState(null);
  }, []);

  const value = {
    error,
    setError,
    clearError,
    severity: error?.severity || ErrorSeverity.MEDIUM
  };

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
}