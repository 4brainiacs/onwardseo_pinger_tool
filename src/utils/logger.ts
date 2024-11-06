import { APP_VERSION } from '../constants';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';
type LogContext = Record<string, unknown>;

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  version: string;
  context?: LogContext;
  error?: Error;
}

class Logger {
  private static instance: Logger;
  private readonly isProduction: boolean;
  private readonly maxLogSize = 100;
  private logQueue: LogEntry[] = [];

  private constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatError(error: Error): Record<string, unknown> {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause
    };
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      version: APP_VERSION,
      context
    };

    if (error) {
      entry.error = error;
    }

    return entry;
  }

  private processLogEntry(entry: LogEntry): void {
    if (this.isProduction) {
      this.logQueue.push(entry);
      if (this.logQueue.length >= this.maxLogSize) {
        this.flushLogs();
      }
    } else {
      const { level, message, context, error } = entry;
      const logFn = console[level] || console.log;
      logFn(
        `[${entry.timestamp}] ${level.toUpperCase()}: ${message}`,
        context || '',
        error ? this.formatError(error) : ''
      );
    }
  }

  private async flushLogs(): Promise<void> {
    if (this.logQueue.length === 0) return;

    try {
      // In production, you would send logs to your logging service
      // For now, we'll just console.log them
      console.log('Flushing logs:', this.logQueue);
      this.logQueue = [];
    } catch (error) {
      console.error('Failed to flush logs:', error);
    }
  }

  info(message: string, context?: LogContext): void {
    this.processLogEntry(this.createLogEntry('info', message, context));
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    this.processLogEntry(this.createLogEntry('warn', message, context, error));
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.processLogEntry(this.createLogEntry('error', message, context, error));
  }

  debug(message: string, context?: LogContext): void {
    if (!this.isProduction) {
      this.processLogEntry(this.createLogEntry('debug', message, context));
    }
  }

  async dispose(): Promise<void> {
    await this.flushLogs();
  }
}

export const logger = Logger.getInstance();