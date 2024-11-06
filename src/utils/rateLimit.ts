import { logger } from './logger';

interface RateLimitConfig {
  maxRequests: number;
  timeWindow: number; // in milliseconds
}

interface RateLimitState {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private limits: Map<string, RateLimitState> = new Map();
  private readonly config: RateLimitConfig;

  constructor(config: RateLimitConfig = { maxRequests: 10, timeWindow: 60000 }) {
    this.config = config;
  }

  canMakeRequest(key: string): boolean {
    const now = Date.now();
    const state = this.limits.get(key);

    if (!state) {
      this.limits.set(key, { count: 1, resetTime: now + this.config.timeWindow });
      return true;
    }

    if (now >= state.resetTime) {
      this.limits.set(key, { count: 1, resetTime: now + this.config.timeWindow });
      return true;
    }

    if (state.count >= this.config.maxRequests) {
      logger.warn('Rate limit exceeded', {
        key,
        remainingTime: state.resetTime - now
      });
      return false;
    }

    state.count++;
    return true;
  }

  getRemainingRequests(key: string): number {
    const now = Date.now();
    const state = this.limits.get(key);

    if (!state || now >= state.resetTime) {
      return this.config.maxRequests;
    }

    return Math.max(0, this.config.maxRequests - state.count);
  }

  getResetTime(key: string): number | null {
    const state = this.limits.get(key);
    return state ? state.resetTime : null;
  }

  reset(key: string): void {
    this.limits.delete(key);
  }

  resetAll(): void {
    this.limits.clear();
  }
}