import { useCallback, useState } from 'react';
import { AppError, ErrorSeverity } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retryUtils';

interface RecoveryOptions {
  maxRetries?: number;
  onRecoveryStart?: () => void;
  onRecoveryComplete?: () => void;
  onRecoveryFailed?: (error: AppError) => void;
}

export function useErrorRecovery(options: RecoveryOptions = {}) {
  const {
    maxRetries = 3,
    onRecoveryStart,
    onRecoveryComplete,
    onRecoveryFailed
  } = options;

  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);

  const attemptRecovery = useCallback(async <T>(
    operation: () => Promise<T>,
    error: AppError
  ): Promise<T | null> => {
    if (!error.retryable || error.severity === ErrorSeverity.CRITICAL) {
      logger.warn('Recovery not possible for error', {
        code: error.code,
        retryable: error.retryable,
        severity: error.severity
      });
      return null;
    }

    try {
      setIsRecovering(true);
      onRecoveryStart?.();

      const result = await withRetry(operation, {
        maxRetries,
        onRetry: (_, attempt) => {
          setRecoveryAttempts(attempt);
          logger.info('Recovery attempt', { attempt, maxRetries });
        }
      });

      onRecoveryComplete?.();
      return result;
    } catch (recoveryError) {
      const appError = recoveryError instanceof AppError
        ? recoveryError
        : new AppError(
            'Recovery failed',
            'RECOVERY_FAILED',
            {
              severity: ErrorSeverity.HIGH,
              retryable: false,
              context: { originalError: error }
            }
          );

      logger.error('Recovery failed', {
        originalError: error,
        recoveryError: appError
      });

      onRecoveryFailed?.(appError);
      return null;
    } finally {
      setIsRecovering(false);
    }
  }, [maxRetries, onRecoveryStart, onRecoveryComplete, onRecoveryFailed]);

  const resetRecovery = useCallback(() => {
    setIsRecovering(false);
    setRecoveryAttempts(0);
  }, []);

  return {
    isRecovering,
    recoveryAttempts,
    attemptRecovery,
    resetRecovery
  };
}