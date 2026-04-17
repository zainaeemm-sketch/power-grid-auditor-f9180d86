/**
 * Shared server-side utilities for retry, timeout, and concurrency control.
 * Safe to import from any `*.functions.ts` server file.
 */

export interface RetryOptions {
  /** Maximum number of attempts (including the first try). Default: 2 */
  maxAttempts?: number;
  /** Delay between attempts in ms. Default: 800 */
  delayMs?: number;
  /** Predicate deciding if an error should trigger a retry. Default: any thrown error retries. */
  shouldRetry?: (err: unknown) => boolean;
}

/**
 * Run an async function with bounded retries.
 * Only retries on transient failures (controlled by `shouldRetry`).
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 2, delayMs = 800, shouldRetry = () => true } = opts;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= maxAttempts || !shouldRetry(err)) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

/**
 * Run an array of async tasks with bounded concurrency.
 * Returns Promise.allSettled-style results so that one failure does not abort the batch.
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency = 3,
): Promise<Array<PromiseSettledResult<R>>> {
  const results: Array<PromiseSettledResult<R>> = new Array(items.length);
  let cursor = 0;

  async function next(): Promise<void> {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      try {
        const value = await worker(items[idx], idx);
        results[idx] = { status: "fulfilled", value };
      } catch (reason) {
        results[idx] = { status: "rejected", reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => next());
  await Promise.all(workers);
  return results;
}

/** True when the response status code is a transient (5xx) server error. */
export function isTransientHttpStatus(status: number): boolean {
  return status >= 500 && status < 600;
}
