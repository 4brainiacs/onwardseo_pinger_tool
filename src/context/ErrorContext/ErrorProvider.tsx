import { type ReactNode, useState, useCallback } from 'react';
import type { AppError, ErrorSeverity } from '../../types/errors';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { ErrorContext } from './ErrorContext';

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
    severity: error?.severity || 'medium' as ErrorSeverity
  };

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
}