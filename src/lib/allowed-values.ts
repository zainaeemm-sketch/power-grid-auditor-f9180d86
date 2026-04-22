/**
 * Single source of truth for allowed enum values used across AI-assist server
 * functions, validators, and forms. When custom user cases land later, this is
 * the only file to extend (or replace with a loader merging built-ins + user
 * data) — every assistant picks up the new values automatically.
 */

export const ALLOWED_CASES = ["case5", "case14", "case30"] as const;
export type AllowedCase = (typeof ALLOWED_CASES)[number];

export const ALLOWED_AGENTS = [
  "poweragent",
  "powerfm",
  "gridgpt",
  "gpt-4o",
  "claude-3.5",
] as const;
export type AllowedAgent = (typeof ALLOWED_AGENTS)[number];

export const ALLOWED_EVALUATION_MODES = [
  "rule_based",
  "simulation",
  "auto",
] as const;
export type AllowedEvaluationMode = (typeof ALLOWED_EVALUATION_MODES)[number];

export function isAllowedCase(x: unknown): x is AllowedCase {
  return typeof x === "string" && (ALLOWED_CASES as readonly string[]).includes(x);
}

export function isAllowedAgent(x: unknown): x is AllowedAgent {
  return typeof x === "string" && (ALLOWED_AGENTS as readonly string[]).includes(x);
}

export function isAllowedEvaluationMode(x: unknown): x is AllowedEvaluationMode {
  return (
    typeof x === "string" &&
    (ALLOWED_EVALUATION_MODES as readonly string[]).includes(x)
  );
}
