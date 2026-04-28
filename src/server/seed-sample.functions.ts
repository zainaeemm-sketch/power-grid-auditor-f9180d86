import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";

const SAMPLE_BATCH_NAME = "[Sample] GridArena demo batch";

export interface SeedSampleResult {
  ok: boolean;
  created: boolean;
  batchId: string | null;
  runIds: string[];
  message: string;
}

/**
 * Seed a sample batch + a few completed runs with full evaluations so the
 * dashboard charts always have non-empty data on a fresh account.
 *
 * Idempotent: if a batch with SAMPLE_BATCH_NAME already exists for the user,
 * this is a no-op and returns created=false.
 */
export const seedSampleData = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }): Promise<SeedSampleResult> => {
    const { supabase, userId } = context;

    // Idempotency check
    const { data: existing, error: existingErr } = await supabase
      .from("batches")
      .select("id")
      .eq("user_id", userId)
      .eq("name", SAMPLE_BATCH_NAME)
      .maybeSingle();
    if (existingErr) {
      return { ok: false, created: false, batchId: null, runIds: [], message: existingErr.message };
    }
    if (existing) {
      return {
        ok: true,
        created: false,
        batchId: existing.id,
        runIds: [],
        message: "Sample data already present.",
      };
    }

    // Create batch
    const { data: batch, error: batchErr } = await supabase
      .from("batches")
      .insert({
        user_id: userId,
        name: SAMPLE_BATCH_NAME,
        task: "Resolve overloaded branches in case14 / case30 with a single corrective action.",
        research_question: "Which agent best resolves single-action overloads across small IEEE cases?",
        status: "completed",
      })
      .select("id")
      .single();
    if (batchErr || !batch) {
      return { ok: false, created: false, batchId: null, runIds: [], message: batchErr?.message ?? "Failed to create batch" };
    }

    // Sample runs definition — varied agents/cases so all charts populate.
    const samples: Array<{
      agent: string;
      case_name: string;
      title: string;
      feasibility: "feasible" | "infeasible";
      baseline: number;
      post: number;
      confidence: "low" | "medium" | "high";
      grounding: "none" | "weak" | "strong";
      action: string;
      recommendation: string;
    }> = [
      {
        agent: "GPT-4o (baseline)",
        case_name: "case14",
        title: "Sample · case14 redispatch",
        feasibility: "feasible",
        baseline: 4,
        post: 0,
        confidence: "high",
        grounding: "strong",
        action: "set_generator_p_mw(gen=1, value=85)",
        recommendation: "Reduce generator 1 output to 85 MW to relieve branch 6→8.",
      },
      {
        agent: "GPT-4o (baseline)",
        case_name: "case30",
        title: "Sample · case30 load shed",
        feasibility: "feasible",
        baseline: 6,
        post: 1,
        confidence: "medium",
        grounding: "strong",
        action: "scale_all_loads(0.92)",
        recommendation: "Apply a 8% uniform load shed to clear the overload.",
      },
      {
        agent: "Reasoning agent",
        case_name: "case14",
        title: "Sample · case14 line outage recovery",
        feasibility: "feasible",
        baseline: 5,
        post: 0,
        confidence: "high",
        grounding: "strong",
        action: "set_generator_p_mw(gen=0, value=120)",
        recommendation: "Increase generator 0 to 120 MW to backstop the lost line.",
      },
      {
        agent: "Reasoning agent",
        case_name: "case30",
        title: "Sample · case30 redispatch",
        feasibility: "feasible",
        baseline: 7,
        post: 2,
        confidence: "medium",
        grounding: "weak",
        action: "set_generator_p_mw(gen=2, value=40)",
        recommendation: "Trim generator 2 to 40 MW to relieve N-1 stress.",
      },
      {
        agent: "Naive heuristic",
        case_name: "case14",
        title: "Sample · case14 naive shed",
        feasibility: "infeasible",
        baseline: 5,
        post: 4,
        confidence: "low",
        grounding: "none",
        action: "scale_all_loads(0.98)",
        recommendation: "Apply a small uniform load shed (insufficient).",
      },
    ];

    const runIds: string[] = [];

    for (const s of samples) {
      const { data: run, error: runErr } = await supabase
        .from("runs")
        .insert({
          user_id: userId,
          case_name: s.case_name,
          agent: s.agent,
          task: "Resolve violations with a single corrective action.",
          title: s.title,
          status: "completed",
        })
        .select("id")
        .single();
      if (runErr || !run) continue;
      runIds.push(run.id);

      await supabase.from("batch_run_links").insert({
        batch_id: batch.id,
        run_id: run.id,
        agent: s.agent,
        case_name: s.case_name,
        recommendation_text: s.recommendation,
      });

      await supabase.from("run_evaluations").insert({
        run_id: run.id,
        feasibility: s.feasibility,
        violations_found: s.post,
        baseline_violations: s.baseline,
        post_action_violations: s.post,
        violation_improvement: s.baseline - s.post,
        confidence: s.confidence,
        grounding_quality: s.grounding,
        action_applied: s.action,
        engine_used: "pandapower",
        notes: "Seeded sample evaluation for dashboard validation.",
      });

      await supabase.from("run_recommendations").insert({
        run_id: run.id,
        recommendation_text: s.recommendation,
      });

      await supabase.from("run_metadata").insert({
        run_id: run.id,
        evaluation_mode: "simulation",
        model_name: "sample-model",
        notes: "Seeded sample run.",
      });
    }

    return {
      ok: true,
      created: true,
      batchId: batch.id,
      runIds,
      message: `Seeded sample batch with ${runIds.length} runs.`,
    };
  });
