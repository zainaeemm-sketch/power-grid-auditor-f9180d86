import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";
import type { Batch, BatchDetails, BatchRunWithEvaluation, RunEvaluation } from "@/types/grid-arena";

export const listBatches = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ batches: Array<Batch & { run_count: number }> }> => {
    const { supabase } = context;

    const { data: batches, error } = await (supabase as any)
      .from("batches")
      .select("*, batch_run_links(count)")
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Failed to fetch batches: ${error.message}`);

    const result = (batches ?? []).map((b: any) => ({
      ...b,
      run_count: b.batch_run_links?.[0]?.count ?? 0,
      batch_run_links: undefined,
    }));

    return { batches: result };
  });

export const getBatchDetails = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { batchId: string }) => input)
  .handler(async ({ data, context }): Promise<BatchDetails> => {
    const { supabase } = context;
    const batchId = data.batchId;

    const { data: batch, error: batchErr } = await (supabase as any)
      .from("batches")
      .select("*")
      .eq("id", batchId)
      .single();

    if (batchErr || !batch) throw new Error(`Batch not found: ${batchErr?.message}`);

    const { data: links } = await (supabase as any)
      .from("batch_run_links")
      .select("run_id")
      .eq("batch_id", batchId);

    const runIds: string[] = (links ?? []).map((l: any) => l.run_id);

    if (runIds.length === 0) {
      return { batch: batch as Batch, runs: [] };
    }

    const { data: runs } = await supabase
      .from("runs")
      .select("*")
      .in("id", runIds)
      .order("created_at", { ascending: true });

    const { data: evaluations } = await (supabase as any)
      .from("run_evaluations")
      .select("*")
      .in("run_id", runIds);

    const evalMap = new Map<string, RunEvaluation>();
    (evaluations ?? []).forEach((e: RunEvaluation) => evalMap.set(e.run_id, e));

    const batchRuns: BatchRunWithEvaluation[] = (runs ?? []).map((run) => ({
      run,
      evaluation: evalMap.get(run.id) ?? null,
    }));

    return { batch: batch as Batch, runs: batchRuns };
  });

export const createBatch = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: {
    name: string;
    task: string;
    research_question?: string;
    agents: string[];
    cases: string[];
    preset_id?: string;
  }) => input)
  .handler(async ({ data, context }): Promise<{ batch: Batch }> => {
    const { supabase, userId } = context;

    const { data: batch, error: batchErr } = await (supabase as any)
      .from("batches")
      .insert({
        name: data.name,
        task: data.task,
        research_question: data.research_question || null,
        user_id: userId,
      })
      .select()
      .single();

    if (batchErr || !batch) throw new Error(`Failed to create batch: ${batchErr?.message}`);

    // Load preset if provided
    let presetData: any = null;
    if (data.preset_id) {
      const { data: preset } = await supabase
        .from("experiment_presets")
        .select("*")
        .eq("id", data.preset_id)
        .single();
      presetData = preset;
    }

    // Create runs for each agent x case combination
    for (const agent of data.agents) {
      for (const caseName of data.cases) {
        const title = `${data.name} — ${agent} / ${caseName}`;

        const { data: run, error: runErr } = await supabase
          .from("runs")
          .insert({
            title,
            task: data.task,
            agent,
            case_name: caseName,
            research_question: data.research_question || null,
            user_id: userId,
          })
          .select()
          .single();

        if (runErr || !run) continue;

        // Link run to batch
        await (supabase as any)
          .from("batch_run_links")
          .insert({ batch_id: batch.id, run_id: run.id });

        // Create metadata and prompt log
        if (presetData) {
          await supabase.from("run_metadata").insert({
            run_id: run.id,
            provider_name: presetData.provider_name,
            provider_base_url: presetData.provider_base_url,
            model_name: presetData.model_name,
            model_version: presetData.model_version,
            prompt_version: presetData.prompt_version,
            dataset_version: presetData.dataset_version,
            random_seed: presetData.random_seed,
            notes: presetData.notes,
          });
          await supabase.from("run_prompt_logs").insert({
            run_id: run.id,
            prompt_text: presetData.default_prompt_text || null,
          });
        } else {
          await supabase.from("run_metadata").insert({ run_id: run.id });
          await supabase.from("run_prompt_logs").insert({ run_id: run.id });
        }

        // Create empty recommendation
        await (supabase as any).from("run_recommendations").insert({ run_id: run.id });
      }
    }

    return { batch: batch as Batch };
  });

export const executeBatchRuns = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { batch_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const batchId = data.batch_id;

    // Update batch status to running
    await (supabase as any).from("batches").update({ status: "running" }).eq("id", batchId);

    // Get linked run IDs
    const { data: links } = await (supabase as any)
      .from("batch_run_links")
      .select("run_id")
      .eq("batch_id", batchId);

    const runIds: string[] = (links ?? []).map((l: any) => l.run_id);

    // Get runs that aren't completed
    const { data: runs } = await supabase
      .from("runs")
      .select("id, status")
      .in("id", runIds)
      .neq("status", "completed");

    const pendingRunIds = (runs ?? []).map((r) => r.id);
    const results: Array<{ run_id: string; success: boolean; error?: string }> = [];

    // Execute sequentially
    const { executeRunLlm } = await import("./llm.functions");

    for (const runId of pendingRunIds) {
      try {
        const res = await executeRunLlm({ data: { run_id: runId } });
        results.push({ run_id: runId, success: res.success });
        if (!res.success) {
          results[results.length - 1].error = res.error;
        }
      } catch (err: any) {
        results.push({ run_id: runId, success: false, error: err.message });
      }
    }

    // Update batch status
    await (supabase as any).from("batches").update({ status: "completed" }).eq("id", batchId);

    return { success: true, results, total: runIds.length, executed: pendingRunIds.length };
  });
