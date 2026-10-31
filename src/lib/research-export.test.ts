import { describe, expect, it } from "vitest";
import type { RunDetails } from "@/types/grid-arena";
import { buildResearchBundle, serializeResearchBundle } from "./research-export";

function fixture(overrides: Record<string, unknown> = {}): RunDetails {
  return {
    run: { id: "original-run", case_name: "case14", status: "completed" },
    metadata: { model_name: "recorded-model", temperature: 0, random_seed: 0 },
    promptLog: { prompt_text: "Original prompt\nwith units", response_text: "set generator 0 to 0 MW" },
    recommendation: { recommendation_text: "set generator 0 to 0 MW" },
    parseResult: { target_index: 0, value: 0, enabled: false, action_type: "set_generator_p_mw" },
    evaluation: { optimality_gap: 0, feasibility: "unknown", engine_used: "rule_based" },
    groundTruth: null,
    judgment: null,
    ...overrides,
  } as unknown as RunDetails;
}

describe("historical-run research export", () => {
  it("preserves raw prompt, parsed zeros, false flags, and the recorded verdict", () => {
    const input = fixture();
    const out = JSON.parse(serializeResearchBundle(input, "2026-10-31T00:00:00.000Z"));
    expect(out.records.promptLog).toEqual(input.promptLog);
    expect(out.records.parseResult).toEqual(input.parseResult);
    expect(out.records.evaluation).toEqual(input.evaluation);
    expect(out.missing_fields).not.toContain("metadata.random_seed");
    expect(out.missing_fields).not.toContain("metadata.temperature");
  });

  it("marks missing sections instead of inventing successful measurements", () => {
    const out = buildResearchBundle(fixture({ metadata: null, evaluation: null, parseResult: null }));
    expect(out.records.evaluation).toBeNull();
    expect(out.missing_sections).toEqual(expect.arrayContaining(["metadata", "evaluation", "parseResult"]));
    expect(out.missing_fields).toContain("metadata.model_name");
    expect(out.missing_fields).toContain("evaluation.engine_used");
  });

  it("flags an unavailable referenced scenario", () => {
    const out = buildResearchBundle(fixture({ run: { id: "run-a", ground_truth_scenario_id: "scenario-a" } }));
    expect(out.missing_sections).toContain("groundTruth");
  });

  it("preserves non-finite deviations explicitly without changing their meaning to null", () => {
    const input = fixture({ evaluation: { deviation_from_reference: Infinity, optimality_gap: NaN } });
    const out = JSON.parse(serializeResearchBundle(input));
    expect(out.records.evaluation.deviation_from_reference).toEqual({ __gridarena_nonfinite_number: "Infinity" });
    expect(out.records.evaluation.optimality_gap).toEqual({ __gridarena_nonfinite_number: "NaN" });
    expect(input.evaluation?.deviation_from_reference).toBe(Infinity);
  });

  it("does not export unrelated top-level configuration or infer an objective", () => {
    const out = buildResearchBundle(fixture({ credentials: { api_key: "not-part-of-run-details" } }));
    expect(JSON.stringify(out)).not.toContain("not-part-of-run-details");
    expect(out).not.toHaveProperty("objective_id");
    expect(out).not.toHaveProperty("oracle_optimum");
  });

  it("requires an original stored identifier", () => {
    expect(() => buildResearchBundle(fixture({ run: {} }))).toThrow("stored run ID");
  });
});
