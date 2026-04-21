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
  .handler(async ({ context }): Promise<{ openai_model: string | null; auto_judge_enabled: boolean }> => {
    const { data, error } = await context.supabase
      .from("user_preferences")
      .select("openai_model, auto_judge_enabled")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      openai_model: (data as any)?.openai_model ?? null,
      auto_judge_enabled: Boolean((data as any)?.auto_judge_enabled),
    };
  });

export const updateMyPreferences = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { openai_model?: string | null; auto_judge_enabled?: boolean }) => input)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const row: any = { user_id: context.userId, updated_at: new Date().toISOString() };
    if (data.openai_model !== undefined) {
      row.openai_model = data.openai_model && data.openai_model.trim() ? data.openai_model.trim() : null;
    }
    if (data.auto_judge_enabled !== undefined) {
      row.auto_judge_enabled = !!data.auto_judge_enabled;
    }
    const { error } = await context.supabase
      .from("user_preferences")
      .upsert(row, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
