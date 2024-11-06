import { MAX_RETRIES, RETRY_DELAY } from '../constants';
import { AppError, ErrorSeverity } from '../types/errors';
import { isRetryableError } from './errorHandler';
import { logger } from './logger';

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number) => void;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = MAX_RETRIES,
    baseDelay = RETRY_DELAY,
    maxDelay = RETRY_DELAY * 4,
    shouldRetry = isRetryableError,
    onRetry
  } = options;

  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 100,
        maxDelay
      );

      logger.warn(
        `Operation failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
        {
          attempt,
          delay,
          error: error instanceof Error ? error.message : String(error)
        }
      );

      onRetry?.(error, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export class RetryableOperation<T> {
  private attempts: number = 0;
  private isRunning: boolean = false;
  private abortController: AbortController | null = null;

  constructor(
    private operation: () => Promise<T>,
    private options: RetryOptions = {}
  ) {}

  async execute(): Promise<T> {
    if (this.isRunning) {
      throw new AppError(
        'Operation already in progress',
        'OPERATION_IN_PROGRESS',
        { severity: ErrorSeverity.LOW, retryable: false }
      );
    }

    this.isRunning = true;
    this.abortController = new AbortController();

    try {
      return await withRetry(
        () => {
          if (this.abortController?.signal.aborted) {
            throw new AppError(
              'Operation aborted',
              'OPERATION_ABORTED',
              { severity: ErrorSeverity.LOW, retryable: false }
            );
          }
          return this.operation();
        },
        {
          ...this.options,
          onRetry: (error, attempt) => {
            this.attempts = attempt + 1;
            this.options.onRetry?.(error, attempt);
          }
        }
      );
    } finally {
      this.isRunning = false;
      this.abortController = null;
    }
  }

  abort(): void {
    if (this.isRunning && this.abortController) {
      this.abortController.abort();
    }
  }

  get currentAttempts(): number {
    return this.attempts;
  }

  get running(): boolean {
    return this.isRunning;
  }
}

export function createRetryableOperation<T>(
  operation: () => Promise<T>,
  options?: RetryOptions
): RetryableOperation<T> {
  return new RetryableOperation(operation, options);
}