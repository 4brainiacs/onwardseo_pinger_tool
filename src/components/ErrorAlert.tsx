import React from 'react';
import { AlertCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { ErrorSeverity } from '../utils/errorHandler';
import { errorSeverityStyles } from '../utils/errorStyles';

interface ErrorAlertProps {
  title: string;
  message: string;
  severity?: ErrorSeverity;
  onDismiss?: () => void;
}

export function ErrorAlert({ 
  title, 
  message, 
  severity = ErrorSeverity.MEDIUM, 
  onDismiss 
}: ErrorAlertProps) {
  const styles = errorSeverityStyles[severity];

  const IconComponent = {
    [ErrorSeverity.LOW]: Info,
    [ErrorSeverity.MEDIUM]: AlertTriangle,
    [ErrorSeverity.HIGH]: AlertCircle,
    [ErrorSeverity.CRITICAL]: XCircle
  }[severity];

  return (
    <div className={`rounded-lg border p-4 ${styles.container}`} role="alert">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <IconComponent className={`h-5 w-5 ${styles.icon}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-medium ${styles.title}`}>
            {title}
          </h3>
          <div className={`mt-1 text-sm ${styles.message}`}>
            {message}
          </div>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className={`flex-shrink-0 rounded-lg p-1.5 ${styles.button} focus:outline-none focus:ring-2 focus:ring-offset-2`}
          >
            <span className="sr-only">Dismiss</span>
            <XCircle className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}