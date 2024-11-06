import { useContext } from 'react';
import type { ErrorContextValue } from '../context/ErrorContext';
import { ErrorContext } from '../context/ErrorContext';

export function useErrorContext(): ErrorContextValue {
  const context = useContext(ErrorContext);
  
  if (!context) {
    throw new Error('useErrorContext must be used within an ErrorProvider');
  }
  
  return context;
}