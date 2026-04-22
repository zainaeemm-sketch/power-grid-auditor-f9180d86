import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Global guard that swallows unhandled 401 Response rejections from
 * TanStack server-fn calls and silently refreshes the Supabase session.
 *
 * Without this, an expired access token causes any background poller
 * (health badge, job drain, admin notifier) to throw a raw Response,
 * which the runtime surfaces as `Error: [object Response]` and a
 * blank screen.
 */
export function AuthErrorGuard() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let refreshing = false;
    let lastRefreshAt = 0;

    const tryRefresh = async () => {
      const now = Date.now();
      // Throttle to one refresh attempt per 10s to avoid loops.
      if (refreshing || now - lastRefreshAt < 10_000) return;
      refreshing = true;
      lastRefreshAt = now;
      try {
        await supabase.auth.refreshSession();
      } catch {
        // ignore — user may simply be signed out
      } finally {
        refreshing = false;
      }
    };

    const isUnauthorizedResponse = (reason: unknown): boolean => {
      if (reason instanceof Response) {
        return reason.status === 401 || reason.status === 403;
      }
      // server-fn sometimes wraps the Response on an Error
      if (reason && typeof reason === "object") {
        const r = reason as { status?: number; response?: { status?: number }; message?: string };
        if (r.status === 401 || r.status === 403) return true;
        if (r.response?.status === 401 || r.response?.status === 403) return true;
        if (typeof r.message === "string" && /\b401\b|Unauthorized: No authorization header/i.test(r.message)) {
          return true;
        }
      }
      return false;
    };

    const onUnhandled = (ev: PromiseRejectionEvent) => {
      if (isUnauthorizedResponse(ev.reason)) {
        ev.preventDefault();
        void tryRefresh();
        return;
      }
      const msg =
        ev.reason && typeof (ev.reason as { message?: unknown }).message === "string"
          ? ((ev.reason as { message: string }).message)
          : "";
      if (msg.includes("reading 'method'") || msg.includes('reading "method"')) {
        ev.preventDefault();
      }
    };

    const onError = (ev: ErrorEvent) => {
      const msg = typeof ev.message === "string" ? ev.message : "";
      // Auth Response surfaced as plain error — check both the underlying
      // error object and the stringified message.
      if (isUnauthorizedResponse(ev.error) || msg.includes("[object Response]")) {
        ev.preventDefault();
        void tryRefresh();
        return;
      }
      // Any Response thrown (non-2xx) — swallow to avoid blank screen;
      // the failing call will retry on next poll/navigation.
      if (ev.error instanceof Response) {
        ev.preventDefault();
        return;
      }
      // Known TanStack server-fn handler crash when request context is
      // missing (Cannot read properties of undefined (reading 'method')).
      // Swallow so the UI doesn't go blank — the failed request will be
      // retried by the next poll/navigation.
      if (msg.includes("reading 'method'") || msg.includes('reading "method"')) {
        ev.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", onUnhandled);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onUnhandled);
      window.removeEventListener("error", onError);
    };
  }, []);

  return null;
}
