import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getHealthStatus } from "@/server/health.functions";

/**
 * Small status dot in the header. Polls health every 60s when authenticated.
 * Green = all OK, amber = LLM not fully configured, red = database error.
 */
export function HealthBadge() {
  const [state, setState] = useState<"ok" | "warn" | "error" | "unknown">("unknown");

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const status = await getHealthStatus();
        if (cancelled) return;
        if (status.database === "error") setState("error");
        else if (!status.llmConfigured) setState("warn");
        else setState("ok");
      } catch {
        if (!cancelled) setState("error");
      }
    };
    check();
    const id = setInterval(check, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

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
      ? "All systems operational"
      : state === "warn"
        ? "LLM not fully configured"
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
