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
      }
    };

    const onError = (ev: ErrorEvent) => {
      // Fallback: some runtimes surface the rejection as a plain Error
      // with message "[object Response]" (which is what Lovable's
      // runtime reporter shows). Suppress to avoid blank screen.
      if (typeof ev.message === "string" && ev.message.includes("[object Response]")) {
        ev.preventDefault();
        void tryRefresh();
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
