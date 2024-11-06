import React, { createContext, useState, useCallback, ReactNode } from 'react';
import { AppError, ErrorSeverity } from '../types/errors';
import { handleError } from '../utils/errorHandler';
import { logger } from '../utils/logger';

export interface ErrorContextValue {
  error: AppError | null;
  setError: (error: unknown) => void;
  clearError: () => void;
  severity: ErrorSeverity;
}

export const ErrorContext = createContext<ErrorContextValue>({
  error: null,
  setError: () => {},
  clearError: () => {},
  severity: ErrorSeverity.MEDIUM
});

interface ErrorProviderProps {
  children: ReactNode;
}

export function ErrorProvider({ children }: ErrorProviderProps) {
  const [error, setErrorState] = useState<AppError | null>(null);

  const setError = useCallback((err: unknown) => {
    const appError = err instanceof AppError ? err : handleError(err);
    logger.error('Error set in context', {
      code: appError.code,
      severity: appError.severity
    });
    setErrorState(appError);
  }, []);

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