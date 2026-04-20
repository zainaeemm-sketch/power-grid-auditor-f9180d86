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
  const url = process.env.SIMULATION_SERVICE_URL;
  if (!url) return null;
  const token = process.env.SIMULATION_SERVICE_TOKEN;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  const attempt = async (): Promise<Response> =>
    fetch(`${url.replace(/\/+$/, "")}/simulate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ case_name: caseName, action }),
      signal: controller.signal,
    });

  try {
    let res = await attempt();
    if (res.status >= 500 && res.status < 600) {
      // one retry for transient 5xx
      res = await attempt();
    }
    clearTimeout(timeout);
    if (!res.ok) return null;
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
  } catch {
    clearTimeout(timeout);
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
  const url = process.env.SIMULATION_SERVICE_URL;
  if (!url) return null;
  const token = process.env.SIMULATION_SERVICE_TOKEN;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  const attempt = async (): Promise<Response> =>
    fetch(`${url.replace(/\/+$/, "")}/simulate_perturbed`, {
      method: "POST",
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

  try {
    let res = await attempt();
    if (res.status >= 500 && res.status < 600) {
      res = await attempt();
    }
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = (await res.json()) as { baseline: ExternalSimResponse; perturbed: ExternalSimResponse };
    if (!json.baseline || !json.perturbed) return null;
    return { baseline: toResult(json.baseline), perturbed: toResult(json.perturbed) };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export async function pingExternalSimulator(): Promise<{
  available: boolean;
  url: string | null;
  latency_ms: number | null;
  error: string | null;
}> {
  const url = process.env.SIMULATION_SERVICE_URL;
  if (!url) return { available: false, url: null, latency_ms: null, error: "Not configured" };
  const token = process.env.SIMULATION_SERVICE_TOKEN;
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/health`, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const latency_ms = Date.now() - start;
    if (!res.ok) return { available: false, url, latency_ms, error: `HTTP ${res.status}` };
    return { available: true, url, latency_ms, error: null };
  } catch (e: any) {
    clearTimeout(timeout);
    return { available: false, url, latency_ms: null, error: e?.message ?? "fetch failed" };
  }
}
