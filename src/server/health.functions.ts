import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";

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

    return {
      database,
      databaseError,
      hasApiKey,
      hasBaseUrl,
      hasModel,
      llmConfigured: hasApiKey && hasBaseUrl,
      timestamp: new Date().toISOString(),
    };
  });
