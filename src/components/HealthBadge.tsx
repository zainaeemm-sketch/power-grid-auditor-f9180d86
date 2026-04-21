import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getHealthStatus } from "@/server/health.functions";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Small status dot in the header. Polls health every 60s when authenticated.
 * Green = all OK, amber = LLM not fully configured, red = database error.
 */
export function HealthBadge() {
  const { user } = useAuth();
  const [state, setState] = useState<"ok" | "warn" | "error" | "unknown">("unknown");

  useEffect(() => {
    if (!user) {
      setState("unknown");
      return;
    }
    let cancelled = false;
    let inFlight = false;
    const check = async () => {
      if (inFlight) return; // dedupe — avoid concurrent server-fn calls that
                            // can trigger TanStack Start dev-server races.
      inFlight = true;
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session?.access_token) {
          if (!cancelled) setState("unknown");
          return;
        }
        const status = await getHealthStatus();
        if (cancelled) return;
        if (status.database === "error") setState("error");
        else if (!status.llmConfigured || status.simulator.state !== "active") setState("warn");
        else setState("ok");
      } catch {
        // Swallow — keep last known state, never blank the screen.
        if (!cancelled && state === "unknown") setState("unknown");
      } finally {
        inFlight = false;
      }
    };
    // Delay first check so it doesn't race with route loaders on initial mount.
    const initial = setTimeout(check, 1500);
    const id = setInterval(check, 120_000); // 2 min instead of 60s
    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(id);
    };
  }, [user]);

  const color =
    state === "ok"
      ? "bg-emerald-500"
      : state === "warn"
        ? "bg-amber-500"
        : state === "error"
          ? "bg-red-500"
          : "bg-muted-foreground/40";

  const label =
    state === "ok"
      ? "All systems operational (LLM + simulator)"
      : state === "warn"
        ? "Degraded — LLM or simulator using fallback"
        : state === "error"
          ? "Backend error — click to inspect"
          : "Checking…";

  return (
    <Link
      to="/health"
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-accent"
      aria-label={label}
    >
      <span className={`h-2 w-2 rounded-full ${color} ${state === "ok" ? "" : "animate-pulse"}`} />
    </Link>
  );
}
