import { parseRecommendationText } from "@/server/llm.functions";
import { applyParsedAction, computeEvaluation } from "@/server/evaluation.functions";

export const SYSTEM_VERSION = "1.0.0";
export const PARSER_VERSION = "v1";
export const EVALUATION_LOGIC_VERSION = "v1";

export interface ParserCase {
  name: string;
  input: string;
  expected: { action_type: string; target_index: number | null; value: number | null; enabled: boolean };
}

export interface EvaluationCase {
  name: string;
  parseResult: {
    source_text: string;
    parser_notes: string;
    action_type: string;
    target_index: number | null;
    value: number | null;
    enabled: boolean;
  };
  expected: { feasibility: string; violation_improvement: number; confidence: string };
}

export const PARSER_CASES: ParserCase[] = [
  {
    name: "Reduce all loads by 20%",
    input: "Reduce all loads by 20%.",
    expected: { action_type: "scale_all_loads", target_index: null, value: 0.8, enabled: true },
  },
  {
    name: "Scale all loads by factor 0.9",
    input: "Scale all loads by 0.9",
    expected: { action_type: "scale_all_loads", target_index: null, value: 0.9, enabled: true },
  },
  {
    name: "Set generator dispatch",
    input: "Set generator 3 to 150 MW",
    expected: { action_type: "set_generator_p_mw", target_index: 3, value: 150, enabled: true },
  },
  {
    name: "Line outage",
    input: "Take line 7 out of service via line outage 7",
    expected: { action_type: "line_outage", target_index: 7, value: null, enabled: true },
  },
  {
    name: "Unparseable recommendation",
    input: "Please consider grid reliability over the long term.",
    expected: { action_type: "none", target_index: null, value: null, enabled: false },
  },
];

export const EVALUATION_CASES: EvaluationCase[] = [
  {
    name: "Successful load reduction → improvement",
    parseResult: {
      source_text: "Reduce all loads by 20%.",
      parser_notes: "",
      action_type: "scale_all_loads",
      target_index: null,
      value: 0.8,
      enabled: true,
    },
    expected: { feasibility: "feasible", violation_improvement: 2, confidence: "high" },
  },
  {
    name: "Load increase → degradation",
    parseResult: {
      source_text: "Scale all loads by 1.2",
      parser_notes: "",
      action_type: "scale_all_loads",
      target_index: null,
      value: 1.2,
      enabled: true,
    },
    expected: { feasibility: "feasible", violation_improvement: -1, confidence: "high" },
  },
  {
    name: "Line outage → degradation",
    parseResult: {
      source_text: "Take line 7 out of service",
      parser_notes: "",
      action_type: "line_outage",
      target_index: 7,
      value: null,
      enabled: true,
    },
    expected: { feasibility: "feasible", violation_improvement: -3, confidence: "high" },
  },
  {
    name: "No action → not applicable",
    parseResult: {
      source_text: "Vague text",
      parser_notes: "",
      action_type: "none",
      target_index: null,
      value: null,
      enabled: false,
    },
    expected: { feasibility: "not_applicable", violation_improvement: 0, confidence: "low" },
  },
];

export interface TestResult {
  test_name: string;
  test_type: "parser" | "evaluation" | "reproducibility" | "batch_stability";
  expected_output: any;
  actual_output: any;
  status: "passed" | "failed" | "error";
  failure_reason: string | null;
  debug_hint: string | null;
  execution_time_ms: number;
}

function runParserCase(c: ParserCase): TestResult {
  const start = performance.now();
  try {
    const actual = parseRecommendationText(c.input);
    const subset = {
      action_type: actual.action_type,
      target_index: actual.target_index,
      value: actual.value,
      enabled: actual.enabled,
    };
    const passed =
      subset.action_type === c.expected.action_type &&
      subset.target_index === c.expected.target_index &&
      Math.abs((subset.value ?? 0) - (c.expected.value ?? 0)) < 1e-6 &&
      (subset.value === null) === (c.expected.value === null) &&
      subset.enabled === c.expected.enabled;
    return {
      test_name: c.name,
      test_type: "parser",
      expected_output: c.expected,
      actual_output: subset,
      status: passed ? "passed" : "failed",
      failure_reason: passed ? null : "Parser output did not match expected structured action.",
      debug_hint: passed ? null : "Inspect regex rules in parseRecommendationText for this phrasing.",
      execution_time_ms: Math.round(performance.now() - start),
    };
  } catch (e: any) {
    return {
      test_name: c.name,
      test_type: "parser",
      expected_output: c.expected,
      actual_output: null,
      status: "error",
      failure_reason: e?.message ?? "Unknown error",
      debug_hint: "Parser threw — check input handling for null/edge cases.",
      execution_time_ms: Math.round(performance.now() - start),
    };
  }
}

function runEvaluationCase(c: EvaluationCase): TestResult {
  const start = performance.now();
  try {
    const full = { ...c.parseResult, id: "", run_id: "", created_at: "", updated_at: "" } as any;
    const action = applyParsedAction(full);
    const evalFields = computeEvaluation(full, action);
    const subset = {
      feasibility: evalFields.feasibility,
      violation_improvement: evalFields.violation_improvement,
      confidence: evalFields.confidence,
    };
    const passed =
      subset.feasibility === c.expected.feasibility &&
      subset.violation_improvement === c.expected.violation_improvement &&
      subset.confidence === c.expected.confidence;
    return {
      test_name: c.name,
      test_type: "evaluation",
      expected_output: c.expected,
      actual_output: subset,
      status: passed ? "passed" : "failed",
      failure_reason: passed ? null : "Evaluation metrics did not match expected values.",
      debug_hint: passed ? null : "Verify computeEvaluation branch logic for this action_type.",
      execution_time_ms: Math.round(performance.now() - start),
    };
  } catch (e: any) {
    return {
      test_name: c.name,
      test_type: "evaluation",
      expected_output: c.expected,
      actual_output: null,
      status: "error",
      failure_reason: e?.message ?? "Unknown error",
      debug_hint: "Evaluator threw — likely null parseResult handling.",
      execution_time_ms: Math.round(performance.now() - start),
    };
  }
}

function runReproducibilityCase(): TestResult {
  const start = performance.now();
  try {
    const input = "Reduce all loads by 15%";
    const a = parseRecommendationText(input);
    const b = parseRecommendationText(input);
    const fullA = { ...a, id: "", run_id: "", created_at: "", updated_at: "" } as any;
    const fullB = { ...b, id: "", run_id: "", created_at: "", updated_at: "" } as any;
    const evalA = computeEvaluation(fullA, applyParsedAction(fullA));
    const evalB = computeEvaluation(fullB, applyParsedAction(fullB));
    const matchParse = JSON.stringify(a) === JSON.stringify(b);
    const matchEval = JSON.stringify(evalA) === JSON.stringify(evalB);
    const passed = matchParse && matchEval;
    return {
      test_name: "Identical input → identical output (parser + evaluator)",
      test_type: "reproducibility",
      expected_output: { parse: a, eval: evalA },
      actual_output: { parse: b, eval: evalB },
      status: passed ? "passed" : "failed",
      failure_reason: passed ? null : "Two runs of the same input produced different outputs.",
      debug_hint: passed ? null : "Check for hidden randomness or time-dependent logic in parser/evaluator.",
      execution_time_ms: Math.round(performance.now() - start),
    };
  } catch (e: any) {
    return {
      test_name: "Reproducibility",
      test_type: "reproducibility",
      expected_output: null,
      actual_output: null,
      status: "error",
      failure_reason: e?.message ?? "Unknown error",
      debug_hint: "Reproducibility test threw unexpectedly.",
      execution_time_ms: Math.round(performance.now() - start),
    };
  }
}

function runBatchStabilityCase(parserResults: TestResult[], evalResults: TestResult[]): TestResult {
  const start = performance.now();
  const total = parserResults.length + evalResults.length;
  const errors = [...parserResults, ...evalResults].filter((r) => r.status === "error").length;
  const failed = [...parserResults, ...evalResults].filter((r) => r.status === "failed").length;
  const passed = errors === 0;
  return {
    test_name: `Batch stability — ${total} tests executed`,
    test_type: "batch_stability",
    expected_output: { total, errors_allowed: 0 },
    actual_output: { total, errors, failed, passed: total - errors - failed },
    status: passed ? "passed" : "failed",
    failure_reason: passed ? null : `${errors} test(s) threw unexpectedly during batch execution.`,
    debug_hint: passed ? null : "Inspect individual error rows above for stack traces.",
    execution_time_ms: Math.round(performance.now() - start),
  };
}

export function runAllTests(): TestResult[] {
  const parser = PARSER_CASES.map(runParserCase);
  const evals = EVALUATION_CASES.map(runEvaluationCase);
  const repro = runReproducibilityCase();
  const stability = runBatchStabilityCase(parser, evals);
  return [...parser, ...evals, repro, stability];
}
