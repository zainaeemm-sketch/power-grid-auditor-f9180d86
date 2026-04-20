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
  };
  timestamp: string;
}

export const getHealthStatus = createServerFn({ method: "GET" })
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
      },
      timestamp: new Date().toISOString(),
    };
  });
