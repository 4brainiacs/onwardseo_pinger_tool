import { useContext } from 'react';
import type { ErrorContextValue } from './ErrorContext';
import { ErrorContext } from './ErrorContext';

export function useErrorContext(): ErrorContextValue {
  const context = useContext(ErrorContext);
  
  if (!context) {
    throw new Error('useErrorContext must be used within an ErrorProvider');
  }
  
  return context;
}