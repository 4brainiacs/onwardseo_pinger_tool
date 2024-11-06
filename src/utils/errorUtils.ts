import { AppError, ErrorSeverity } from './errorHandler';
import { logger } from './logger';

interface ErrorMetrics {
  totalErrors: number;
  errorsByCode: Record<string, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  lastError?: AppError;
  startTime: number;
}

class ErrorMetricsTracker {
  private metrics: ErrorMetrics = {
    totalErrors: 0,
    errorsByCode: {},
    errorsBySeverity: {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0
    },
    startTime: Date.now()
  };

  trackError(error: AppError): void {
    this.metrics.totalErrors++;
    this.metrics.lastError = error;
    
    // Track by error code
    this.metrics.errorsByCode[error.code] = 
      (this.metrics.errorsByCode[error.code] || 0) + 1;
    
    // Track by severity
    this.metrics.errorsBySeverity[error.severity]++;

    // Log metrics update
    logger.debug('Error metrics updated', {
      metrics: this.getMetrics()
    });
  }

  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {
      totalErrors: 0,
      errorsByCode: {},
      errorsBySeverity: {
        [ErrorSeverity.LOW]: 0,
        [ErrorSeverity.MEDIUM]: 0,
        [ErrorSeverity.HIGH]: 0,
        [ErrorSeverity.CRITICAL]: 0
      },
      startTime: Date.now()
    };
  }
}

export const errorMetrics = new ErrorMetricsTracker();

export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return String(error);
}

export function getErrorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof AppError) {
    return {
      code: error.code,
      severity: error.severity,
      retryable: error.retryable,
      metadata: error.metadata
    };
  }
  
  if (error instanceof Error) {
    return {
      name: error.name,
      stack: error.stack
    };
  }
  
  return {
    type: typeof error,
    value: error
  };
}

export function shouldRetryError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.retryable && error.severity !== ErrorSeverity.CRITICAL;
  }
  
  return false;
}

export function getErrorSeverityColor(severity: ErrorSeverity): string {
  switch (severity) {
    case ErrorSeverity.LOW:
      return 'blue';
    case ErrorSeverity.MEDIUM:
      return 'yellow';
    case ErrorSeverity.HIGH:
      return 'red';
    case ErrorSeverity.CRITICAL:
      return 'red';
    default:
      return 'gray';
  }
}