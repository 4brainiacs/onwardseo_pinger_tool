import React from 'react';
import { AlertCircle } from 'lucide-react';
import { ErrorSeverity } from '../utils/errorHandler';
import { errorSeverityStyles } from '../utils/errorStyles';

interface ErrorMessageProps {
  message: string;
  severity?: ErrorSeverity;
  className?: string;
}

export function ErrorMessage({ 
  message, 
  severity = ErrorSeverity.MEDIUM,
  className = ''
}: ErrorMessageProps) {
  const styles = errorSeverityStyles[severity];
  
  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <AlertCircle className={`h-4 w-4 ${styles.icon} flex-shrink-0`} />
      <span className={styles.message}>{message}</span>
    </div>
  );
}