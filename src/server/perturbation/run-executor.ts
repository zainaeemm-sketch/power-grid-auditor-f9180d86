import { getDefaultPerturbationSet } from "./defaults";
import { executePerturbation } from "./execute";
import type { StructuredAction } from "../simulation/types";

/**
 * Run the default perturbation set for a single run, persisting tests + results.
 * Shared by the user-scoped server fn and the background job worker.
 * `supabase` must be a client with permission to insert into perturbation_tests/results
 * for this run (either user-scoped or admin).
 */
export async function runDefaultPerturbationsForRun(
  supabase: any,
  runId: string,
): Promise<{ tests: number }> {
  const { data: run, error: runErr } = await supabase
    .from("runs")
    .select("id, case_name")
    .eq("id", runId)
    .single();
  if (runErr || !run) throw new Error(`Run not found: ${runErr?.message ?? "unknown"}`);

  const { data: parse } = await supabase
    .from("run_parse_results")
    .select("*")
    .eq("run_id", runId)
    .maybeSingle();

  const action: StructuredAction = {
    action_type: parse?.action_type ?? null,
    target_index: parse?.target_index ?? null,
    value: parse?.value ?? null,
    enabled: parse?.enabled ?? true,
  };

  const specs = getDefaultPerturbationSet();
  let count = 0;
  for (const spec of specs) {
    const { data: test, error: tErr } = await supabase
      .from("perturbation_tests")
      .insert({
        run_id: run.id,
        perturbation_type: spec.perturbation_type,
        parameter_name: spec.parameter_name,
        parameter_value: spec.parameter_value,
        description: spec.description,
      })
      .select()
      .single();
    if (tErr || !test) continue;
    const outcome = await executePerturbation(run.case_name, action, spec);
    await supabase
      .from("perturbation_results")
      .insert({ perturbation_test_id: test.id, ...outcome });
    count += 1;
  }
  return { tests: count };
}
