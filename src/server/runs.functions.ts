import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listRuns = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("runs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch runs: ${error.message}`);
  }
  return { runs: data ?? [] };
});

export const getRun = createServerFn({ method: "GET" })
  .inputValidator((input: { runId: string }) => input)
  .handler(async ({ data }) => {
    const { data: run, error } = await supabaseAdmin
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
  .inputValidator((input: {
    title: string;
    task: string;
    agent: string;
    case_name: string;
    research_question?: string;
    preset_id?: string;
  }) => input)
  .handler(async ({ data }) => {
    // Create the run
    const { data: run, error: runError } = await supabaseAdmin
      .from("runs")
      .insert({
        title: data.title,
        task: data.task,
        agent: data.agent,
        case_name: data.case_name,
        research_question: data.research_question || null,
      })
      .select()
      .single();

    if (runError || !run) {
      throw new Error(`Failed to create run: ${runError?.message}`);
    }

    // If a preset was selected, copy its metadata and prompt
    if (data.preset_id) {
      const { data: preset } = await supabaseAdmin
        .from("experiment_presets")
        .select("*")
        .eq("id", data.preset_id)
        .single();

      if (preset) {
        await supabaseAdmin.from("run_metadata").insert({
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
          await supabaseAdmin.from("run_prompt_logs").insert({
            run_id: run.id,
            prompt_text: preset.default_prompt_text,
          });
        }
      }
    } else {
      // Create empty metadata and prompt log entries
      await supabaseAdmin.from("run_metadata").insert({ run_id: run.id });
      await supabaseAdmin.from("run_prompt_logs").insert({ run_id: run.id });
    }

    return { run };
  });

export const listPresets = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("experiment_presets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch presets: ${error.message}`);
  }
  return { presets: data ?? [] };
});
