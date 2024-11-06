import { useContext } from 'react';
import { ErrorContext, ErrorContextValue } from '../context/ErrorContext';

export function useErrorContext(): ErrorContextValue {
  const context = useContext(ErrorContext);
  
  if (!context) {
    throw new Error('useErrorContext must be used within an ErrorProvider');
  }
  
  return context;
}