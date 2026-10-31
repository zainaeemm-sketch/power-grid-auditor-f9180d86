import type { RunDetails } from "@/types/grid-arena";

const REQUIRED_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ["metadata", "model_name"],
  ["metadata", "model_version"],
  ["metadata", "system_prompt"],
  ["metadata", "temperature"],
  ["metadata", "top_p"],
  ["metadata", "random_seed"],
  ["metadata", "parser_version"],
  ["metadata", "evaluation_logic_version"],
  ["metadata", "benchmark_case_version"],
  ["metadata", "execution_timestamp"],
  ["promptLog", "prompt_text"],
  ["promptLog", "response_text"],
  ["evaluation", "engine_used"],
];

/** Export the records already fetched for this run; never rerun or rescore it. */
export function buildResearchBundle(details: RunDetails, exportedAt = new Date().toISOString()) {
  if (!details.run?.id) throw new Error("A stored run ID is required for research export.");
  const records = {
    run: details.run,
    metadata: details.metadata ?? null,
    promptLog: details.promptLog ?? null,
    recommendation: details.recommendation ?? null,
    parseResult: details.parseResult ?? null,
    evaluation: details.evaluation ?? null,
    groundTruth: details.groundTruth ?? null,
    judgment: details.judgment ?? null,
  };
  const missingSections = ["metadata", "promptLog", "recommendation", "parseResult", "evaluation"]
    .filter((name) => (records as Record<string, unknown>)[name] == null);
  const missingFields = REQUIRED_FIELDS.filter(([section, field]) => {
    const row = (records as Record<string, any>)[section];
    return row?.[field] == null || row[field] === "";
  }).map(([section, field]) => `${section}.${field}`);
  if (details.run.ground_truth_scenario_id && !records.groundTruth) {
    missingSections.push("groundTruth");
  }
  return {
    schema_version: "gridarena-research-export-v1",
    exported_at: exportedAt,
    scope: "Records returned by getRunDetails; excludes decision/tool traces and additional probe tables.",
    evidence_notes: [
      "Missing records may be unrecorded or unavailable; absence is not a zero score or a successful check.",
      "No historical objective, runtime commit, certified optimum, or new experimental outcome is inferred.",
      "Exporter schema version is not the version of the simulator or the historical run.",
    ],
    nonfinite_encoding: "Non-finite numbers use an object with __gridarena_nonfinite_number instead of being silently converted to null.",
    missing_sections: missingSections,
    missing_fields: missingFields,
    records,
  };
}

export function serializeResearchBundle(details: RunDetails, exportedAt?: string): string {
  return JSON.stringify(buildResearchBundle(details, exportedAt), (_key, value) => {
    if (typeof value === "number" && !Number.isFinite(value)) {
      return { __gridarena_nonfinite_number: String(value) };
    }
    return value;
  }, 2);
}

export function exportRunResearchJson(details: RunDetails): void {
  const content = serializeResearchBundle(details);
  const url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `run_${details.run.id}_research.json`;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    // Let the browser consume the download URL before releasing it.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
