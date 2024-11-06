export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  severity?: ErrorSeverity;
  retryable?: boolean;
  context?: Record<string, unknown>;
  originalError?: unknown;
}

export class AppError extends Error {
  public readonly severity: ErrorSeverity;
  public readonly timestamp: number;
  public readonly retryable: boolean;
  public readonly metadata: Record<string, unknown>;
  public readonly code: string;

  constructor(
    message: string,
    code: string,
    options: {
      severity?: ErrorSeverity;
      retryable?: boolean;
      context?: Record<string, unknown>;
      originalError?: unknown;
    } = {}
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.severity = options.severity || ErrorSeverity.MEDIUM;
    this.timestamp = Date.now();
    this.retryable = options.retryable ?? true;
    this.metadata = {
      ...options.context,
      originalError: options.originalError
    };
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      timestamp: this.timestamp,
      retryable: this.retryable,
      metadata: this.metadata,
      stack: this.stack
    };
  }
}