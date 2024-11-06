import { useCallback } from 'react';
import { AppError, ErrorSeverity } from '../utils/errorHandler';
import { logger } from '../utils/logger';

interface NotificationOptions {
  duration?: number;
  autoClose?: boolean;
}

export function useErrorNotification(defaultOptions: NotificationOptions = {}) {
  const { duration = 5000, autoClose = true } = defaultOptions;

  const showNotification = useCallback((error: AppError) => {
    logger.info('Showing error notification', {
      code: error.code,
      severity: error.severity,
      message: error.message
    });

    // Here you would integrate with your notification system
    // For now, we'll just log the error
    const severityStyles = {
      [ErrorSeverity.LOW]: 'info',
      [ErrorSeverity.MEDIUM]: 'warning',
      [ErrorSeverity.HIGH]: 'error',
      [ErrorSeverity.CRITICAL]: 'error'
    };

    console.error(
      `[${severityStyles[error.severity]}] ${error.code}: ${error.message}`
    );

    if (autoClose) {
      setTimeout(() => {
        logger.debug('Auto-closing error notification', {
          code: error.code,
          duration
        });
      }, duration);
    }
  }, [duration, autoClose]);

  return {
    showNotification
  };
}