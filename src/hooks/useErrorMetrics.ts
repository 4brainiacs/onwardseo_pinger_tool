import { useEffect, useCallback } from 'react';
import { errorMetrics } from '../utils/errorUtils';
import { AppError } from '../utils/errorHandler';
import { logger } from '../utils/logger';

export function useErrorMetrics() {
  useEffect(() => {
    return () => {
      const metrics = errorMetrics.getMetrics();
      logger.info('Error metrics on unmount', { metrics });
    };
  }, []);

  const trackError = useCallback((error: AppError) => {
    errorMetrics.trackError(error);
  }, []);

  const getMetrics = useCallback(() => {
    return errorMetrics.getMetrics();
  }, []);

  const resetMetrics = useCallback(() => {
    errorMetrics.reset();
  }, []);

  return {
    trackError,
    getMetrics,
    resetMetrics
  };
}