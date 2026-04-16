import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";
import type { Run, ExperimentPreset, RunDetails } from "@/types/grid-arena";

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

    const [metaRes, promptRes, recRes, parseRes] = await Promise.all([
      supabase.from("run_metadata").select("*").eq("run_id", runId).maybeSingle(),
      supabase.from("run_prompt_logs").select("*").eq("run_id", runId).maybeSingle(),
      supabase.from("run_recommendations").select("*").eq("run_id", runId).maybeSingle(),
      supabase.from("run_parse_results").select("*").eq("run_id", runId).maybeSingle(),
    ]);

    return {
      run,
      metadata: metaRes.data ?? null,
      promptLog: promptRes.data ?? null,
      recommendation: recRes.data ?? null,
      parseResult: parseRes.data ?? null,
    };
  });

export const createRun = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: {
    title: string;
    task: string;
    agent: string;
    case_name: string;
    research_question?: string;
    preset_id?: string;
  }) => input)
  .handler(async ({ data, context }): Promise<{ run: Run }> => {
    const { supabase, userId } = context;

    const { data: run, error: runError } = await supabase
      .from("runs")
      .insert({
        title: data.title,
        task: data.task,
        agent: data.agent,
        case_name: data.case_name,
        research_question: data.research_question || null,
        user_id: userId,
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
        await supabase.from("run_metadata").insert({
          run_id: run.id,
          provider_name: preset.provider_name,
          provider_base_url: preset.provider_base_url,
          model_name: preset.model_name,
          model_version: preset.model_version,
          prompt_version: preset.prompt_version,
          dataset_version: preset.dataset_version,
          random_seed: preset.random_seed,
          notes: preset.notes,
        });

        if (preset.default_prompt_text) {
          await supabase.from("run_prompt_logs").insert({
            run_id: run.id,
            prompt_text: preset.default_prompt_text,
          });
        } else {
          await supabase.from("run_prompt_logs").insert({ run_id: run.id });
        }
      }
    } else {
      await supabase.from("run_metadata").insert({ run_id: run.id });
      await supabase.from("run_prompt_logs").insert({ run_id: run.id });
    }

    // Always create an empty recommendation row
    await supabase.from("run_recommendations").insert({ run_id: run.id });

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
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { run_id, ...fields } = data;

    // Upsert: try update first, insert if not found
    const { data: existing } = await supabase
      .from("run_metadata")
      .select("id")
      .eq("run_id", run_id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("run_metadata")
        .update(fields)
        .eq("run_id", run_id);
      if (error) throw new Error(`Failed to update metadata: ${error.message}`);
    } else {
      const { error } = await supabase
        .from("run_metadata")
        .insert({ run_id, ...fields });
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
      const { error } = await supabase
        .from("run_prompt_logs")
        .update(fields)
        .eq("run_id", run_id);
      if (error) throw new Error(`Failed to update prompt log: ${error.message}`);
    } else {
      const { error } = await supabase
        .from("run_prompt_logs")
        .insert({ run_id, ...fields });
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

    const { data: existing } = await supabase
      .from("run_recommendations")
      .select("id")
      .eq("run_id", run_id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("run_recommendations")
        .update(fields)
        .eq("run_id", run_id);
      if (error) throw new Error(`Failed to update recommendation: ${error.message}`);
    } else {
      const { error } = await supabase
        .from("run_recommendations")
        .insert({ run_id, ...fields });
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
  }) => input)
  .handler(async ({ data, context }): Promise<{ preset: ExperimentPreset }> => {
    const { supabase, userId } = context;

    const { data: preset, error } = await supabase
      .from("experiment_presets")
      .insert({ ...data, user_id: userId })
      .select()
      .single();

    if (error || !preset) throw new Error(`Failed to create preset: ${error?.message}`);
    return { preset };
  });
