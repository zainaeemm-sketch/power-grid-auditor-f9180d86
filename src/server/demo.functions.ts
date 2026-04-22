import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";
import { DEMO_PRESETS } from "@/lib/demo-dataset";

const DEMO_MODEL = "gpt-4o-mini";
const DEMO_PROVIDER = "OpenAI";

/**
 * Idempotently seed demo presets and example completed runs for the
 * authenticated user. Safe to call multiple times — matches by preset name.
 */
export const seedDemoData = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ presets_created: number; runs_created: number }> => {
    const { supabase, userId } = context;
    let presetsCreated = 0;
    let runsCreated = 0;

    for (const demo of DEMO_PRESETS) {
      // Upsert preset (match by name + user_id).
      const { data: existing } = await supabase
        .from("experiment_presets")
        .select("id")
        .eq("user_id", userId)
        .eq("name", demo.name)
        .maybeSingle();

      let presetId = existing?.id;

      if (!presetId) {
        const { data: inserted, error: insErr } = await supabase
          .from("experiment_presets")
          .insert({
            user_id: userId,
            name: demo.name,
            default_prompt_text: demo.prompt,
            evaluation_mode: "simulation",
            model_name: DEMO_MODEL,
            provider_name: DEMO_PROVIDER,
            temperature: 0.2,
            top_p: 1,
            max_tokens: 1024,
            random_seed: 42,
            notes: "Seeded by seedDemoData. Safe to delete.",
          })
          .select("id")
          .single();

        if (insErr) throw new Error(`Failed to create demo preset: ${insErr.message}`);
        presetId = inserted!.id;
        presetsCreated++;
      }

      // Check if a demo run already exists for this preset (match by title).
      const runTitle = `${demo.name} — example run`;
      const { data: existingRun } = await supabase
        .from("runs")
        .select("id")
        .eq("user_id", userId)
        .eq("title", runTitle)
        .maybeSingle();

      if (existingRun) continue;

      // Create the run.
      const { data: run, error: runErr } = await supabase
        .from("runs")
        .insert({
          user_id: userId,
          title: runTitle,
          task: demo.prompt,
          case_name: demo.case_name,
          agent: DEMO_MODEL,
          status: "completed",
        })
        .select("id")
        .single();

      if (runErr || !run) throw new Error(`Failed to create demo run: ${runErr?.message}`);

      // Insert metadata, prompt log, recommendation, evaluation.
      await Promise.all([
        supabase.from("run_metadata").insert({
          run_id: run.id,
          provider_name: DEMO_PROVIDER,
          model_name: DEMO_MODEL,
          evaluation_mode: "simulation",
          temperature: 0.2,
          top_p: 1,
          max_tokens: 1024,
          random_seed: 42,
          notes: demo.notes,
          execution_timestamp: new Date().toISOString(),
        }),
        supabase.from("run_prompt_logs").insert({
          run_id: run.id,
          prompt_text: demo.prompt,
          response_text: demo.recommendation,
        }),
        (supabase as any).from("run_recommendations").insert({
          run_id: run.id,
          recommendation_text: demo.recommendation,
        }),
        (supabase as any).from("run_evaluations").insert({
          run_id: run.id,
          action_applied: "applied",
          baseline_violations: demo.baselineViolations,
          post_action_violations: demo.postViolations,
          violation_improvement: demo.baselineViolations - demo.postViolations,
          violations_found: demo.baselineViolations,
          feasibility: demo.feasibility,
          confidence: "high",
          grounding_quality: "good",
          engine_used: "dc-solver",
          notes: demo.notes,
        }),
      ]);

      runsCreated++;
    }

    return { presets_created: presetsCreated, runs_created: runsCreated };
  });
