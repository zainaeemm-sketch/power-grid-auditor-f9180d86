import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";
import { pingExternalSimulator } from "./simulation/external-client";

/**
 * Lightweight health check returning only booleans about secret presence.
 * NEVER returns secret values themselves — only existence flags.
 */
export interface HealthStatus {
  database: "ok" | "error";
  databaseError: string | null;
  hasApiKey: boolean;
  hasBaseUrl: boolean;
  hasModel: boolean;
  llmConfigured: boolean;
  simulator: {
    state: "active" | "fallback" | "unavailable";
    url: string | null;
    latency_ms: number | null;
    error: string | null;
    health_status: number | null;
    simulate_status: number | null;
    simulate_error: string | null;
    simulate_body: string | null;
  };
  timestamp: string;
}

export interface ReadinessRequestPayload {
  case_name: string;
  action: {
    action_type: string | null;
    target_index: number | null;
    value: number | null;
    enabled: boolean;
  };
}

export interface ReadinessResult {
  ok: boolean;
  status: "pass" | "warn" | "fail";
  http_status: number | null;
  latency_ms: number;
  engine: string | null;
  feasibility: string | null;
  baseline_violations: number | null;
  post_action_violations: number | null;
  notes: string | null;
  error: string | null;
  raw_body_preview: string | null;
  request_url: string | null;
  request_payload: ReadinessRequestPayload;
  timestamp: string;
}

/**
 * Strict no-op payload that matches the simulator's Pydantic `SimulateRequest`
 * schema (see simulation-service/main.py). All `Action` fields are explicit
 * so the server validates, and `action_type: "none"` + `enabled: true` makes
 * pypsa_runner skip mutation while still running a real baseline solve.
 */
export const READINESS_PAYLOAD: ReadinessRequestPayload = {
  case_name: "case14",
  action: {
    action_type: "none",
    target_index: null,
    value: null,
    enabled: true,
  },
};

function normalizeUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim().replace(/\/+$/, "");
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export const runProductionReadinessCheck = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .handler(async (): Promise<ReadinessResult> => {
    const timestamp = new Date().toISOString();
    const url = normalizeUrl(process.env.SIMULATION_SERVICE_URL);
    if (!url) {
      return {
        ok: false,
        status: "fail",
        http_status: null,
        latency_ms: 0,
        engine: null,
        feasibility: null,
        baseline_violations: null,
        post_action_violations: null,
        notes: "External simulator URL not configured",
        error: "SIMULATION_SERVICE_URL not set",
        raw_body_preview: null,
        request_url: null,
        request_payload: READINESS_PAYLOAD,
        timestamp,
      };
    }
    const token = process.env.SIMULATION_SERVICE_TOKEN;
    const request_url = `${url}/simulate`;
    const start = performance.now();
    try {
      const res = await fetch(request_url, {
        method: "POST",
        redirect: "follow",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(READINESS_PAYLOAD),
        signal: AbortSignal.timeout(15_000),
      });
      const latency_ms = Math.round(performance.now() - start);
      const http_status = res.status;
      const text = await res.text();
      const raw_body_preview = text.slice(0, 500);

      if (!res.ok) {
        return {
          ok: false,
          status: "fail",
          http_status,
          latency_ms,
          engine: null,
          feasibility: null,
          baseline_violations: null,
          post_action_violations: null,
          notes: `HTTP ${http_status} from /simulate`,
          error: `Non-2xx response (${http_status})`,
          raw_body_preview,
          request_url,
          request_payload: READINESS_PAYLOAD,
          timestamp,
        };
      }

      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch (e: any) {
        return {
          ok: false,
          status: "fail",
          http_status,
          latency_ms,
          engine: null,
          feasibility: null,
          baseline_violations: null,
          post_action_violations: null,
          notes: "Response was not valid JSON",
          error: e?.message ?? "JSON parse error",
          raw_body_preview,
          request_url,
          request_payload: READINESS_PAYLOAD,
          timestamp,
        };
      }

      const engine: string | null = json?.engine ?? json?.notes?.toLowerCase?.()?.includes("pandapower") ? "pandapower" : (json?.engine ?? null);
      const feasibility: string | null = json?.feasibility ?? null;
      const baseline_violations =
        typeof json?.baseline_violations === "number" ? json.baseline_violations : null;
      const post_action_violations =
        typeof json?.post_action_violations === "number" ? json.post_action_violations : null;

      const isPandapower =
        engine === "pandapower" ||
        engine === "pypsa" ||
        (typeof json?.notes === "string" && /pandapower|pypsa/i.test(json.notes));

      let status: "pass" | "warn" | "fail" = "pass";
      let notes: string | null = json?.notes ?? "Live /simulate succeeded";
      if (!isPandapower) {
        status = "warn";
        notes = "Engine field missing or not pandapower/pypsa";
      } else if (feasibility === "infeasible") {
        status = "warn";
        notes = "Solver returned infeasible for case14 no-op (unexpected)";
      }

      return {
        ok: true,
        status,
        http_status,
        latency_ms,
        engine,
        feasibility,
        baseline_violations,
        post_action_violations,
        notes,
        error: null,
        raw_body_preview: status === "pass" ? null : raw_body_preview,
        request_url,
        request_payload: READINESS_PAYLOAD,
        timestamp,
      };
    } catch (err: any) {
      const latency_ms = Math.round(performance.now() - start);
      const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
      return {
        ok: false,
        status: "fail",
        http_status: null,
        latency_ms,
        engine: null,
        feasibility: null,
        baseline_violations: null,
        post_action_violations: null,
        notes: isTimeout ? "Request timed out after 15s" : "Network error reaching simulator",
        error: err?.message ?? "Unknown error",
        raw_body_preview: null,
        request_url,
        request_payload: READINESS_PAYLOAD,
        timestamp,
      };
    }
  });

export const getHealthStatus = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }): Promise<HealthStatus> => {
    const { supabase } = context;

    let database: "ok" | "error" = "ok";
    let databaseError: string | null = null;
    try {
      const { error } = await supabase.from("runs").select("id", { count: "exact", head: true });
      if (error) {
        database = "error";
        databaseError = error.message;
      }
    } catch (err: any) {
      database = "error";
      databaseError = err?.message ?? "Unknown database error";
    }

    const hasApiKey = !!process.env.OPENAI_API_KEY;
    const hasBaseUrl = !!process.env.OPENAI_BASE_URL;
    const hasModel = !!process.env.OPENAI_MODEL;

    const sim = await pingExternalSimulator();
    const simState: HealthStatus["simulator"]["state"] = sim.available
      ? "active"
      : sim.url
        ? "fallback"
        : "fallback"; // DC fallback is always available in-Worker

    return {
      database,
      databaseError,
      hasApiKey,
      hasBaseUrl,
      hasModel,
      llmConfigured: hasApiKey && hasBaseUrl,
      simulator: {
        state: simState,
        url: sim.url,
        latency_ms: sim.latency_ms,
        error: sim.error,
        health_status: sim.health_status,
        simulate_status: sim.simulate_status,
        simulate_error: sim.simulate_error,
        simulate_body: sim.simulate_body,
      },
      timestamp: new Date().toISOString(),
    };
  });
