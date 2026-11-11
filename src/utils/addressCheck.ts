/**
 * Address check before pinging
 *
 * Asks /api/check where each address really lives (redirects, canonical) and
 * whether it can be pinged at all. Runs once per submit, before any ping.
 */

import type { ApiUrlCheck } from '../types/ping';
import { logger } from './logger';

const CHECK_TIMEOUT_MS = 15000;

/**
 * Checks the addresses, in the order given.
 *
 * Returns null when the check could not be done (dev mode, where the backend
 * is not available; a network error; any answer other than 200). The caller
 * then pings the addresses as typed.
 */
export async function checkAddresses(urls: string[]): Promise<ApiUrlCheck[] | null> {
  if (import.meta.env.DEV) {
    return null;
  }

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), CHECK_TIMEOUT_MS);

  try {
    const response = await fetch('/api/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ urls }),
      signal: timeoutController.signal
    });

    if (response.status !== 200) {
      logger.warn('Address check failed', { component: 'addressCheck', status: response.status });
      return null;
    }

    const data: { checks?: ApiUrlCheck[] } = await response.json();
    if (!Array.isArray(data.checks) || data.checks.length !== urls.length) {
      logger.warn('Address check answered without one check per address', { component: 'addressCheck' });
      return null;
    }

    return data.checks;
  } catch (error) {
    logger.warn('Address check failed', {
      component: 'addressCheck',
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
