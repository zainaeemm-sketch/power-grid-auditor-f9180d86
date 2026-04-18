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

    const { data: metadatas } = await (supabase as any)
      .from("run_metadata")
      .select("*")
      .in("run_id", runIds);

    const evalMap = new Map<string, RunEvaluation>();
    (evaluations ?? []).forEach((e: RunEvaluation) => evalMap.set(e.run_id, e));
    const metaMap = new Map<string, any>();
    (metadatas ?? []).forEach((m: any) => metaMap.set(m.run_id, m));

    const batchRuns: BatchRunWithEvaluation[] = (runs ?? []).map((run) => ({
      run,
      evaluation: evalMap.get(run.id) ?? null,
      metadata: metaMap.get(run.id) ?? null,
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

    const { data: batch, error: batchErr } = await (supabase as any)
      .from("batches")
      .insert({
        name: data.name,
        task: data.task,
        research_question: data.research_question || null,
        user_id: userId,
        shared_config: presetData ? {
          provider_name: presetData.provider_name ?? null,
          model_name: presetData.model_name ?? null,
          model_version: presetData.model_version ?? null,
          system_prompt: presetData.system_prompt ?? null,
          temperature: presetData.temperature ?? null,
          max_tokens: presetData.max_tokens ?? null,
          top_p: presetData.top_p ?? null,
          random_seed: presetData.random_seed ?? null,
          prompt_template_version: presetData.prompt_template_version ?? null,
          prompt_version: presetData.prompt_version ?? null,
          dataset_version: presetData.dataset_version ?? null,
          parser_version: presetData.parser_version ?? "v1",
          evaluation_logic_version: presetData.evaluation_logic_version ?? "v1",
          preset_id: data.preset_id,
        } : null,
      })
      .select()
      .single();

    if (batchErr || !batch) throw new Error(`Failed to create batch: ${batchErr?.message}`);

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

        // Link run to batch with denormalized fields
        await (supabase as any)
          .from("batch_run_links")
          .insert({
            batch_id: batch.id,
            run_id: run.id,
            agent,
            case_name: caseName,
          });
        // Create metadata and prompt log (Phase 7 — full snapshot)
        if (presetData) {
          await (supabase as any).from("run_metadata").insert({
            run_id: run.id,
            provider_name: presetData.provider_name ?? null,
            provider_base_url: presetData.provider_base_url ?? null,
            model_name: presetData.model_name ?? null,
            model_version: presetData.model_version ?? null,
            prompt_version: presetData.prompt_version ?? null,
            dataset_version: presetData.dataset_version ?? null,
            random_seed: presetData.random_seed ?? null,
            notes: presetData.notes ?? null,
            system_prompt: presetData.system_prompt ?? null,
            temperature: presetData.temperature ?? null,
            max_tokens: presetData.max_tokens ?? null,
            top_p: presetData.top_p ?? null,
            prompt_template_version: presetData.prompt_template_version ?? null,
            parser_version: presetData.parser_version ?? "v1",
            evaluation_logic_version: presetData.evaluation_logic_version ?? "v1",
          });
          await supabase.from("run_prompt_logs").insert({
            run_id: run.id,
            prompt_text: presetData.system_prompt || presetData.default_prompt_text || null,
          });
        } else {
          await (supabase as any).from("run_metadata").insert({
            run_id: run.id,
            parser_version: "v1",
            evaluation_logic_version: "v1",
          });
          await supabase.from("run_prompt_logs").insert({ run_id: run.id });
        }

        // Create empty recommendation
        await (supabase as any).from("run_recommendations").insert({ run_id: run.id });
      }
    }

    return { batch: batch as Batch };
  });

export const deleteBatch = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { batch_id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await sb.from("batch_run_links").delete().eq("batch_id", data.batch_id);
    const { error } = await sb.from("batches").delete().eq("id", data.batch_id);
    if (error) throw new Error(`Failed to delete batch: ${error.message}`);
    return { success: true };
  });

export const updateBatch = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: { batch_id: string; name?: string; research_question?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { batch_id, ...fields } = data;
    const update: Record<string, unknown> = {};
    if (typeof fields.name === "string") update.name = fields.name;
    if (fields.research_question !== undefined) update.research_question = fields.research_question;
    if (Object.keys(update).length === 0) return { success: true };
    const { error } = await (context.supabase as any).from("batches").update(update).eq("id", batch_id);
    if (error) throw new Error(`Failed to update batch: ${error.message}`);
    return { success: true };
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

    // Phase 11 — Enqueue jobs instead of executing synchronously.
    // Worker drain (client polling + cron) processes them in background.
    const { userId } = context;
    let enqueued = 0;
    for (const runId of pendingRunIds) {
      const { error: jobErr } = await (supabase as any).from("job_queue").insert({
        user_id: userId,
        job_type: "run_execution",
        payload: { run_id: runId },
        priority: 0,
        max_attempts: 3,
      });
      if (!jobErr) enqueued++;
    }

    return { success: true, enqueued, total: runIds.length, results: [] as Array<{ run_id: string; success: boolean; error?: string }> };
  });
