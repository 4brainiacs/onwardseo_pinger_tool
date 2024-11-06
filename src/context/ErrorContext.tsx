import React, { createContext } from 'react';
import type { ReactNode } from 'react';
import { AppError, ErrorSeverity } from '../types/errors';

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
  return (
    <ErrorContext.Provider value={{
      error: null,
      setError: () => {},
      clearError: () => {},
      severity: ErrorSeverity.MEDIUM
    }}>
      {children}
    </ErrorContext.Provider>
  );
}