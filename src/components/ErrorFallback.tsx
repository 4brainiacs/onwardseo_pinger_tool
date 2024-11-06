import React from 'react';
import { XCircle } from 'lucide-react';
import { ErrorRetryButton } from './ErrorRetryButton';
import { AppError, ErrorSeverity } from '../utils/errorHandler';

interface ErrorFallbackProps {
  error: Error;
  resetError?: () => void;
}

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const isAppError = error instanceof AppError;
  const severity = isAppError ? error.severity : ErrorSeverity.HIGH;
  const isRetryable = isAppError ? error.retryable : true;

  const getMessage = () => {
    if (isAppError) {
      switch (error.code) {
        case 'NETWORK_ERROR':
          return 'Unable to connect to the server. Please check your internet connection.';
        case 'TIMEOUT_ERROR':
          return 'The request took too long to complete. Please try again.';
        case 'VALIDATION_ERROR':
          return 'Invalid input provided. Please check your data and try again.';
        default:
          return error.message;
      }
    }
    return error.message || 'An unexpected error occurred.';
  };

  const getTitle = () => {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'Minor Issue';
      case ErrorSeverity.MEDIUM:
        return 'Warning';
      case ErrorSeverity.HIGH:
        return 'Error';
      case ErrorSeverity.CRITICAL:
        return 'Critical Error';
      default:
        return 'Error';
    }
  };

  return (
    <div className="min-h-[200px] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
        <div className="flex flex-col items-center text-center">
          <div className="rounded-full bg-red-100 p-3 mb-4">
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
          
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {getTitle()}
          </h2>
          
          <p className="text-gray-600 mb-6">
            {getMessage()}
          </p>

          <div className="space-y-3 w-full">
            {isRetryable && resetError && (
              <ErrorRetryButton onClick={resetError} />
            )}
            
            <button
              onClick={() => window.location.reload()}
              className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}