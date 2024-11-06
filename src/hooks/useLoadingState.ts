import { useState, useCallback } from 'react';
import { logger } from '../utils/logger';

interface LoadingState {
  isLoading: boolean;
  error: Error | null;
}

export function useLoadingState(initialState: boolean = false) {
  const [state, setState] = useState<LoadingState>({
    isLoading: initialState,
    error: null
  });

  const startLoading = useCallback(() => {
    setState({ isLoading: true, error: null });
  }, []);

  const stopLoading = useCallback((error?: Error) => {
    setState({ isLoading: false, error: error || null });
    if (error) {
      logger.error('Loading operation failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }, []);

  const resetState = useCallback(() => {
    setState({ isLoading: false, error: null });
  }, []);

  return {
    ...state,
    startLoading,
    stopLoading,
    resetState
  };
}