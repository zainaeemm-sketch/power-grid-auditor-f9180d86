import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Activity } from "lucide-react";
import { useEffect, useState } from "react";
import { getHealthStatus, type HealthStatus } from "@/server/health.functions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/health")({
  head: () => ({
    meta: [
      { title: "System Health — GridArena" },
      { name: "description", content: "Production environment health and readiness checks." },
    ],
  }),
  component: HealthPage,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-destructive">Health check failed: {error.message}</p>
      <Button variant="outline" asChild className="mt-4">
        <Link to="/">Go home</Link>
      </Button>
    </main>
  ),
});

function HealthPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await getHealthStatus();
      setStatus(s);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load health");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const exportAvailable = typeof Blob !== "undefined" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Activity className="h-6 w-6 text-primary" />
          System Health
        </h1>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <Card className="border-border/40 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Production Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <CheckRow ok={status?.database === "ok"} label="Database connectivity" detail={status?.databaseError ?? undefined} />
          <CheckRow ok={!!user} label="Authenticated session" detail={user?.email ?? "Not signed in"} />
          <CheckRow ok={!!status?.hasApiKey} label="LLM provider API key" detail={status?.hasApiKey ? "Configured" : "Missing OPENAI_API_KEY"} />
          <CheckRow ok={!!status?.hasBaseUrl} label="LLM provider base URL" detail={status?.hasBaseUrl ? "Configured" : "Missing OPENAI_BASE_URL"} />
          <CheckRow warn={!status?.hasModel} label="Default model name" detail={status?.hasModel ? "Configured" : "Optional — falls back to gpt-4o-mini"} />
          <CheckRow
            ok={status?.simulator.state === "active"}
            warn={status?.simulator.state === "fallback"}
            label="Simulation Engine"
            detail={
              status?.simulator.state === "active"
                ? `Active — pandapower service responding (${status.simulator.latency_ms} ms · /health ${status.simulator.health_status} · /simulate ${status.simulator.simulate_status})`
                : status?.simulator.state === "fallback"
                  ? `Fallback → DC PF` +
                    ` · /health ${status?.simulator.health_status ?? "—"}` +
                    ` · /simulate ${status?.simulator.simulate_status ?? "—"}` +
                    (status?.simulator.simulate_error ? ` · simulate error: ${status.simulator.simulate_error}` : "") +
                    (status?.simulator.error && !status?.simulator.simulate_error ? ` (${status.simulator.error})` : "") +
                    (status?.simulator.simulate_body ? ` · body: ${status.simulator.simulate_body}` : "")
                  : "Unavailable"
            }
          />
          <CheckRow ok={exportAvailable} label="CSV export available (Blob/URL)" />
        </CardContent>
      </Card>

      {status && (
        <p className="mt-4 text-xs text-muted-foreground">
          Last checked: {new Date(status.timestamp).toLocaleString()}
        </p>
      )}
    </main>
  );
}

function CheckRow({ ok, warn, label, detail }: { ok?: boolean; warn?: boolean; label: string; detail?: string }) {
  const Icon = ok ? CheckCircle2 : warn ? AlertCircle : XCircle;
  const color = ok ? "text-emerald-500" : warn ? "text-amber-500" : "text-destructive";
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border/30 bg-muted/20 px-3 py-2">
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-4 w-4 ${color}`} />
        <div>
          <p className="text-sm font-medium">{label}</p>
          {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
        </div>
      </div>
    </div>
  );
}
