import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Activity, Zap, History, Trash2, BellRing, X, Wrench, Lightbulb } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  getSimulationDiagnostics,
  listSimulationHealthHistory,
  deleteSimulationHealthCheck,
  type SimulationDiagnostics,
  type SimulationHealthHistoryEntry,
} from "@/server/simulation-diagnostics.functions";
import { isCurrentUserAdmin } from "@/server/admin.functions";

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
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

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
    let cancelled = false;
    isCurrentUserAdmin()
      .then((r) => {
        if (cancelled) return;
        setIsAdmin(r.isAdmin);
        if (r.isAdmin) refresh();
        else setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIsAdmin(false);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);


  const versionOk = diag?.version.status === 200 && !!diag?.version.version;
  const healthOk = diag?.health.status === 200 && !diag?.health.error;
  const sims = diag?.simulates ?? [];
  const simAllOk = sims.length > 0 && sims.every((s) => s.ok);
  const overallOk = versionOk && healthOk && simAllOk;

  // Contextual troubleshooting tips derived from the latest diagnostic
  const tips = useMemo(() => {
    if (!diag) return [] as { title: string; body: string }[];
    const out: { title: string; body: string }[] = [];

    if (!diag.configured) {
      out.push({
        title: "SIMULATION_SERVICE_URL is not set",
        body: "The simulation microservice URL is missing from server secrets. Add SIMULATION_SERVICE_URL (e.g. https://your-pypsa-service.fly.dev) and, if your service requires auth, SIMULATION_SERVICE_TOKEN. Then re-run.",
      });
      return out;
    }

    // /version probe
    if (diag.version.error || diag.version.status === null) {
      const msg = diag.version.error ?? "no response";
      if (/abort|timeout/i.test(msg)) {
        out.push({
          title: "/version timed out",
          body: "The service didn't respond within 5s. It may be cold-starting (free Fly.io / Cloudflare Workers idle), or the host is unreachable. Retry once, then check the service is deployed and listening on the URL above.",
        });
      } else if (/ENOTFOUND|getaddrinfo|DNS|name not resolved/i.test(msg)) {
        out.push({
          title: "DNS resolution failed for the service URL",
          body: `Hostname in SIMULATION_SERVICE_URL can't be resolved (${msg}). Verify the URL is correct and publicly reachable from the internet.`,
        });
      } else if (/ECONNREFUSED|ECONNRESET|fetch failed/i.test(msg)) {
        out.push({
          title: "/version connection refused or reset",
          body: "The host responded but rejected the connection. Make sure the PyPSA microservice is running, exposes /version on HTTPS, and is not behind a firewall blocking outbound calls from this app.",
        });
      } else {
        out.push({
          title: "/version probe failed",
          body: `Error: ${msg}. Confirm the service implements GET /version returning {"version": "...", "engine": "PyPSA"}.`,
        });
      }
    } else if (diag.version.status && diag.version.status >= 400) {
      out.push({
        title: `/version returned HTTP ${diag.version.status}`,
        body:
          diag.version.status === 404
            ? "The service is reachable but does not implement GET /version. Add the endpoint to your microservice — it should return JSON like {\"version\": \"0.1.0\", \"engine\": \"PyPSA\"}."
            : `The service responded with HTTP ${diag.version.status}. Check the microservice logs for an unhandled error on GET /version.`,
      });
    } else if (!diag.version.version) {
      out.push({
        title: "/version response missing 'version' field",
        body: "GET /version returned 200 but the JSON body is missing the 'version' key. The endpoint should return {\"version\": \"<semver>\", \"engine\": \"PyPSA\"}.",
      });
    }

    // /health probe
    if (diag.health.error || diag.health.status === null) {
      const msg = diag.health.error ?? "no response";
      if (/HTTP 401/i.test(msg) || diag.health.status === 401) {
        out.push({
          title: "/health rejected with 401 Unauthorized",
          body: "The service requires a bearer token but SIMULATION_SERVICE_TOKEN is missing or wrong. Set it in server secrets to match the value the microservice expects.",
        });
      } else if (/HTTP 403/i.test(msg) || diag.health.status === 403) {
        out.push({
          title: "/health forbidden (403)",
          body: "Token was sent but the service refused. Verify SIMULATION_SERVICE_TOKEN matches the microservice configuration and that the token has not been rotated.",
        });
      } else if (/abort|timeout/i.test(msg)) {
        out.push({
          title: "/health timed out",
          body: "The /health endpoint didn't respond within 5s. The service may be overloaded or cold-starting — retry, and if it persists check service logs and resource limits.",
        });
      } else {
        out.push({
          title: "/health probe failed",
          body: `Error: ${msg}. Make sure the microservice exposes GET /health and returns 200 when ready.`,
        });
      }
    } else if (diag.health.status >= 500) {
      out.push({
        title: `/health returned HTTP ${diag.health.status}`,
        body: "The service is reachable but reporting an internal error on /health. Check microservice logs — common causes are missing Python deps, bad PyPSA install, or a dead solver.",
      });
    }

    // /simulate probes
    const failedSims = diag.simulates.filter((s) => !s.ok);
    if (failedSims.length > 0) {
      const has401 = failedSims.some((s) => s.status === 401);
      const has404 = failedSims.some((s) => s.status === 404);
      const hasTimeout = failedSims.some((s) => /abort|timeout/i.test(s.error ?? ""));
      const has5xx = failedSims.some((s) => (s.status ?? 0) >= 500);
      const hasParseErr = failedSims.some((s) => /Invalid JSON/i.test(s.error ?? ""));
      const cases = failedSims.map((s) => s.case_name).join(", ");

      if (has401) {
        out.push({
          title: `/simulate rejected with 401 on ${cases}`,
          body: "POST /simulate requires the bearer token. Set SIMULATION_SERVICE_TOKEN to match the microservice's expected value.",
        });
      }
      if (has404) {
        out.push({
          title: `/simulate returned 404 on ${cases}`,
          body: "The service does not implement POST /simulate. Add the endpoint accepting {case_name, action} and returning {feasibility, baseline_violations, post_action_violations, line_loadings}.",
        });
      }
      if (hasTimeout) {
        out.push({
          title: `/simulate timed out on ${cases}`,
          body: "PyPSA solve exceeded 10s. Larger cases (case30) under cold start may need more memory or a warmer instance. Consider bumping the service's compute tier or pre-warming the worker.",
        });
      }
      if (has5xx) {
        const sample = failedSims.find((s) => (s.status ?? 0) >= 500);
        out.push({
          title: `/simulate server error on ${cases}`,
          body: `Service returned HTTP ${sample?.status}. Inspect microservice logs — common causes: missing PyPSA case data, NumPy/scipy import error, or solver crash. Response sample: ${(sample?.raw_body ?? "").slice(0, 160)}`,
        });
      }
      if (hasParseErr) {
        out.push({
          title: `/simulate returned non-JSON on ${cases}`,
          body: "The endpoint returned 200 but the body wasn't valid JSON (likely an HTML error page or proxy response). Verify Content-Type: application/json and that no reverse proxy is intercepting the response.",
        });
      }
      if (!has401 && !has404 && !hasTimeout && !has5xx && !hasParseErr) {
        out.push({
          title: `/simulate failed on ${cases}`,
          body: "Check the per-case raw response shown below for details. The endpoint must return {feasibility, baseline_violations, post_action_violations, line_loadings, notes}.",
        });
      }
    }

    return out;
  }, [diag]);

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

  if (isAdmin === false) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Admin access required
            </CardTitle>
            <CardDescription>
              The simulation engine self-tests can only be run by administrators. Contact a workspace
              admin if you need to verify the PyPSA microservice.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild>
              <Link to="/health">General system health</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (isAdmin === null) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Checking permissions…</p>
      </main>
    );
  }

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

      {/* Troubleshooting tips — context-aware */}
      {diag && tips.length > 0 && (
        <Card className="mb-4 border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wrench className="h-4 w-4 text-amber-500" />
              Troubleshooting
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({tips.length} suggestion{tips.length === 1 ? "" : "s"})
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Based on the exact failure of each probe in the latest check.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tips.map((tip, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-background/40 p-3"
              >
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <p className="text-sm font-medium">{tip.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{tip.body}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
