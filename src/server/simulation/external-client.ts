import type { SimulationResult, StructuredAction } from "./types";

interface ExternalSimResponse {
  feasibility: "feasible" | "infeasible" | "not_applicable";
  baseline_violations: number;
  post_action_violations: number;
  violations_found: number;
  violation_improvement: number;
  line_loadings?: SimulationResult["line_loadings"];
  voltage_violations?: SimulationResult["voltage_violations"];
  generator_violations?: SimulationResult["generator_violations"];
  notes?: string;
}

function normalizeServiceUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Categorise a fetch failure into a short, human-readable reason code so
 * callers (and the /health UI) can show why we silently fell back to DC PF.
 */
function describeFailure(res: Response | null, err: unknown): string {
  if (err) {
    const e = err as { name?: string; message?: string };
    if (e?.name === "AbortError") return "timeout";
    return `fetch_error:${e?.message ?? "unknown"}`;
  }
  if (!res) return "no_response";
  if (res.status === 0) return "network_error";
  if (res.status === 401 || res.status === 403) return `auth_${res.status}`;
  if (res.status === 404) return "endpoint_404";
  if (res.status === 405) return "method_not_allowed_405";
  if (res.status >= 300 && res.status < 400) return `redirect_${res.status}`;
  if (res.status >= 500) return `server_${res.status}`;
  return `http_${res.status}`;
}

/**
 * Calls an external pandapower microservice. Returns null on any failure
 * (network, 5xx, timeout, missing config) — caller falls back to DC PF.
 *
 * Configure with:
 *   SIMULATION_SERVICE_URL   (e.g. https://gridarena-sim.fly.dev)
 *   SIMULATION_SERVICE_TOKEN (bearer token)
 */
export async function callExternalSimulator(
  caseName: string,
  action: StructuredAction,
): Promise<SimulationResult | null> {
  const url = normalizeServiceUrl(process.env.SIMULATION_SERVICE_URL);
  if (!url) {
    console.warn("[simulator] external service not configured — falling back to DC PF");
    return null;
  }
  const token = process.env.SIMULATION_SERVICE_TOKEN;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  const attempt = async (): Promise<Response> =>
    fetch(`${url}/simulate`, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ case_name: caseName, action }),
      signal: controller.signal,
    });

  let lastRes: Response | null = null;
  try {
    let res = await attempt();
    if (res.status >= 500 && res.status < 600) {
      res = await attempt();
    }
    clearTimeout(timeout);
    lastRes = res;
    if (!res.ok) {
      const reason = describeFailure(res, null);
      let body = "";
      try {
        body = (await res.text()).slice(0, 200);
      } catch {
        /* ignore */
      }
      console.warn(
        `[simulator] /simulate fallback → DC PF (case=${caseName} reason=${reason} url=${url}/simulate body=${body})`,
      );
      return null;
    }
    const json = (await res.json()) as ExternalSimResponse;
    return {
      engine: "pandapower",
      feasibility: json.feasibility,
      baseline_violations: json.baseline_violations,
      post_action_violations: json.post_action_violations,
      violations_found: json.violations_found,
      violation_improvement: json.violation_improvement,
      line_loadings: json.line_loadings ?? [],
      voltage_violations: json.voltage_violations ?? [],
      generator_violations: json.generator_violations ?? [],
      notes: json.notes ?? "Computed by external pandapower service.",
    };
  } catch (err) {
    clearTimeout(timeout);
    const reason = describeFailure(lastRes, err);
    console.warn(
      `[simulator] /simulate fallback → DC PF (case=${caseName} reason=${reason} url=${url}/simulate)`,
    );
    return null;
  }
}

export interface ExternalPerturbationResult {
  baseline: SimulationResult;
  perturbed: SimulationResult;
}

/**
 * Calls the external pandapower service's /simulate_perturbed endpoint.
 * Returns null on any failure (network, 5xx, timeout, missing config, 404 if
 * the deployed service is older and lacks the perturbation endpoint).
 */
export async function callExternalPerturbation(
  caseName: string,
  action: StructuredAction,
  perturbation: {
    perturbation_type: string;
    parameter_name: string;
    parameter_value: number | null;
    description: string;
  },
): Promise<ExternalPerturbationResult | null> {
  const url = normalizeServiceUrl(process.env.SIMULATION_SERVICE_URL);
  if (!url) {
    console.warn("[simulator] external service not configured — perturbation falls back to DC PF");
    return null;
  }
  const token = process.env.SIMULATION_SERVICE_TOKEN;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  const attempt = async (): Promise<Response> =>
    fetch(`${url}/simulate_perturbed`, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ case_name: caseName, action, perturbation }),
      signal: controller.signal,
    });

  const toResult = (r: ExternalSimResponse): SimulationResult => ({
    engine: "pandapower",
    feasibility: r.feasibility,
    baseline_violations: r.baseline_violations,
    post_action_violations: r.post_action_violations,
    violations_found: r.violations_found,
    violation_improvement: r.violation_improvement,
    line_loadings: r.line_loadings ?? [],
    voltage_violations: r.voltage_violations ?? [],
    generator_violations: r.generator_violations ?? [],
    notes: r.notes ?? "Computed by external pandapower service.",
  });

  let lastRes: Response | null = null;
  try {
    let res = await attempt();
    if (res.status >= 500 && res.status < 600) {
      res = await attempt();
    }
    clearTimeout(timeout);
    lastRes = res;
    if (!res.ok) {
      const reason = describeFailure(res, null);
      let body = "";
      try {
        body = (await res.text()).slice(0, 200);
      } catch {
        /* ignore */
      }
      console.warn(
        `[simulator] /simulate_perturbed fallback → DC PF (case=${caseName} reason=${reason} url=${url}/simulate_perturbed body=${body})`,
      );
      return null;
    }
    const json = (await res.json()) as { baseline: ExternalSimResponse; perturbed: ExternalSimResponse };
    if (!json.baseline || !json.perturbed) {
      console.warn(
        `[simulator] /simulate_perturbed fallback → DC PF (case=${caseName} reason=malformed_response)`,
      );
      return null;
    }
    return { baseline: toResult(json.baseline), perturbed: toResult(json.perturbed) };
  } catch (err) {
    clearTimeout(timeout);
    const reason = describeFailure(lastRes, err);
    console.warn(
      `[simulator] /simulate_perturbed fallback → DC PF (case=${caseName} reason=${reason} url=${url}/simulate_perturbed)`,
    );
    return null;
  }
}

/**
 * Probe the external pandapower service. We check BOTH /health and a tiny
 * POST /simulate so silent 3xx/4xx/5xx responses from the real endpoint are
 * caught — not just /health which might respond fine while /simulate doesn't.
 */
export async function pingExternalSimulator(): Promise<{
  available: boolean;
  url: string | null;
  latency_ms: number | null;
  error: string | null;
  health_status: number | null;
  simulate_status: number | null;
  simulate_error: string | null;
  simulate_body: string | null;
}> {
  const url = normalizeServiceUrl(process.env.SIMULATION_SERVICE_URL);
  if (!url) {
    return {
      available: false,
      url: null,
      latency_ms: null,
      error: "Not configured",
      health_status: null,
      simulate_status: null,
      simulate_error: null,
    };
  }
  const token = process.env.SIMULATION_SERVICE_TOKEN;
  const start = Date.now();

  // /health probe
  const healthCtl = new AbortController();
  const healthTimer = setTimeout(() => healthCtl.abort(), 5_000);
  let health_status: number | null = null;
  let healthError: string | null = null;
  try {
    const res = await fetch(`${url}/health`, {
      method: "GET",
      redirect: "follow",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: healthCtl.signal,
    });
    health_status = res.status;
    if (!res.ok) healthError = describeFailure(res, null);
  } catch (e: any) {
    healthError = describeFailure(null, e);
  } finally {
    clearTimeout(healthTimer);
  }

  // /simulate probe — skip if /health already failed (saves a round-trip and
  // reduces load on a struggling backend that's returning 500s).
  let simulate_status: number | null = null;
  let simulate_error: string | null = null;
  let simulate_body: string | null = null;
  if (healthError === null) {
    const simCtl = new AbortController();
    const simTimer = setTimeout(() => simCtl.abort(), 5_000);
    try {
      const res = await fetch(`${url}/simulate`, {
        method: "POST",
        redirect: "follow",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          case_name: "case5",
          action: { action_type: "none", enabled: true },
        }),
        signal: simCtl.signal,
      });
      simulate_status = res.status;
      if (!res.ok) {
        simulate_error = describeFailure(res, null);
        try {
          simulate_body = (await res.text()).slice(0, 400);
        } catch {
          /* ignore */
        }
      }
    } catch (e: any) {
      simulate_error = describeFailure(null, e);
    } finally {
      clearTimeout(simTimer);
    }
  }

  const latency_ms = Date.now() - start;
  const available = healthError === null && simulate_error === null;
  const error = available ? null : (simulate_error ?? healthError ?? "unknown");

  return {
    available,
    url,
    latency_ms,
    error,
    health_status,
    simulate_status,
    simulate_error,
    simulate_body,
  };
}
