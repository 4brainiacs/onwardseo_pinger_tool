import React from 'react';
import { RotateCcw, Home } from 'lucide-react';

interface FallbackErrorProps {
  error: Error;
  resetError?: () => void;
}

export function FallbackError({ error, resetError }: FallbackErrorProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-6">
        <div className="flex flex-col items-center text-center">
          <div className="rounded-full bg-red-100 p-3 mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Operation Failed</h2>
          <p className="text-gray-600 mb-6">
            {error.message || 'An unexpected error occurred. Please try again.'}
          </p>
          <div className="space-y-3 w-full">
            {resetError && (
              <button
                onClick={resetError}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Try Again
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Home className="w-5 h-5 mr-2" />
              Reload Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}