import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Activity, Zap, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getHealthStatus,
  runProductionReadinessCheck,
  READINESS_PAYLOAD,
  type HealthStatus,
  type ReadinessResult,
} from "@/server/health.functions";
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
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);

  const runReadiness = async () => {
    setReadinessLoading(true);
    try {
      const r = await runProductionReadinessCheck();
      setReadiness(r);
    } catch (err: any) {
      setReadiness({
        ok: false,
        status: "fail",
        http_status: null,
        latency_ms: 0,
        engine: null,
        feasibility: null,
        baseline_violations: null,
        post_action_violations: null,
        notes: "Server function call failed",
        error: err?.message ?? "Unknown error",
        raw_body_preview: null,
        request_url: null,
        request_payload: READINESS_PAYLOAD,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setReadinessLoading(false);
    }
  };

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

      <Card className="mt-6 border-border/40 bg-card/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-primary" />
            Production Readiness
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Sends a live <code className="rounded bg-muted px-1">case14</code> no-op to{" "}
            <code className="rounded bg-muted px-1">/simulate</code> and reports the round-trip.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={runReadiness} disabled={readinessLoading} size="sm">
            {readinessLoading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Pinging case14…
              </>
            ) : (
              <>
                <Zap className="mr-1.5 h-3.5 w-3.5" />
                Run live PyPSA test
              </>
            )}
          </Button>

          {readiness && <ReadinessPanel result={readiness} />}
        </CardContent>
      </Card>
    </main>
  );
}

function ReadinessPanel({ result }: { result: ReadinessResult }) {
  const StatusIcon =
    result.status === "pass" ? CheckCircle2 : result.status === "warn" ? AlertCircle : XCircle;
  const statusColor =
    result.status === "pass"
      ? "text-emerald-500"
      : result.status === "warn"
        ? "text-amber-500"
        : "text-destructive";
  const statusLabel =
    result.status === "pass" ? "PASS" : result.status === "warn" ? "WARN" : "FAIL";

  return (
    <div className="space-y-3 rounded-md border border-border/40 bg-muted/20 p-3">
      <div className="flex items-center gap-2">
        <StatusIcon className={`h-5 w-5 ${statusColor}`} />
        <span className={`text-sm font-semibold ${statusColor}`}>{statusLabel}</span>
        {result.notes && (
          <span className="text-xs text-muted-foreground">— {result.notes}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Stat label="HTTP" value={result.http_status?.toString() ?? "—"} />
        <Stat label="Latency" value={`${result.latency_ms} ms`} />
        <Stat label="Engine" value={result.engine ?? "—"} />
        <Stat label="Feasibility" value={result.feasibility ?? "—"} />
        <Stat
          label="Baseline viol."
          value={result.baseline_violations?.toString() ?? "—"}
        />
        <Stat
          label="Post-action viol."
          value={result.post_action_violations?.toString() ?? "—"}
        />
      </div>

      {result.error && (
        <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          <span className="font-medium">Error:</span> {result.error}
        </div>
      )}

      {result.raw_body_preview && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Raw response preview (first 500 chars)
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded bg-background/60 p-2 text-[11px]">
            {result.raw_body_preview}
          </pre>
        </details>
      )}

      <p className="text-[11px] text-muted-foreground">
        Checked at {new Date(result.timestamp).toLocaleString()}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/30 bg-background/40 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono text-xs font-medium">{value}</p>
    </div>
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
