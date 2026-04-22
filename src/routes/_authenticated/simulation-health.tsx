import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Activity, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getSimulationDiagnostics,
  type SimulationDiagnostics,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getSimulationDiagnostics();
      setDiag(d);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load diagnostics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const versionOk = diag?.version.status === 200 && !!diag?.version.version;
  const healthOk = diag?.health.status === 200 && !diag?.health.error;
  const simOk = !!diag?.simulate.ok;
  const overallOk = versionOk && healthOk && simOk;

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

      {/* /simulate self-test */}
      <Card className="mb-4 border-border/40 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <StatusIcon ok={simOk} />
            <span className="font-mono">POST /simulate</span>
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              case5 · no-op action · DC power flow
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Status" value={diag?.simulate.status?.toString() ?? "—"} />
          <Row label="Latency" value={diag?.simulate.latency_ms ? `${diag.simulate.latency_ms} ms` : "—"} />
          <Row label="Feasibility" value={diag?.simulate.feasibility ?? "—"} mono />
          <Row
            label="Baseline violations"
            value={diag?.simulate.baseline_violations?.toString() ?? "—"}
          />
          <Row
            label="Post-action violations"
            value={diag?.simulate.post_action_violations?.toString() ?? "—"}
          />
          <Row
            label="Line loadings returned"
            value={diag?.simulate.line_loadings_count?.toString() ?? "—"}
          />
          {diag?.simulate.notes && <Row label="Notes" value={diag.simulate.notes} />}
          {diag?.simulate.error && <Row label="Error" value={diag.simulate.error} error />}
          {!simOk && diag?.simulate.raw_body && (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Raw response body</p>
              <pre className="overflow-x-auto rounded-md border border-border/30 bg-muted/30 p-2 font-mono text-xs">
                {diag.simulate.raw_body}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {diag && (
        <p className="mt-4 text-xs text-muted-foreground">
          Last checked: {new Date(diag.timestamp).toLocaleString()}
        </p>
      )}

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
