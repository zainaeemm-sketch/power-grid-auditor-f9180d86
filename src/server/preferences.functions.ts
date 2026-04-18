import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";

export const OPENAI_MODEL_OPTIONS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4.1-mini",
  "gpt-4.1",
  "gpt-5-mini",
  "gpt-5",
  "o3-mini",
  "o4-mini",
] as const;

export const getMyPreferences = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ openai_model: string | null }> => {
    const { data, error } = await context.supabase
      .from("user_preferences")
      .select("openai_model")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { openai_model: (data as any)?.openai_model ?? null };
  });

export const updateMyPreferences = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { openai_model: string | null }) => input)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const model = data.openai_model && data.openai_model.trim() ? data.openai_model.trim() : null;
    const { error } = await context.supabase
      .from("user_preferences")
      .upsert(
        { user_id: context.userId, openai_model: model, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
