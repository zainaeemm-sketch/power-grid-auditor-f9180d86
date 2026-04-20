/**
 * Distinguish "skipped because no simulator is available for the case"
 * from genuine simulation/logic failures, based on failure_reason text.
 */
export type CounterfactualOutcomeKind = "success" | "skipped" | "failed";

const SKIP_PATTERNS = [
  /no simulator available/i,
  /not available for in-?worker simulation/i,
  /case .* not available/i,
  /external pandapower service/i,
];

export function isSkippedFailure(failureReason: string | null | undefined): boolean {
  if (!failureReason) return false;
  return SKIP_PATTERNS.some((re) => re.test(failureReason));
}

export function classifyOutcome(
  status: string | null | undefined,
  failureReason: string | null | undefined,
): CounterfactualOutcomeKind {
  if (status === "success") return "success";
  if (isSkippedFailure(failureReason)) return "skipped";
  return "failed";
}
