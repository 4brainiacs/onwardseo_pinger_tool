import React, { useState } from 'react';
import { Send, AlertCircle, RotateCcw } from 'lucide-react';
import { validateUrl } from '../utils/urlUtils';

interface URLInputProps {
  onSubmit: (urls: string[]) => void;
  onReset: () => void;
  isLoading: boolean;
  isCompleted: boolean;
}

export function URLInput({ onSubmit, onReset, isLoading, isCompleted }: URLInputProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const validateUrls = (text: string) => {
    const urls = text
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    if (urls.length > 5) {
      setError('Maximum 5 URLs allowed');
      return null;
    }

    const invalidUrls = urls.filter(url => !validateUrl(url));
    
    if (invalidUrls.length > 0) {
      setError(`Invalid URL${invalidUrls.length > 1 ? 's' : ''}: ${invalidUrls.join(', ')}`);
      return null;
    }

    setError('');
    return urls;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validatedUrls = validateUrls(input);
    
    if (validatedUrls) {
      onSubmit(validatedUrls);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (error) {
      validateUrls(e.target.value);
    }
  };

  const handleReset = () => {
    setInput('');
    setError('');
    onReset();
  };

  const buttonClasses = "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 min-h-[36px] transition-colors";

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-4xl">
      <div className="space-y-3">
        <div className="relative">
          <textarea
            value={input}
            onChange={handleInput}
            placeholder="Enter up to 5 URLs (one per line)"
            className={`w-full min-h-[180px] rounded-lg border ${
              error ? 'border-red-300' : 'border-gray-300'
            } p-3 text-sm focus:border-blue-500 focus:ring-blue-500`}
            disabled={isLoading}
            style={{ fontSize: '14px' }}
          />
        </div>
        <div className="flex items-start gap-2">
          {isCompleted ? (
            <button
              type="button"
              onClick={handleReset}
              className={`${buttonClasses} bg-gray-600 hover:bg-gray-700 focus:ring-gray-500`}
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={isLoading || !input.trim() || !!error}
              className={`${buttonClasses} bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Start Pinging</span>
                </>
              )}
            </button>
          )}
          {error && (
            <div className="flex items-center gap-1 text-sm text-red-500">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}