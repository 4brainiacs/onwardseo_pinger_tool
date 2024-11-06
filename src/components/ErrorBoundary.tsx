import React, { Component, ErrorInfo } from 'react';
import { logger } from '../utils/logger';
import { AppError, ErrorSeverity, handleError } from '../utils/errorHandler';
import { FallbackError } from './FallbackError';

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError?: () => void }>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    error: null,
    errorInfo: null
  };

  private retryCount: number = 0;
  private readonly maxRetries: number = 3;

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const appError = error instanceof AppError ? error : handleError(error);
    
    logger.error('React error boundary caught error', {
      componentStack: errorInfo.componentStack,
      severity: appError instanceof AppError ? appError.severity : ErrorSeverity.HIGH,
      retryCount: this.retryCount,
      error: {
        name: appError.name,
        message: appError.message,
        code: appError instanceof AppError ? appError.code : 'UNKNOWN_ERROR',
        stack: appError.stack
      }
    });

    this.setState({ error: appError, errorInfo });
    this.props.onError?.(appError, errorInfo);
  }

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({ error: null, errorInfo: null });
    } else {
      logger.warn('Maximum retry attempts reached', {
        retryCount: this.retryCount,
        maxRetries: this.maxRetries
      });
      window.location.reload();
    }
  };

  public render() {
    const { error } = this.state;
    const { fallback: ErrorFallback = FallbackError } = this.props;

    if (error) {
      return <ErrorFallback error={error} resetError={this.handleRetry} />;
    }

    return this.props.children;
  }
}