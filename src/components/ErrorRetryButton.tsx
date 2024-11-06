import React from 'react';
import { RotateCcw } from 'lucide-react';

interface ErrorRetryButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  text?: string;
  className?: string;
}

export function ErrorRetryButton({
  onClick,
  isLoading = false,
  text = 'Try Again',
  className = ''
}: ErrorRetryButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {isLoading ? (
        <>
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          <span>Retrying...</span>
        </>
      ) : (
        <>
          <RotateCcw className="h-4 w-4" />
          <span>{text}</span>
        </>
      )}
    </button>
  );
}