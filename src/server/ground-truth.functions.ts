import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";
import type { GroundTruthScenario, GroundTruthAction, GroundTruthScenarioWithActions, GroundTruthScenarioListItem } from "@/types/grid-arena";

export const listScenarios = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ scenarios: GroundTruthScenarioListItem[] }> => {
    const sb = context.supabase as any;
    const { data: scenarios, error } = await sb
      .from("ground_truth_scenarios")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Failed to list scenarios: ${error.message}`);

    const ids = (scenarios ?? []).map((s: any) => s.id);
    let counts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: actions } = await sb
        .from("ground_truth_actions")
        .select("scenario_id")
        .in("scenario_id", ids);
      for (const a of actions ?? []) {
        counts[a.scenario_id] = (counts[a.scenario_id] ?? 0) + 1;
      }
    }
    return {
      scenarios: (scenarios ?? []).map((s: any) => ({
        ...s,
        action_count: counts[s.id] ?? 0,
      })),
    };
  });

export const getScenario = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }): Promise<GroundTruthScenarioWithActions> => {
    const sb = context.supabase as any;
    const { data: scenario, error } = await sb
      .from("ground_truth_scenarios")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !scenario) throw new Error(`Scenario not found: ${error?.message}`);

    const { data: actions } = await sb
      .from("ground_truth_actions")
      .select("*")
      .eq("scenario_id", scenario.id)
      .order("created_at", { ascending: true });

    return { scenario: scenario as GroundTruthScenario, actions: (actions ?? []) as GroundTruthAction[] };
  });

export const getScenarioForRun = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { scenario_id: string }) => input)
  .handler(async ({ data, context }): Promise<GroundTruthScenarioWithActions | null> => {
    const sb = context.supabase as any;
    const { data: scenario } = await sb
      .from("ground_truth_scenarios")
      .select("*")
      .eq("id", data.scenario_id)
      .maybeSingle();
    if (!scenario) return null;
    const { data: actions } = await sb
      .from("ground_truth_actions")
      .select("*")
      .eq("scenario_id", scenario.id)
      .order("created_at", { ascending: true });
    return { scenario: scenario as GroundTruthScenario, actions: (actions ?? []) as GroundTruthAction[] };
  });

interface CreateActionInput {
  action_type: string;
  target_index?: number | null;
  value?: number | null;
  expected_feasibility: boolean;
  expected_violations: number;
  expected_violation_improvement: number;
  notes?: string | null;
}

export const createScenario = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: {
    scenario_id: string;
    case_name: string;
    scenario_description?: string | null;
    difficulty_level: string;
    actions: CreateActionInput[];
  }) => input)
  .handler(async ({ data, context }): Promise<{ scenario: GroundTruthScenario }> => {
    const sb = context.supabase as any;
    const { userId } = context;
    const { data: scenario, error } = await sb
      .from("ground_truth_scenarios")
      .insert({
        scenario_id: data.scenario_id,
        case_name: data.case_name,
        scenario_description: data.scenario_description ?? null,
        difficulty_level: data.difficulty_level,
        user_id: userId,
      })
      .select()
      .single();
    if (error || !scenario) throw new Error(`Failed to create scenario: ${error?.message}`);

    if (data.actions.length > 0) {
      const rows = data.actions.map((a) => ({
        scenario_id: scenario.id,
        action_type: a.action_type,
        target_index: a.target_index ?? null,
        value: a.value ?? null,
        expected_feasibility: a.expected_feasibility,
        expected_violations: a.expected_violations,
        expected_violation_improvement: a.expected_violation_improvement,
        notes: a.notes ?? null,
      }));
      const { error: actErr } = await sb.from("ground_truth_actions").insert(rows);
      if (actErr) throw new Error(`Failed to create actions: ${actErr.message}`);
    }
    return { scenario: scenario as GroundTruthScenario };
  });

export const deleteScenario = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("ground_truth_scenarios").delete().eq("id", data.id);
    if (error) throw new Error(`Failed to delete scenario: ${error.message}`);
    return { success: true };
  });

export const seedExampleScenarios = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ inserted: number }> => {
    const sb = context.supabase as any;
    const { userId } = context;

    const examples = [
      {
        scenario_id: "IEEE14_OVERLOAD_01",
        case_name: "ieee14",
        scenario_description: "Overloaded transmission line",
        difficulty_level: "easy",
        actions: [{
          action_type: "scale_all_loads",
          target_index: null,
          value: 0.95,
          expected_feasibility: true,
          expected_violations: 0,
          expected_violation_improvement: 3,
          notes: "Reduce total load 5% to relieve overloaded line.",
        }],
      },
      {
        scenario_id: "IEEE39_LINE_OUTAGE",
        case_name: "ieee39",
        scenario_description: "Line contingency",
        difficulty_level: "medium",
        actions: [{
          action_type: "line_outage",
          target_index: 4,
          value: null,
          expected_feasibility: true,
          expected_violations: 1,
          expected_violation_improvement: 2,
          notes: "Trip line 4 and redispatch.",
        }],
      },
    ];

    let inserted = 0;
    for (const ex of examples) {
      const { data: existing } = await sb
        .from("ground_truth_scenarios")
        .select("id")
        .eq("user_id", userId)
        .eq("scenario_id", ex.scenario_id)
        .maybeSingle();
      if (existing) continue;

      const { data: scenario, error } = await sb
        .from("ground_truth_scenarios")
        .insert({
          scenario_id: ex.scenario_id,
          case_name: ex.case_name,
          scenario_description: ex.scenario_description,
          difficulty_level: ex.difficulty_level,
          user_id: userId,
        })
        .select()
        .single();
      if (error || !scenario) continue;

      const rows = ex.actions.map((a) => ({ scenario_id: scenario.id, ...a }));
      await sb.from("ground_truth_actions").insert(rows);
      inserted++;
    }
    return { inserted };
  });
