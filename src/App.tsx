import React, { useState, useRef, useCallback } from 'react';
import { Globe } from 'lucide-react';
import { URLInput } from './components/URLInput';
import { CategoryFilter } from './components/CategoryFilter';
import { ProgressBar } from './components/ProgressBar';
import { ResultsDisplay } from './components/ResultsDisplay';
import { PingControls } from './components/PingControls';
import { PingController } from './utils/PingController';
import { ErrorContainer } from './components/ErrorContainer';
import { useErrorContext } from './context';
import { useAsyncOperation } from './hooks/useAsyncOperation';
import { AppError } from './utils/errorHandler';
import { logger } from './utils/logger';
import { triggerHeightRecalc } from './utils/iframeHeight';
import { PING_SERVICES } from './services/pingServices';
import type { PingResults, ProgressInfo } from './types';

// Initialize with all services selected by default
const ALL_SERVICE_NAMES = PING_SERVICES.map(s => s.name);

function App() {
  const [selectedServices, setSelectedServices] = useState<Set<string>>(
    new Set(ALL_SERVICE_NAMES)
  );
  const [results, setResults] = useState<PingResults>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState<ProgressInfo>({
    total: 0,
    completed: 0,
    currentUrl: '',
    currentService: '',
    errors: 0,
    successes: 0
  });
  const [activeUrls, setActiveUrls] = useState<string[]>([]);
  const pingControllerRef = useRef<PingController | null>(null);

  // Use shared error context for consistent error state across components
  const { error, setError, clearError } = useErrorContext();

  // Local retry state management
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  // Computed retry eligibility
  const canRetry = retryCount < MAX_RETRIES && error?.retryable !== false;

  // Handle max retries reached
  const handleMaxRetriesReached = useCallback(() => {
    logger.error('Maximum retries reached', {
      component: 'App',
      activeUrls,
      retryCount
    });
    handleStop();
  }, [activeUrls, retryCount]);

  const { execute } = useAsyncOperation({
    onError: (error) => {
      logger.error('Operation failed', {
        component: 'App',
        error: error instanceof AppError ? error.toJSON() : error
      });
      setError(error);
    }
  });

  const handleSubmit = async (urls: string[]) => {
    try {
      clearError();
      setIsLoading(true);
      setIsCompleted(false);
      setIsPaused(false);
      setResults({});
      setActiveUrls(urls);

      const controller = new PingController(
        (info) => setProgress(info),
        (results) => setResults(results),
        (error) => setError(error)
      );
      pingControllerRef.current = controller;

      await execute(async () => {
        // Use the local controller variable to avoid non-null assertion
        // This is guaranteed to be defined since we just created it above
        // Pass selectedServices to only ping the services user has selected
        await controller.start(urls, selectedServices);
        setIsCompleted(true);
      });
    } finally {
      setIsLoading(false);

      // Trigger iframe height recalculation after completion
      // (ProgressBar disappears, so height should shrink)
      triggerHeightRecalc();
    }
  };

  const handlePause = () => {
    if (pingControllerRef.current) {
      pingControllerRef.current.pause();
      setIsPaused(true);
    }
  };

  const handleResume = () => {
    if (pingControllerRef.current) {
      pingControllerRef.current.resume();
      setIsPaused(false);
    }
  };

  const handleStop = () => {
    if (pingControllerRef.current) {
      pingControllerRef.current.stop();
      setIsLoading(false);
      setIsPaused(false);
    }
  };

  const handleReset = () => {
    setResults({});
    setIsLoading(false);
    setIsCompleted(false);
    setIsPaused(false);
    clearError();
    setRetryCount(0); // Reset retry count when resetting the form
    setProgress({
      total: 0,
      completed: 0,
      currentUrl: '',
      currentService: '',
      errors: 0,
      successes: 0
    });
    setActiveUrls([]);
    if (pingControllerRef.current) {
      pingControllerRef.current.reset();
    }
    pingControllerRef.current = null;

    // Trigger iframe height recalculation after DOM updates
    triggerHeightRecalc();
  };

  const handleRetry = async () => {
    if (!canRetry || activeUrls.length === 0) {
      return;
    }

    // Increment retry count
    const newRetryCount = retryCount + 1;
    setRetryCount(newRetryCount);

    // Check if we've hit max retries
    if (newRetryCount >= MAX_RETRIES) {
      handleMaxRetriesReached();
      return;
    }

    // Clear error and retry the operation
    clearError();
    try {
      await handleSubmit(activeUrls);
    } catch (err) {
      // Error will be handled by handleSubmit's error handling
      setError(err);
    }
  };

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center space-y-6">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-blue-100 p-3">
                <Globe className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-4">
              Ping Website URLs & Backlinks
            </h1>
            <div className="max-w-3xl mx-auto">
              <p className="text-lg leading-7 text-gray-600">
                Boost your website's visibility and get your pages indexed faster by search engines with{' '}
                <a href="https://onwardseo.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 font-semibold">
                  <strong>onwardSEO - SEO Agency</strong>
                </a>
                ! Use our easy and efficient <strong>Bulk URL Pinger tool</strong> to enhance your online presence. Simply paste up to 5 URLs in the input box below and click the "Start Pinging" button. This will notify multiple search engines and web services about your URLs, helping to improve your site's SEO performance. <strong>It's quick, simple, and free—try it now with onwardSEO and take your website to the next level!</strong>
              </p>
            </div>
          </div>

          {error && (
            <ErrorContainer
              error={error}
              onRetry={handleRetry}
              onDismiss={clearError}
              className="w-full max-w-4xl"
            />
          )}

          <CategoryFilter
            selectedServices={selectedServices}
            onServiceChange={setSelectedServices}
          />

          <URLInput
            onSubmit={handleSubmit}
            onReset={handleReset}
            isLoading={isLoading}
            isCompleted={isCompleted}
          />

          {isLoading && (
            <div className="w-full max-w-4xl space-y-6">
              <div className="flex items-center justify-between">
                <PingControls
                  isPaused={isPaused}
                  onPause={handlePause}
                  onResume={handleResume}
                  onStop={handleStop}
                  disabled={!isLoading || isCompleted}
                />
              </div>
              <ProgressBar progress={progress} urls={activeUrls} />
            </div>
          )}

          <ResultsDisplay results={results} selectedServices={selectedServices} />
        </div>
      </div>
    </div>
  );
}

export default App;