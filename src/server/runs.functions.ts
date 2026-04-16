import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Run, ExperimentPreset } from "@/types/grid-arena";

export const listRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ runs: Run[] }> => {
    const { data, error } = await context.supabase
      .from("runs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch runs: ${error.message}`);
    }
    return { runs: data ?? [] };
  });

export const getRun = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { runId: string }) => input)
  .handler(async ({ data, context }): Promise<{ run: Run }> => {
    const { data: run, error } = await context.supabase
      .from("runs")
      .select("*")
      .eq("id", data.runId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch run: ${error.message}`);
    }
    return { run };
  });

export const createRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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

    if (runError || !run) {
      throw new Error(`Failed to create run: ${runError?.message}`);
    }

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
        }
      }
    } else {
      await supabase.from("run_metadata").insert({ run_id: run.id });
      await supabase.from("run_prompt_logs").insert({ run_id: run.id });
    }

    return { run };
  });

export const listPresets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ presets: ExperimentPreset[] }> => {
    const { data, error } = await context.supabase
      .from("experiment_presets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch presets: ${error.message}`);
    }
    return { presets: data ?? [] };
  });
