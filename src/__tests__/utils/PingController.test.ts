import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PingController as PingControllerClass } from '../../utils/PingController';
import type { PingResults, ProgressInfo } from '../../types';
import { PING_SERVICES } from '../../services/pingServices';

const ANSWER_DELAY = 200;
const PING_DELAY = 500;

const URL_A = 'https://example.com/a';
const URL_B = 'https://example.com/b';
const SERVICES = PING_SERVICES.map(s => s.name);

interface ServiceAnswer {
  service: string;
  success: boolean;
  message: string;
  error?: string;
}

interface MockAnswer {
  status: number;
  body: unknown;
}

interface FetchCall {
  url: string;
  startedAt: number;
  answeredAt: number | null;
  signal: AbortSignal;
}

type AnswerFor = (url: string, callNumber: number) => MockAnswer;

type RecordedEvent =
  | { type: 'progress'; info: ProgressInfo }
  | { type: 'results'; results: Record<string, Array<Record<string, unknown>>> };

function okAnswer(url: string, failing: string[] = []): MockAnswer {
  const results: ServiceAnswer[] = SERVICES.map(service =>
    failing.includes(service)
      ? { service, success: false, message: `${service} refused ${url}`, error: 'refused' }
      : { service, success: true, message: `${service} accepted ${url}` }
  );
  return { status: 200, body: { success: true, results, totalTime: ANSWER_DELAY, feedUrl: 'https://example.com/feed' } };
}

function serverError(): MockAnswer {
  return { status: 500, body: { error: 'Server exploded' } };
}

/**
 * Mocked fetch: answers after ANSWER_DELAY, rejects with AbortError when aborted.
 */
function installFetch(answerFor: AnswerFor): FetchCall[] {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn((_input: unknown, init: { body: string; signal: AbortSignal }) => {
    const url = (JSON.parse(init.body) as { urls: string[] }).urls[0];
    const call: FetchCall = { url, startedAt: Date.now(), answeredAt: null, signal: init.signal };
    calls.push(call);
    const answer = answerFor(url, calls.length);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        call.answeredAt = Date.now();
        resolve({
          ok: answer.status >= 200 && answer.status < 300,
          status: answer.status,
          json: async () => answer.body
        });
      }, ANSWER_DELAY);

      init.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

/**
 * Loads a fresh PingController (and a fresh, empty answer cache) for each test.
 */
async function createController(onEvent?: (event: RecordedEvent, controller: PingControllerClass) => void) {
  vi.resetModules();
  const { PingController } = await import('../../utils/PingController');
  const events: RecordedEvent[] = [];
  const errors: Error[] = [];

  const record = (event: RecordedEvent) => {
    events.push(event);
    onEvent?.(event, controller);
  };

  const controller: PingControllerClass = new PingController(
    (info: ProgressInfo) => record({ type: 'progress', info: { ...info } }),
    (results: PingResults) => record({ type: 'results', results: withoutTimestamps(results) }),
    (error: Error) => errors.push(error)
  );

  return { controller, events, errors };
}

/** Deep copy of the results at callback time, without the wall-clock timestamps. */
function withoutTimestamps(results: PingResults): Record<string, Array<Record<string, unknown>>> {
  const copy: Record<string, Array<Record<string, unknown>>> = {};
  for (const [url, list] of Object.entries(results)) {
    copy[url] = list.map(result => {
      const rest: Record<string, unknown> = JSON.parse(JSON.stringify(result));
      delete rest.timestamp;
      return rest;
    });
  }
  return copy;
}

function lastProgress(events: RecordedEvent[]): ProgressInfo {
  const progress = events.filter(e => e.type === 'progress');
  const last = progress[progress.length - 1];
  if (!last || last.type !== 'progress') {
    throw new Error('no progress event recorded');
  }
  return last.info;
}

/**
 * The sequence of callbacks the controller has always produced (v1.3.0),
 * written out independently of the implementation.
 */
function expectedSequence(urls: string[], failing: Record<string, string[]>): RecordedEvent[] {
  const events: RecordedEvent[] = [];
  const total = urls.length * SERVICES.length;
  const results: Record<string, Array<Record<string, unknown>>> = {};
  urls.forEach(url => {
    results[url] = SERVICES.map(() => ({ status: 'pending', url }));
  });
  const snapshot = () => JSON.parse(JSON.stringify(results)) as typeof results;

  let completed = 0;
  let successes = 0;
  let errors = 0;

  events.push({ type: 'results', results: snapshot() });
  events.push({
    type: 'progress',
    info: { total, completed, currentUrl: urls[0], currentService: SERVICES[0], errors, successes }
  });

  for (const url of urls) {
    SERVICES.forEach((service, index) => {
      events.push({
        type: 'progress',
        info: { total, completed, currentUrl: url, currentService: service, errors, successes }
      });

      if ((failing[url] || []).includes(service)) {
        errors++;
        results[url][index] = {
          status: 'error',
          url,
          message: `${service} refused ${url}`,
          error: { code: 'SERVICE_ERROR', details: 'refused', service, retryable: true }
        };
      } else {
        successes++;
        results[url][index] = { status: 'success', url, message: `${service} accepted ${url}` };
      }
      completed++;

      events.push({ type: 'results', results: snapshot() });
      events.push({
        type: 'progress',
        info: { total, completed, currentUrl: url, currentService: service, errors, successes }
      });
    });
  }

  return events;
}

describe('PingController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Use the real /api/ping code path (dev mode answers with random mocks)
    vi.stubEnv('DEV', false);
    for (const method of ['info', 'warn', 'error', 'debug', 'log'] as const) {
      vi.spyOn(console, method).mockImplementation(() => {});
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('one request per URL, and a 500 ms wait after every service except the last one of a URL', async () => {
    const calls = installFetch(url => okAnswer(url));
    const startedAt = Date.now();
    const resultTimes: number[] = [];
    const { controller, events, errors } = await createController(event => {
      if (event.type === 'results') {
        resultTimes.push(Date.now() - startedAt);
      }
    });

    const run = controller.start([URL_A, URL_B]);
    await vi.runAllTimersAsync();
    await run;

    // One /api/ping request per URL: services 2 and 3 use the answer already received
    expect(calls.map(c => c.url)).toEqual([URL_A, URL_B]);
    // The services are shown one by one: 500 ms after services 1 and 2, none after service 3
    expect(resultTimes).toEqual([
      0,
      ANSWER_DELAY,
      ANSWER_DELAY + PING_DELAY,
      ANSWER_DELAY + 2 * PING_DELAY,
      2 * ANSWER_DELAY + 2 * PING_DELAY,
      2 * ANSWER_DELAY + 3 * PING_DELAY,
      2 * ANSWER_DELAY + 4 * PING_DELAY
    ]);
    // The second URL is requested right after the last service of the first one
    expect(calls[1].startedAt - (calls[0].answeredAt as number)).toBe(2 * PING_DELAY);
    // The run ends with the last result: no wait after it
    expect(Date.now() - startedAt).toBe(2 * ANSWER_DELAY + 4 * PING_DELAY);
    expect(lastProgress(events)).toMatchObject({ total: 6, completed: 6, successes: 6, errors: 0 });
    expect(errors).toEqual([]);
  });

  test('after a failed call every service makes its own request, with the same 500 ms waits', async () => {
    const calls = installFetch(() => serverError());
    const { controller, events } = await createController();

    const startedAt = Date.now();
    const run = controller.start([URL_A, URL_B]);
    await vi.runAllTimersAsync();
    await run;

    // Nothing is kept after a failed call: every service makes its own request
    expect(calls.map(c => c.url)).toEqual([URL_A, URL_A, URL_A, URL_B, URL_B, URL_B]);
    // 6 answers + a wait after services 1 and 2 of each URL
    expect(Date.now() - startedAt).toBe(6 * ANSWER_DELAY + 4 * PING_DELAY);
    const gaps = calls.slice(1).map((call, i) => call.startedAt - (calls[i].answeredAt as number));
    expect(gaps).toEqual([PING_DELAY, PING_DELAY, 0, PING_DELAY, PING_DELAY]);
    expect(lastProgress(events)).toMatchObject({ total: 6, completed: 6, successes: 0, errors: 6 });
  });

  test('a failed call followed by a good one: 2 requests and both 500 ms waits', async () => {
    // First call fails, the second one succeeds
    const calls = installFetch((url, callNumber) => (callNumber === 1 ? serverError() : okAnswer(url)));
    const { controller, events } = await createController();

    const startedAt = Date.now();
    const run = controller.start([URL_A]);
    await vi.runAllTimersAsync();
    await run;

    expect(calls).toHaveLength(2);
    expect(calls[1].startedAt - (calls[0].answeredAt as number)).toBe(PING_DELAY);
    // Service 3 uses the second answer, after its own 500 ms wait
    expect(Date.now() - startedAt).toBe(2 * ANSWER_DELAY + 2 * PING_DELAY);
    expect(lastProgress(events)).toMatchObject({ total: 3, completed: 3, successes: 2, errors: 1 });
  });

  test('pause between URLs holds the run until resume', async () => {
    const calls = installFetch(url => okAnswer(url));
    const { controller, events } = await createController((event, ctrl) => {
      // Pause as soon as the first URL is complete
      if (event.type === 'progress' && event.info.completed === 3 && event.info.currentUrl === URL_A) {
        ctrl.pause();
      }
    });

    const run = controller.start([URL_A, URL_B]);
    await vi.runAllTimersAsync();
    await vi.advanceTimersByTimeAsync(10000);

    expect(calls.map(c => c.url)).toEqual([URL_A]);
    expect(lastProgress(events)).toMatchObject({ completed: 3, currentUrl: URL_A });

    controller.resume();
    await vi.runAllTimersAsync();
    await run;

    expect(calls.map(c => c.url)).toEqual([URL_A, URL_B]);
    expect(lastProgress(events)).toMatchObject({ total: 6, completed: 6, successes: 6, errors: 0 });
  });

  test('stop aborts the call in flight', async () => {
    const calls = installFetch(url => okAnswer(url));
    const { controller, events } = await createController();

    const run = controller.start([URL_A, URL_B]);
    await vi.advanceTimersByTimeAsync(ANSWER_DELAY / 2);
    expect(calls).toHaveLength(1);
    expect(calls[0].signal.aborted).toBe(false);

    const stopped = controller.stop();
    await vi.runAllTimersAsync();
    await stopped;
    await run;

    expect(calls).toHaveLength(1);
    expect(calls[0].signal.aborted).toBe(true);
    expect(calls[0].answeredAt).toBeNull();
    // No result is reported for the aborted call and nothing else starts
    expect(lastProgress(events)).toMatchObject({ total: 6, completed: 0, successes: 0, errors: 0 });
    expect(events.filter(e => e.type === 'results')).toHaveLength(1);
  });

  test('onResults/onProgress values follow the v1.3.0 sequence', async () => {
    const failing: Record<string, string[]> = { [URL_B]: ['Twingly'] };
    installFetch(url => okAnswer(url, failing[url] || []));
    const { controller, events } = await createController();

    const run = controller.start([URL_A, URL_B]);
    await vi.runAllTimersAsync();
    await run;

    expect(events).toEqual(expectedSequence([URL_A, URL_B], failing));
  });
});
