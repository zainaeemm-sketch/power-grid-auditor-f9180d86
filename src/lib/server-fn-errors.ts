/**
 * Shared error normalization for `createServerFn` callers.
 *
 * Server-function middleware (e.g. `requireSupabaseAuth`) throws raw `Response`
 * objects on auth failure. Those are NOT `Error` instances, so the usual
 * `e instanceof Error ? e.message : fallback` pattern stringifies them as
 * `"[object Response]"` and surfaces as a blank-screen runtime error.
 *
 * `normalizeServerFnError` turns any thrown value into a friendly
 * `{ silent, status, message }` triple:
 *
 *   - `silent: true` for expected auth-required failures (401/403) on public
 *     pages — callers should skip showing a toast in that case.
 *   - `message` is the response body text when available, otherwise a generic
 *     "HTTP <status>" string, otherwise `error.message`, otherwise `fallback`.
 *
 * Always `await` the result — reading the Response body is async.
 */
export type NormalizedServerFnError = {
  /** True for 401/403 — auth is required and the visitor isn't signed in. */
  silent: boolean;
  /** HTTP status if the thrown value was a `Response`, else `undefined`. */
  status?: number;
  /** User-facing message. Never the literal "[object Response]". */
  message: string;
};

export async function normalizeServerFnError(
  e: unknown,
  fallback: string,
): Promise<NormalizedServerFnError> {
  if (e instanceof Response) {
    const status = e.status;
    // 401 = no/invalid session, 403 = signed in but forbidden. On public docs
    // pages neither is actionable for the visitor, so callers can stay silent.
    const silent = status === 401 || status === 403;
    let message = `${fallback} (HTTP ${status})`;
    try {
      const text = await e.text();
      if (text) message = text;
    } catch {
      /* ignore — keep the HTTP-status fallback */
    }
    return { silent, status, message };
  }
  if (e instanceof Error) {
    return { silent: false, message: e.message || fallback };
  }
  return { silent: false, message: fallback };
}
