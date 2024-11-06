import { type ReactNode, createContext } from 'react';
import type { AppError, ErrorSeverity } from '../../types/errors';

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
  severity: 'medium'
});