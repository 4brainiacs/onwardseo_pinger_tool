import { createContext } from 'react';
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