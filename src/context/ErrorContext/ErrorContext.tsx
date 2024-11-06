import React, { createContext, useState, useCallback, ReactNode } from 'react';
import { AppError, ErrorSeverity } from '../../types/errors';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

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