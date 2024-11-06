import React from 'react';
import { ErrorMessage } from './ErrorMessage';
import { ErrorRetryButton } from './ErrorRetryButton';
import { AppError, ErrorSeverity } from '../utils/errorHandler';
import { errorSeverityStyles } from '../utils/errorStyles';

interface ErrorContainerProps {
  error: Error;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorContainer({
  error,
  onRetry,
  onDismiss,
  className = ''
}: ErrorContainerProps) {
  const isAppError = error instanceof AppError;
  const severity = isAppError ? error.severity : ErrorSeverity.HIGH;
  const canRetry = isAppError ? error.retryable : true;
  const styles = errorSeverityStyles[severity];

  return (
    <div className={`rounded-lg border p-4 ${styles.container} ${className}`}>
      <ErrorMessage
        message={error.message}
        severity={severity}
        className="mb-4"
      />
      
      <div className="flex items-center gap-3">
        {canRetry && onRetry && (
          <ErrorRetryButton onClick={onRetry} />
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`text-sm ${styles.button} transition-colors`}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}