import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";
import {
  runAllTests,
  SYSTEM_VERSION,
  PARSER_VERSION,
  EVALUATION_LOGIC_VERSION,
} from "@/lib/validation/test-cases";

export const runAllValidations = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const results = runAllTests();

    const rows = results.map((r) => ({
      user_id: userId,
      test_name: r.test_name,
      test_type: r.test_type,
      expected_output: r.expected_output as any,
      actual_output: r.actual_output as any,
      status: r.status,
      failure_reason: r.failure_reason,
      debug_hint: r.debug_hint,
      execution_time_ms: r.execution_time_ms,
      system_version: SYSTEM_VERSION,
      parser_version: PARSER_VERSION,
      evaluation_logic_version: EVALUATION_LOGIC_VERSION,
    }));

    const { error } = await (supabase as any).from("validation_results").insert(rows);
    if (error) {
      return { success: false, error: error.message, results };
    }

    const passed = results.filter((r) => r.status === "passed").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const errored = results.filter((r) => r.status === "error").length;
    return { success: true, total: results.length, passed, failed, errored, results };
  });

export const getValidationResults = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { limit?: number }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await (supabase as any)
      .from("validation_results")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (error) return { results: [], error: error.message };
    return { results: rows ?? [] };
  });

export const deleteValidationResult = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as any)
      .from("validation_results")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  });

export const clearValidationResults = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as any)
      .from("validation_results")
      .delete()
      .eq("user_id", userId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  });
