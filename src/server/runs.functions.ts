import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";
import type { Run, ExperimentPreset, RunDetails, RunRecommendation, RunParseResult } from "@/types/grid-arena";

export const PARSER_VERSION = "v1";
export const EVALUATION_LOGIC_VERSION = "v1";

export const listRuns = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ runs: Run[] }> => {
    const { data, error } = await context.supabase
      .from("runs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Failed to fetch runs: ${error.message}`);
    return { runs: data ?? [] };
  });

export const getRun = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { runId: string }) => input)
  .handler(async ({ data, context }): Promise<{ run: Run }> => {
    const { data: run, error } = await context.supabase
      .from("runs")
      .select("*")
      .eq("id", data.runId)
      .single();

    if (error) throw new Error(`Failed to fetch run: ${error.message}`);
    return { run };
  });

export const getRunDetails = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { runId: string }) => input)
  .handler(async ({ data, context }): Promise<RunDetails> => {
    const { supabase } = context;
    const runId = data.runId;

    const { data: run, error: runError } = await supabase
      .from("runs")
      .select("*")
      .eq("id", runId)
      .single();

    if (runError || !run) throw new Error(`Run not found: ${runError?.message}`);

    const [metaRes, promptRes] = await Promise.all([
      supabase.from("run_metadata").select("*").eq("run_id", runId).maybeSingle(),
      supabase.from("run_prompt_logs").select("*").eq("run_id", runId).maybeSingle(),
    ]);

    const [recRes, parseRes, evalRes] = await Promise.all([
      (supabase as any).from("run_recommendations").select("*").eq("run_id", runId).maybeSingle(),
      (supabase as any).from("run_parse_results").select("*").eq("run_id", runId).maybeSingle(),
      (supabase as any).from("run_evaluations").select("*").eq("run_id", runId).maybeSingle(),
    ]);

    // Ground truth (optional)
    let groundTruth: { scenario: any; actions: any[] } | null = null;
    const gtId = (run as any).ground_truth_scenario_id as string | null | undefined;
    if (gtId) {
      const [gtScen, gtActs] = await Promise.all([
        (supabase as any).from("ground_truth_scenarios").select("*").eq("id", gtId).maybeSingle(),
        (supabase as any).from("ground_truth_actions").select("*").eq("scenario_id", gtId),
      ]);
      if (gtScen.data) groundTruth = { scenario: gtScen.data, actions: gtActs.data ?? [] };
    }

    return {
      run,
      metadata: metaRes.data ?? null,
      promptLog: promptRes.data ?? null,
      recommendation: (recRes.data as RunRecommendation) ?? null,
      parseResult: (parseRes.data as RunParseResult) ?? null,
      evaluation: (evalRes.data as import("@/types/grid-arena").RunEvaluation) ?? null,
      groundTruth: groundTruth as any,
    } as RunDetails;
  });

/** Build a metadata row from a preset (Phase 7 — full config snapshot). */
function metadataFromPreset(runId: string, preset: any) {
  return {
    run_id: runId,
    provider_name: preset.provider_name ?? null,
    provider_base_url: preset.provider_base_url ?? null,
    model_name: preset.model_name ?? null,
    model_version: preset.model_version ?? null,
    prompt_version: preset.prompt_version ?? null,
    dataset_version: preset.dataset_version ?? null,
    random_seed: preset.random_seed ?? null,
    notes: preset.notes ?? null,
    system_prompt: preset.system_prompt ?? null,
    temperature: preset.temperature ?? null,
    max_tokens: preset.max_tokens ?? null,
    top_p: preset.top_p ?? null,
    prompt_template_version: preset.prompt_template_version ?? null,
    parser_version: preset.parser_version ?? PARSER_VERSION,
    evaluation_logic_version: preset.evaluation_logic_version ?? EVALUATION_LOGIC_VERSION,
    evaluation_mode: (preset.evaluation_mode as string | null) ?? "rule_based",
  };
}

export const createRun = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: {
    title: string;
    task: string;
    agent: string;
    case_name: string;
    research_question?: string;
    preset_id?: string;
    evaluation_mode?: "rule_based" | "simulation" | "auto";
    ground_truth_scenario_id?: string | null;
  }) => input)
  .handler(async ({ data, context }): Promise<{ run: Run }> => {
    const { supabase, userId } = context;

    const { data: run, error: runError } = await (supabase as any)
      .from("runs")
      .insert({
        title: data.title,
        task: data.task,
        agent: data.agent,
        case_name: data.case_name,
        research_question: data.research_question || null,
        user_id: userId,
        ground_truth_scenario_id: data.ground_truth_scenario_id || null,
      })
      .select()
      .single();

    if (runError || !run) throw new Error(`Failed to create run: ${runError?.message}`);

    if (data.preset_id) {
      const { data: preset } = await supabase
        .from("experiment_presets")
        .select("*")
        .eq("id", data.preset_id)
        .single();

      if (preset) {
        const metaRow: any = metadataFromPreset(run.id, preset);
        if (data.evaluation_mode) metaRow.evaluation_mode = data.evaluation_mode;
        await (supabase as any).from("run_metadata").insert(metaRow);

        await supabase.from("run_prompt_logs").insert({
          run_id: run.id,
          prompt_text: (preset as any).system_prompt || preset.default_prompt_text || null,
        });
      }
    } else {
      await (supabase as any).from("run_metadata").insert({
        run_id: run.id,
        parser_version: PARSER_VERSION,
        evaluation_logic_version: EVALUATION_LOGIC_VERSION,
        evaluation_mode: data.evaluation_mode ?? "rule_based",
      });
      await supabase.from("run_prompt_logs").insert({ run_id: run.id });
    }

    await (supabase as any).from("run_recommendations").insert({ run_id: run.id });

    return { run };
  });

export const updateRunMetadata = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: {
    run_id: string;
    provider_name?: string | null;
    provider_base_url?: string | null;
    model_name?: string | null;
    model_version?: string | null;
    prompt_version?: string | null;
    dataset_version?: string | null;
    random_seed?: number | null;
    notes?: string | null;
    system_prompt?: string | null;
    temperature?: number | null;
    max_tokens?: number | null;
    top_p?: number | null;
    prompt_template_version?: string | null;
    parser_version?: string | null;
    evaluation_logic_version?: string | null;
    benchmark_case_version?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { run_id, ...fields } = data;

    const { data: existing } = await supabase
      .from("run_metadata")
      .select("id")
      .eq("run_id", run_id)
      .maybeSingle();

    if (existing) {
      const { error } = await (supabase as any).from("run_metadata").update(fields).eq("run_id", run_id);
      if (error) throw new Error(`Failed to update metadata: ${error.message}`);
    } else {
      const { error } = await (supabase as any).from("run_metadata").insert({ run_id, ...fields });
      if (error) throw new Error(`Failed to create metadata: ${error.message}`);
    }

    return { success: true };
  });

export const updatePromptLog = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: {
    run_id: string;
    prompt_text?: string | null;
    response_text?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { run_id, ...fields } = data;

    const { data: existing } = await supabase
      .from("run_prompt_logs")
      .select("id")
      .eq("run_id", run_id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from("run_prompt_logs").update(fields).eq("run_id", run_id);
      if (error) throw new Error(`Failed to update prompt log: ${error.message}`);
    } else {
      const { error } = await supabase.from("run_prompt_logs").insert({ run_id, ...fields });
      if (error) throw new Error(`Failed to create prompt log: ${error.message}`);
    }

    return { success: true };
  });

export const updateRecommendation = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: {
    run_id: string;
    recommendation_text?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { run_id, ...fields } = data;

    const { data: existing } = await (supabase as any)
      .from("run_recommendations")
      .select("id")
      .eq("run_id", run_id)
      .maybeSingle();

    if (existing) {
      const { error } = await (supabase as any).from("run_recommendations").update(fields).eq("run_id", run_id);
      if (error) throw new Error(`Failed to update recommendation: ${error.message}`);
    } else {
      const { error } = await (supabase as any).from("run_recommendations").insert({ run_id, ...fields });
      if (error) throw new Error(`Failed to create recommendation: ${error.message}`);
    }

    return { success: true };
  });

export const updateRunStatus = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { run_id: string; status: "queued" | "running" | "completed" }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("runs")
      .update({ status: data.status })
      .eq("id", data.run_id);

    if (error) throw new Error(`Failed to update status: ${error.message}`);
    return { success: true };
  });

export const listPresets = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ presets: ExperimentPreset[] }> => {
    const { data, error } = await context.supabase
      .from("experiment_presets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Failed to fetch presets: ${error.message}`);
    return { presets: data ?? [] };
  });

export const createPreset = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: {
    name: string;
    provider_name?: string | null;
    provider_base_url?: string | null;
    model_name?: string | null;
    model_version?: string | null;
    prompt_version?: string | null;
    dataset_version?: string | null;
    random_seed?: number | null;
    notes?: string | null;
    default_prompt_text?: string | null;
    system_prompt?: string | null;
    temperature?: number | null;
    max_tokens?: number | null;
    top_p?: number | null;
    prompt_template_version?: string | null;
    parser_version?: string | null;
    evaluation_logic_version?: string | null;
    evaluation_mode?: "rule_based" | "simulation" | "auto" | null;
  }) => input)
  .handler(async ({ data, context }): Promise<{ preset: ExperimentPreset }> => {
    const { supabase, userId } = context;

    const { data: preset, error } = await (supabase as any)
      .from("experiment_presets")
      .insert({ ...data, user_id: userId })
      .select()
      .single();

    if (error || !preset) throw new Error(`Failed to create preset: ${error?.message}`);
    return { preset };
  });

/** Phase 7 — clone run with same configuration snapshot and execute. */
export const rerunWithSameConfig = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { run_id: string }) => input)
  .handler(async ({ data, context }): Promise<{ run: Run }> => {
    const { supabase, userId } = context;

    const { data: source, error: sErr } = await supabase
      .from("runs").select("*").eq("id", data.run_id).single();
    if (sErr || !source) throw new Error("Source run not found");

    const [metaRes, promptRes] = await Promise.all([
      supabase.from("run_metadata").select("*").eq("run_id", source.id).maybeSingle(),
      supabase.from("run_prompt_logs").select("*").eq("run_id", source.id).maybeSingle(),
    ]);

    const { data: newRun, error: insErr } = await (supabase as any)
      .from("runs")
      .insert({
        title: `${source.title} (rerun)`,
        task: source.task,
        agent: source.agent,
        case_name: source.case_name,
        research_question: source.research_question,
        user_id: userId,
        parent_run_id: source.id,
        rerun_source: "manual",
      })
      .select()
      .single();

    if (insErr || !newRun) throw new Error(`Failed to clone run: ${insErr?.message}`);

    if (metaRes.data) {
      const { id, run_id, created_at, updated_at, execution_timestamp, ...metaFields } = metaRes.data as any;
      await (supabase as any).from("run_metadata").insert({ run_id: newRun.id, ...metaFields });
    } else {
      await (supabase as any).from("run_metadata").insert({
        run_id: newRun.id,
        parser_version: PARSER_VERSION,
        evaluation_logic_version: EVALUATION_LOGIC_VERSION,
      });
    }

    await supabase.from("run_prompt_logs").insert({
      run_id: newRun.id,
      prompt_text: promptRes.data?.prompt_text ?? null,
    });
    await (supabase as any).from("run_recommendations").insert({ run_id: newRun.id });

    return { run: newRun as Run };
  });
