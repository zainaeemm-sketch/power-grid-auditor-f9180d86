import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";

function normalizeServiceUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export interface SimulateProbe {
  status: number | null;
  ok: boolean;
  case_name: string;
  feasibility: string | null;
  baseline_violations: number | null;
  post_action_violations: number | null;
  line_loadings_count: number | null;
  notes: string | null;
  error: string | null;
  raw_body: string | null;
  latency_ms: number | null;
}

export interface SimulationDiagnostics {
  configured: boolean;
  url: string | null;
  version: {
    status: number | null;
    version: string | null;
    engine: string | null;
    error: string | null;
    latency_ms: number | null;
  };
  health: {
    status: number | null;
    body: string | null;
    error: string | null;
    latency_ms: number | null;
  };
  simulates: SimulateProbe[];
  timestamp: string;
}

const SIMULATE_CASES = ["case5", "case14", "case30"] as const;

async function probeSimulate(
  url: string,
  token: string | undefined,
  caseName: string,
): Promise<SimulateProbe> {
  const start = Date.now();
  const probe: SimulateProbe = {
    status: null,
    ok: false,
    case_name: caseName,
    feasibility: null,
    baseline_violations: null,
    post_action_violations: null,
    line_loadings_count: null,
    notes: null,
    error: null,
    raw_body: null,
    latency_ms: null,
  };
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 10_000);
    const res = await fetch(`${url}/simulate`, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        case_name: caseName,
        action: { action_type: "none", enabled: true },
      }),
      signal: ctl.signal,
    });
    clearTimeout(t);
    probe.status = res.status;
    probe.latency_ms = Date.now() - start;
    const text = await res.text();
    probe.raw_body = text.slice(0, 600);
    if (res.ok) {
      try {
        const j = JSON.parse(text) as {
          feasibility?: string;
          baseline_violations?: number;
          post_action_violations?: number;
          line_loadings?: unknown[];
          notes?: string;
        };
        probe.ok = true;
        probe.feasibility = j.feasibility ?? null;
        probe.baseline_violations = j.baseline_violations ?? null;
        probe.post_action_violations = j.post_action_violations ?? null;
        probe.line_loadings_count = Array.isArray(j.line_loadings) ? j.line_loadings.length : null;
        probe.notes = j.notes ?? null;
      } catch (e: any) {
        probe.error = `Invalid JSON: ${e?.message ?? "parse error"}`;
      }
    } else {
      probe.error = `HTTP ${res.status}`;
    }
  } catch (e: any) {
    probe.error = e?.message ?? "fetch failed";
    probe.latency_ms = Date.now() - start;
  }
  return probe;
}

export const getSimulationDiagnostics = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }): Promise<SimulationDiagnostics> => {
    const { supabase, userId } = context;
    const url = normalizeServiceUrl(process.env.SIMULATION_SERVICE_URL);
    const token = process.env.SIMULATION_SERVICE_TOKEN;
    const timestamp = new Date().toISOString();

    const persist = async (diag: SimulationDiagnostics) => {
      const sim_total_count = diag.simulates.length;
      const sim_pass_count = diag.simulates.filter((s) => s.ok).length;
      const sim_all_ok = sim_total_count > 0 && sim_pass_count === sim_total_count;
      const versionOk = diag.version.status === 200 && !!diag.version.version;
      const healthOk = diag.health.status === 200 && !diag.health.error;
      const overall_ok = diag.configured && versionOk && healthOk && sim_all_ok;
      try {
        await supabase.from("simulation_health_checks").insert({
          user_id: userId,
          configured: diag.configured,
          service_url: diag.url,
          overall_ok,
          version_status: diag.version.status,
          version_value: diag.version.version,
          version_engine: diag.version.engine,
          version_latency_ms: diag.version.latency_ms,
          version_error: diag.version.error,
          health_status: diag.health.status,
          health_latency_ms: diag.health.latency_ms,
          health_error: diag.health.error,
          health_body: diag.health.body,
          simulates: diag.simulates,
          sim_all_ok,
          sim_total_count,
          sim_pass_count,
        });
      } catch (e) {
        console.warn("[simulation-diagnostics] failed to persist check", e);
      }
    };

    if (!url) {
      const diag: SimulationDiagnostics = {
        configured: false,
        url: null,
        version: { status: null, version: null, engine: null, error: "Not configured", latency_ms: null },
        health: { status: null, body: null, error: "Not configured", latency_ms: null },
        simulates: [],
        timestamp,
      };
      await persist(diag);
      return diag;
    }

    // /version (unauthenticated)
    const versionStart = Date.now();
    const version = { status: null as number | null, version: null as string | null, engine: null as string | null, error: null as string | null, latency_ms: null as number | null };
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 5000);
      const res = await fetch(`${url}/version`, { method: "GET", redirect: "follow", signal: ctl.signal });
      clearTimeout(t);
      version.status = res.status;
      version.latency_ms = Date.now() - versionStart;
      if (res.ok) {
        const j = (await res.json()) as { version?: string; engine?: string };
        version.version = j.version ?? null;
        version.engine = j.engine ?? null;
      } else {
        version.error = `HTTP ${res.status}`;
      }
    } catch (e: any) {
      version.error = e?.message ?? "fetch failed";
      version.latency_ms = Date.now() - versionStart;
    }

    // /health
    const healthStart = Date.now();
    const health = { status: null as number | null, body: null as string | null, error: null as string | null, latency_ms: null as number | null };
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 5000);
      const res = await fetch(`${url}/health`, {
        method: "GET",
        redirect: "follow",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: ctl.signal,
      });
      clearTimeout(t);
      health.status = res.status;
      health.latency_ms = Date.now() - healthStart;
      try {
        health.body = (await res.text()).slice(0, 400);
      } catch {
        /* ignore */
      }
      if (!res.ok) health.error = `HTTP ${res.status}`;
    } catch (e: any) {
      health.error = e?.message ?? "fetch failed";
      health.latency_ms = Date.now() - healthStart;
    }

    // /simulate — quick DC PF self-test for each supported IEEE case (parallel)
    const simulates = await Promise.all(
      SIMULATE_CASES.map((c) => probeSimulate(url, token, c)),
    );

    const diag: SimulationDiagnostics = {
      configured: true,
      url,
      version,
      health,
      simulates,
      timestamp,
    };
    await persist(diag);
    return diag;
  });

export interface SimulationHealthHistoryEntry {
  id: string;
  created_at: string;
  configured: boolean;
  service_url: string | null;
  overall_ok: boolean;
  version_status: number | null;
  version_value: string | null;
  version_engine: string | null;
  version_latency_ms: number | null;
  version_error: string | null;
  health_status: number | null;
  health_latency_ms: number | null;
  health_error: string | null;
  sim_all_ok: boolean;
  sim_total_count: number;
  sim_pass_count: number;
  simulates: SimulateProbe[];
}

export const listSimulationHealthHistory = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }): Promise<SimulationHealthHistoryEntry[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("simulation_health_checks")
      .select(
        "id, created_at, configured, service_url, overall_ok, version_status, version_value, version_engine, version_latency_ms, version_error, health_status, health_latency_ms, health_error, sim_all_ok, sim_total_count, sim_pass_count, simulates",
      )
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) {
      console.error("[simulation-diagnostics] listSimulationHealthHistory failed", error);
      return [];
    }
    return (data ?? []) as unknown as SimulationHealthHistoryEntry[];
  });

export const deleteSimulationHealthCheck = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }): Promise<{ success: boolean }> => {
    const { supabase } = context;
    const { error } = await supabase.from("simulation_health_checks").delete().eq("id", data.id);
    if (error) {
      console.error("[simulation-diagnostics] deleteSimulationHealthCheck failed", error);
      return { success: false };
    }
    return { success: true };
  });


