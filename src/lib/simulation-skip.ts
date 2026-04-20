/**
 * Distinguish "skipped because no simulator is available for the case"
 * from genuine simulation/logic failures, based on failure_reason text.
 *
 * Shared by counterfactual + perturbation panels.
 */
export type SimulationOutcomeKind = "success" | "skipped" | "failed";

const SKIP_PATTERNS = [
  /no simulator available/i,
  /not available for in-?worker simulation/i,
  /case .* not available/i,
  /external pandapower service/i,
  /skipped/i,
];

export function isSkippedFailure(failureReason: string | null | undefined): boolean {
  if (!failureReason) return false;
  return SKIP_PATTERNS.some((re) => re.test(failureReason));
}

/** For counterfactuals: status='success' is real success; otherwise inspect failure_reason. */
export function classifyCounterfactual(
  status: string | null | undefined,
  failureReason: string | null | undefined,
): SimulationOutcomeKind {
  if (status === "success") return "success";
  if (isSkippedFailure(failureReason)) return "skipped";
  return "failed";
}

/**
 * For perturbations: there is no top-level status column on the result.
 * - failure_reason set → skipped or failed (per pattern)
 * - notes mentions skip → skipped
 * - otherwise success (robustness_result is "stable" / "degraded" / "failed",
 *   but "failed" here means robustness regression, not a simulation failure).
 */
export function classifyPerturbation(
  failureReason: string | null | undefined,
  notes: string | null | undefined,
): SimulationOutcomeKind {
  if (failureReason) return isSkippedFailure(failureReason) ? "skipped" : "failed";
  if (isSkippedFailure(notes)) return "skipped";
  return "success";
}
