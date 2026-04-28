import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Activity, Zap, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getHealthStatus,
  runProductionReadinessCheck,
  getEvaluationPipelineHealth,
  READINESS_PAYLOAD,
  type HealthStatus,
  type ReadinessResult,
  type EvaluationPipelineHealth,
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

interface ReadinessHistoryEntry {
  timestamp: string;
  status: "pass" | "warn" | "fail";
  http_status: number | null;
  latency_ms: number;
  engine: string | null;
}

const HISTORY_KEY = "gridarena.readiness.history.v1";
const HISTORY_MAX = 20;

function loadHistory(): ReadinessHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: ReadinessHistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(-HISTORY_MAX)));
  } catch {
    /* quota or disabled — ignore */
  }
}

function HealthPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [history, setHistory] = useState<ReadinessHistoryEntry[]>([]);
  const [evalHealth, setEvalHealth] = useState<EvaluationPipelineHealth | null>(null);
  const [evalHealthLoading, setEvalHealthLoading] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const recordHistory = (r: ReadinessResult) => {
    setHistory((prev) => {
      const next = [
        ...prev,
        {
          timestamp: r.timestamp,
          status: r.status,
          http_status: r.http_status,
          latency_ms: r.latency_ms,
          engine: r.engine,
        },
      ].slice(-HISTORY_MAX);
      saveHistory(next);
      return next;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  const runReadiness = async () => {
    setReadinessLoading(true);
    try {
      const r = await runProductionReadinessCheck();
      setReadiness(r);
      recordHistory(r);
    } catch (err: any) {
      const fallback: ReadinessResult = {
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
      };
      setReadiness(fallback);
      recordHistory(fallback);
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
          <CheckRow ok={!!status?.hasApiKey} label="LLM provider API key" detail={status?.hasApiKey ? "Configured (OPENAI_API_KEY)" : "Missing OPENAI_API_KEY"} />
          <CheckRow ok={!!status?.hasBaseUrl} label="LLM provider base URL" detail={status?.hasBaseUrl ? "Configured (OPENAI_BASE_URL)" : "Missing OPENAI_BASE_URL"} />
          <CheckRow ok={!!status?.hasModel} warn={!status?.hasModel} label="Default model name" detail={status?.hasModel ? "Configured (OPENAI_MODEL)" : "Optional — OPENAI_MODEL not set, falls back to gpt-4o-mini"} />
          <CheckRow
            ok={status?.simulator.state === "active"}
            warn={status?.simulator.state === "fallback"}
            label="Simulation Engine"
            detail={
              status?.simulator.state === "active"
                ? `Active — PyPSA service responding (${status.simulator.latency_ms} ms · /health ${status.simulator.health_status} · /simulate ${status.simulator.simulate_status})`
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
          <div className="flex items-center gap-2">
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
          </div>

          <details className="rounded-md border border-border/30 bg-muted/10 px-3 py-2 text-xs" open={!readiness}>
            <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
              Request payload (matches simulator <code className="rounded bg-muted px-1">SimulateRequest</code> schema)
            </summary>
            <p className="mt-2 text-[11px] text-muted-foreground">
              <span className="font-mono">POST</span> {readiness?.request_url ?? "{SIMULATION_SERVICE_URL}"}/simulate
            </p>
            <pre className="mt-2 max-h-56 overflow-auto rounded bg-background/60 p-2 font-mono text-[11px] leading-relaxed">
{JSON.stringify(readiness?.request_payload ?? READINESS_PAYLOAD, null, 2)}
            </pre>
            <p className="mt-2 text-[11px] text-muted-foreground">
              All <code className="rounded bg-muted px-1">action</code> fields are explicit (
              <code className="rounded bg-muted px-1">action_type</code>,{" "}
              <code className="rounded bg-muted px-1">target_index</code>,{" "}
              <code className="rounded bg-muted px-1">value</code>,{" "}
              <code className="rounded bg-muted px-1">enabled</code>) so the Pydantic validator passes.{" "}
              <code className="rounded bg-muted px-1">action_type: "none"</code> +{" "}
              <code className="rounded bg-muted px-1">enabled: true</code> triggers a real baseline solve with no mutation.
            </p>
          </details>

          <SchemaValidationPanel payload={readiness?.request_payload ?? READINESS_PAYLOAD} />

          {readiness && <ReadinessPanel result={readiness} />}

          <ReadinessHistoryChart history={history} onClear={clearHistory} />
        </CardContent>
      </Card>
    </main>
  );
}

function ReadinessHistoryChart({
  history,
  onClear,
}: {
  history: ReadinessHistoryEntry[];
  onClear: () => void;
}) {
  if (history.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/40 bg-muted/10 p-3 text-xs text-muted-foreground">
        No readiness history yet — run the test above to start tracking latency and HTTP status over time.
      </div>
    );
  }

  const W = 320;
  const H = 80;
  const PAD_X = 8;
  const PAD_Y = 8;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;

  const latencies = history.map((h) => h.latency_ms);
  const maxLatency = Math.max(...latencies, 100);
  const stepX = history.length > 1 ? innerW / (history.length - 1) : 0;

  const points = history.map((h, i) => {
    const x = PAD_X + i * stepX;
    const y = PAD_Y + innerH - (h.latency_ms / maxLatency) * innerH;
    return { x, y, entry: h };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(PAD_Y + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(PAD_Y + innerH).toFixed(1)} Z`;

  const dotColor = (s: ReadinessHistoryEntry["status"]) =>
    s === "pass" ? "hsl(var(--primary))" : s === "warn" ? "hsl(var(--warning, 38 92% 50%))" : "hsl(var(--destructive))";

  const passCount = history.filter((h) => h.status === "pass").length;
  const warnCount = history.filter((h) => h.status === "warn").length;
  const failCount = history.filter((h) => h.status === "fail").length;
  const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  const last = history[history.length - 1];

  return (
    <div className="rounded-md border border-border/40 bg-muted/10 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold">Recent checks ({history.length}/{HISTORY_MAX})</p>
          <p className="text-[11px] text-muted-foreground">
            Latency over time · pass <span className="text-emerald-500">{passCount}</span> · warn{" "}
            <span className="text-amber-500">{warnCount}</span> · fail{" "}
            <span className="text-destructive">{failCount}</span>
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear} className="h-7 px-2 text-xs">
          Clear
        </Button>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-20 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Readiness latency chart"
      >
        <defs>
          <linearGradient id="readinessFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* baseline */}
        <line
          x1={PAD_X}
          y1={PAD_Y + innerH}
          x2={W - PAD_X}
          y2={PAD_Y + innerH}
          stroke="currentColor"
          strokeOpacity="0.15"
          strokeWidth="1"
        />
        {history.length > 1 && (
          <>
            <path d={areaPath} fill="url(#readinessFill)" />
            <path d={linePath} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
          </>
        )}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={2.5}
            fill={dotColor(p.entry.status)}
          >
            <title>
              {new Date(p.entry.timestamp).toLocaleString()} — {p.entry.latency_ms} ms · HTTP{" "}
              {p.entry.http_status ?? "—"} · {p.entry.status.toUpperCase()}
            </title>
          </circle>
        ))}
      </svg>

      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div className="rounded border border-border/30 bg-background/40 px-2 py-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Avg latency</p>
          <p className="font-mono font-medium">{avgLatency} ms</p>
        </div>
        <div className="rounded border border-border/30 bg-background/40 px-2 py-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Peak latency</p>
          <p className="font-mono font-medium">{maxLatency} ms</p>
        </div>
        <div className="rounded border border-border/30 bg-background/40 px-2 py-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last HTTP</p>
          <p className="font-mono font-medium">{last.http_status ?? "—"}</p>
        </div>
      </div>
    </div>
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

interface FieldSpec {
  name: string;
  expectedType: string;
  description: string;
  required: boolean;
  validate: (v: unknown) => { ok: boolean; reason: string };
}

const ACTION_FIELD_SPECS: FieldSpec[] = [
  {
    name: "action_type",
    expectedType: 'string | null',
    description: 'Action verb. "none" runs a baseline solve with no mutation.',
    required: true,
    validate: (v) =>
      v === null || typeof v === "string"
        ? { ok: true, reason: typeof v === "string" ? `string("${v}")` : "null" }
        : { ok: false, reason: `expected string|null, got ${typeof v}` },
  },
  {
    name: "target_index",
    expectedType: "number | null",
    description: "0-based index of the target generator/branch/load.",
    required: true,
    validate: (v) =>
      v === null || (typeof v === "number" && Number.isInteger(v) && v >= 0)
        ? { ok: true, reason: typeof v === "number" ? `int(${v})` : "null" }
        : { ok: false, reason: `expected non-negative int|null, got ${JSON.stringify(v)}` },
  },
  {
    name: "value",
    expectedType: "number | null",
    description: "Numeric parameter (MW, p.u., or scale factor) — schema-dependent.",
    required: true,
    validate: (v) =>
      v === null || (typeof v === "number" && Number.isFinite(v))
        ? { ok: true, reason: typeof v === "number" ? `number(${v})` : "null" }
        : { ok: false, reason: `expected finite number|null, got ${JSON.stringify(v)}` },
  },
  {
    name: "enabled",
    expectedType: "boolean",
    description: "When false, pypsa_runner skips action application entirely.",
    required: true,
    validate: (v) =>
      typeof v === "boolean"
        ? { ok: true, reason: `bool(${v})` }
        : { ok: false, reason: `expected boolean, got ${typeof v}` },
  },
];

const ROOT_FIELD_SPECS: FieldSpec[] = [
  {
    name: "case_name",
    expectedType: "string",
    description: "Name of the registered PyPSA case (e.g. case14, case30).",
    required: true,
    validate: (v) =>
      typeof v === "string" && v.length > 0
        ? { ok: true, reason: `string("${v}")` }
        : { ok: false, reason: `expected non-empty string, got ${JSON.stringify(v)}` },
  },
];

function SchemaValidationPanel({ payload }: { payload: { case_name: string; action: Record<string, unknown> } }) {
  const rootResults = ROOT_FIELD_SPECS.map((spec) => ({
    spec,
    result: spec.validate((payload as any)?.[spec.name]),
    actual: (payload as any)?.[spec.name],
  }));
  const actionResults = ACTION_FIELD_SPECS.map((spec) => ({
    spec,
    result: spec.validate(payload?.action?.[spec.name]),
    actual: payload?.action?.[spec.name],
  }));
  const all = [...rootResults, ...actionResults];
  const failures = all.filter((r) => !r.result.ok).length;
  const allValid = failures === 0;

  return (
    <div className="rounded-md border border-border/40 bg-muted/10 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {allValid ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
          <p className="text-xs font-semibold">
            Schema check ({all.length - failures}/{all.length} fields valid)
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Pydantic <code className="rounded bg-muted px-1">SimulateRequest</code>
        </span>
      </div>

      <div className="space-y-2">
        <FieldGroup title="Root" rows={rootResults} />
        <FieldGroup title="action" rows={actionResults} />
      </div>

      {!allValid && (
        <p className="mt-2 text-[11px] text-destructive">
          {failures} field(s) would be rejected by the simulator's Pydantic validator. Fix before sending.
        </p>
      )}
    </div>
  );
}

function FieldGroup({
  title,
  rows,
}: {
  title: string;
  rows: { spec: FieldSpec; result: { ok: boolean; reason: string }; actual: unknown }[];
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-1">
        {rows.map(({ spec, result, actual }) => {
          const Icon = result.ok ? CheckCircle2 : XCircle;
          const color = result.ok ? "text-emerald-500" : "text-destructive";
          return (
            <li
              key={spec.name}
              className="flex items-start gap-2 rounded border border-border/30 bg-background/40 px-2 py-1.5"
            >
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${color}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <code className="font-mono text-xs font-medium">{spec.name}</code>
                  <span className="text-[10px] text-muted-foreground">
                    {spec.expectedType}
                    {spec.required && (
                      <span className="ml-1 rounded bg-muted px-1 text-[9px] uppercase">required</span>
                    )}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">{spec.description}</p>
                <p className={`mt-0.5 font-mono text-[10px] ${color}`}>
                  actual: {JSON.stringify(actual)} — {result.reason}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
