import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Activity, Zap, History, Trash2, BellRing, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  getSimulationDiagnostics,
  listSimulationHealthHistory,
  deleteSimulationHealthCheck,
  type SimulationDiagnostics,
  type SimulationHealthHistoryEntry,
} from "@/server/simulation-diagnostics.functions";

export const Route = createFileRoute("/_authenticated/simulation-health")({
  head: () => ({
    meta: [
      { title: "Simulation Health — GridArena" },
      {
        name: "description",
        content: "PyPSA simulation engine version, health, and DC power flow self-test.",
      },
    ],
  }),
  component: SimulationHealthPage,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-destructive">Diagnostics failed: {error.message}</p>
      <Button variant="outline" asChild className="mt-4">
        <Link to="/">Go home</Link>
      </Button>
    </main>
  ),
});

function SimulationHealthPage() {
  const [diag, setDiag] = useState<SimulationDiagnostics | null>(null);
  const [history, setHistory] = useState<SimulationHealthHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    try {
      const list = await listSimulationHealthHistory();
      setHistory(list);
    } catch (e) {
      console.warn("Failed to load history", e);
    }
  };

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getSimulationDiagnostics();
      setDiag(d);
      await loadHistory();
    } catch (e: any) {
      setError(e?.message ?? "Failed to load diagnostics");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    await deleteSimulationHealthCheck({ data: { id } });
    await loadHistory();
  };

  useEffect(() => {
    refresh();
  }, []);


  const versionOk = diag?.version.status === 200 && !!diag?.version.version;
  const healthOk = diag?.health.status === 200 && !diag?.health.error;
  const sims = diag?.simulates ?? [];
  const simAllOk = sims.length > 0 && sims.every((s) => s.ok);
  const overallOk = versionOk && healthOk && simAllOk;

  // State-change detection: alert only when previous check passed and current failed.
  const stateChangeAlert = useMemo(() => {
    if (history.length < 2) return null;
    const [current, previous] = history;
    if (current.overall_ok) return null;
    if (!previous.overall_ok) return null; // already failing — quiet
    const reasons: string[] = [];
    if (current.version_error || current.version_status !== 200) {
      reasons.push(`version (${current.version_error ?? `HTTP ${current.version_status ?? "?"}`})`);
    }
    if (!current.sim_all_ok && current.sim_total_count > 0) {
      const failed = current.simulates.filter((s) => !s.ok).map((s) => s.case_name);
      reasons.push(`simulate (${failed.join(", ")})`);
    }
    if (current.health_error || (current.health_status !== null && current.health_status !== 200)) {
      reasons.push(`health (${current.health_error ?? `HTTP ${current.health_status}`})`);
    }
    return { id: current.id, at: current.created_at, reasons };
  }, [history]);

  const [dismissedAlertId, setDismissedAlertId] = useState<string | null>(null);
  const showAlert = stateChangeAlert && stateChangeAlert.id !== dismissedAlertId;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Activity className="h-6 w-6 text-primary" />
            Simulation Health
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            PyPSA microservice version, health probe, and DC power flow self-test.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Re-run
        </Button>
      </div>

      {showAlert && stateChangeAlert && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/60 bg-destructive/10 p-4"
        >
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">
              Simulation health just started failing
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              At {new Date(stateChangeAlert.at).toLocaleString()} — the previous check was passing.
            </p>
            {stateChangeAlert.reasons.length > 0 && (
              <p className="mt-1 text-xs text-destructive">
                Failing: {stateChangeAlert.reasons.join(" · ")}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDismissedAlertId(stateChangeAlert.id)}
            aria-label="Dismiss alert"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Overall summary */}
      <Card className="mb-4 border-border/40 bg-card/60">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Engine Status
            </span>
            {diag && (
              <Badge variant={overallOk ? "default" : diag.configured ? "destructive" : "secondary"}>
                {overallOk ? "All checks passing" : diag.configured ? "Issues detected" : "Not configured"}
              </Badge>
            )}
          </CardTitle>
          {diag?.url && (
            <CardDescription className="break-all font-mono text-xs">{diag.url}</CardDescription>
          )}
        </CardHeader>
      </Card>

      {/* /version */}
      <Card className="mb-4 border-border/40 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <StatusIcon ok={versionOk} />
            <span className="font-mono">GET /version</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Status" value={diag?.version.status?.toString() ?? "—"} />
          <Row label="Engine" value={diag?.version.engine ?? "—"} mono />
          <Row label="Build version" value={diag?.version.version ?? "—"} mono />
          <Row label="Latency" value={diag?.version.latency_ms ? `${diag.version.latency_ms} ms` : "—"} />
          {diag?.version.error && <Row label="Error" value={diag.version.error} error />}
        </CardContent>
      </Card>

      {/* /health */}
      <Card className="mb-4 border-border/40 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <StatusIcon ok={healthOk} />
            <span className="font-mono">GET /health</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Status" value={diag?.health.status?.toString() ?? "—"} />
          <Row label="Latency" value={diag?.health.latency_ms ? `${diag.health.latency_ms} ms` : "—"} />
          {diag?.health.body && (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Body</p>
              <pre className="overflow-x-auto rounded-md border border-border/30 bg-muted/30 p-2 font-mono text-xs">
                {diag.health.body}
              </pre>
            </div>
          )}
          {diag?.health.error && <Row label="Error" value={diag.health.error} error />}
        </CardContent>
      </Card>

      {/* /simulate self-tests — one card per IEEE case */}
      {sims.map((s) => (
        <Card key={s.case_name} className="mb-4 border-border/40 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <StatusIcon ok={s.ok} />
              <span className="font-mono">POST /simulate</span>
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {s.case_name} · no-op action · DC power flow
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Status" value={s.status?.toString() ?? "—"} />
            <Row label="Latency" value={s.latency_ms ? `${s.latency_ms} ms` : "—"} />
            <Row label="Feasibility" value={s.feasibility ?? "—"} mono />
            <Row label="Baseline violations" value={s.baseline_violations?.toString() ?? "—"} />
            <Row label="Post-action violations" value={s.post_action_violations?.toString() ?? "—"} />
            <Row label="Line loadings returned" value={s.line_loadings_count?.toString() ?? "—"} />
            {s.notes && <Row label="Notes" value={s.notes} />}
            {s.error && <Row label="Error" value={s.error} error />}
            {!s.ok && s.raw_body && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Raw response body</p>
                <pre className="overflow-x-auto rounded-md border border-border/30 bg-muted/30 p-2 font-mono text-xs">
                  {s.raw_body}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {diag && sims.length === 0 && (
        <Card className="mb-4 border-border/40 bg-card/60">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No simulation self-tests ran (service not configured).
          </CardContent>
        </Card>
      )}

      {diag && (
        <p className="mt-4 text-xs text-muted-foreground">
          Last checked: {new Date(diag.timestamp).toLocaleString()}
        </p>
      )}

      {/* History */}
      <Card className="mt-6 border-border/40 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Recent checks
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({history.length} stored, newest first)
            </span>
          </CardTitle>
          <CardDescription className="text-xs">
            Each refresh of this page is recorded so you can review failures over time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 && (
            <p className="text-xs text-muted-foreground">No history yet.</p>
          )}
          {history.map((h) => (
            <div
              key={h.id}
              className="flex items-start justify-between gap-3 rounded-md border border-border/30 bg-muted/20 px-3 py-2"
            >
              <div className="flex items-start gap-2">
                {h.overall_ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 text-destructive" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    {new Date(h.created_at).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {h.configured ? (
                      <>
                        version {h.version_value ?? "—"} · sims {h.sim_pass_count}/{h.sim_total_count}
                        {h.version_latency_ms != null && ` · v ${h.version_latency_ms}ms`}
                        {h.health_latency_ms != null && ` · h ${h.health_latency_ms}ms`}
                      </>
                    ) : (
                      "Service not configured"
                    )}
                  </p>
                  {(h.version_error || h.health_error) && (
                    <p className="text-xs text-destructive">
                      {h.version_error && `version: ${h.version_error}`}
                      {h.version_error && h.health_error && " · "}
                      {h.health_error && `health: ${h.health_error}`}
                    </p>
                  )}
                  {!h.sim_all_ok && h.sim_total_count > 0 && (
                    <p className="text-xs text-destructive">
                      Failed cases:{" "}
                      {h.simulates
                        .filter((s) => !s.ok)
                        .map((s) => `${s.case_name} (${s.error ?? "fail"})`)
                        .join(", ")}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(h.id)}
                aria-label="Delete check"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mt-6 flex gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to="/health">General system health</Link>
        </Button>
      </div>
    </main>
  );
}

function StatusIcon({ ok }: { ok: boolean }) {
  if (ok) return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}

function Row({
  label,
  value,
  mono,
  error,
}: {
  label: string;
  value: string;
  mono?: boolean;
  error?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`text-right text-xs ${mono ? "font-mono" : ""} ${error ? "text-destructive" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
