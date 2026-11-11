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
import { checkAddresses } from './utils/addressCheck';
import type { ApiUrlCheck, PingResults, ProgressInfo } from './types';

// Initialize with all services selected by default
const ALL_SERVICE_NAMES = PING_SERVICES.map(s => s.name);

const COULD_NOT_CHECK_NOTICE = 'Could not check the addresses — pinged as typed';

/**
 * The message for addresses that must not be pinged, for example
 * "Fix before pinging: https://example.com/x — page not found (HTTP 404)".
 */
function fixBeforePinging(notPingable: ApiUrlCheck[]): string {
  const reasons = notPingable.map(check => `${check.input} — ${check.note.replace(/^Not pinged: /, '')}`);
  return `Fix before pinging: ${reasons.join('; ')}`;
}

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
  // The address check that runs before pinging
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState('');
  const [checkNotice, setCheckNotice] = useState('');
  const [checks, setChecks] = useState<Record<string, ApiUrlCheck>>({});
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

  /**
   * Checks the addresses before anything is pinged.
   * Returns the addresses to ping, or null when one of them must be fixed first.
   */
  const checkBeforePinging = async (typedUrls: string[]): Promise<string[] | null> => {
    setCheckError('');
    setCheckNotice('');
    setChecks({});

    setIsChecking(true);
    let found: ApiUrlCheck[] | null;
    try {
      found = await checkAddresses(typedUrls);
    } finally {
      setIsChecking(false);
    }

    // The check itself could not be done: ping as typed, and say so
    if (found === null) {
      setCheckNotice(COULD_NOT_CHECK_NOTICE);
      return typedUrls;
    }

    // An address that does not exist or must not be pinged: nothing is pinged
    const notPingable = found.filter(check => check.pingUrl === null);
    if (notPingable.length > 0) {
      setCheckError(fixBeforePinging(notPingable));
      return null;
    }

    // Ping the address each check ended with, each one once
    const byPingUrl: Record<string, ApiUrlCheck> = {};
    for (const check of found) {
      if (check.pingUrl !== null && !(check.pingUrl in byPingUrl)) {
        byPingUrl[check.pingUrl] = check;
      }
    }
    setChecks(byPingUrl);
    return Object.keys(byPingUrl);
  };

  const handleSubmit = async (typedUrls: string[]) => {
    clearError();
    setResults({});

    const urls = await checkBeforePinging(typedUrls);
    if (urls === null) {
      // Nothing started; the message under the box may change the page height
      triggerHeightRecalc();
      return;
    }

    try {
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
    setCheckError('');
    setCheckNotice('');
    setChecks({});
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
    <main className="bg-white">
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
            checkError={checkError}
            isChecking={isChecking}
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

          {checkNotice && <p className="text-xs text-gray-600">{checkNotice}</p>}

          <ResultsDisplay results={results} selectedServices={selectedServices} checks={checks} />
        </div>
      </div>
    </main>
  );
}

export default App;