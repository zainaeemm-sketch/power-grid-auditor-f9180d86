/**
 * Shared CaseMeta type and runtime validator.
 *
 * Used by docs/cases and any future consumer of CASE_META-shaped data
 * (e.g. report metadata panels, admin tooling).
 */

export type CaseMeta = {
  dataset_version: string;
  source: string;
  source_url?: string;
  last_reviewed: string;
  standardized: string[];
  simplified: string[];
  /**
   * Optional. Identifier for the prompt revision used with this case.
   * Expected format: `<slug>@<semver>`, e.g. `case5-baseline@1.2.0`.
   */
  prompt_version?: string;
  /**
   * Optional. Deterministic seed for stochastic steps. Must be a non-negative
   * safe integer (0 .. 2^53 - 1). Strings are rejected.
   */
  random_seed?: number;
};

export type CaseMetaValidationOptions = {
  /** Label used in log/error messages, e.g. "docs/cases". */
  context?: string;
  /** When true, throw an Error if any issues are found. Otherwise console.warn. */
  strict?: boolean;
  /** Logger override (defaults to console.warn). Useful for tests. */
  warn?: (message: string) => void;
};

export type CaseMetaIssue = {
  key: string;
  /** Required fields that are missing or empty. */
  missing: string[];
  /** Optional fields that are present but malformed. */
  invalid: string[];
};

// `<slug>@<semver>` — slug is letters/digits/dash/underscore/dot.
const PROMPT_VERSION_RE = /^[A-Za-z0-9._-]+@\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/;

function isValidRandomSeed(v: unknown): v is number {
  return (
    typeof v === "number" &&
    Number.isSafeInteger(v) &&
    v >= 0
  );
}

/**
 * Inspect a CASE_META-shaped record and return a list of entries with missing
 * required fields or malformed optional fields. Pure — does not log or throw.
 */
export function findCaseMetaIssues(
  metaRecord: Readonly<Record<string, CaseMeta>>,
): CaseMetaIssue[] {
  const issues: CaseMetaIssue[] = [];
  for (const [key, meta] of Object.entries(metaRecord)) {
    const missing: string[] = [];
    const invalid: string[] = [];

    if (!meta.dataset_version?.trim()) missing.push("dataset_version");
    if (!meta.standardized?.length) missing.push("standardized notes");
    if (!meta.simplified?.length) missing.push("simplified notes");

    if (meta.prompt_version !== undefined) {
      if (
        typeof meta.prompt_version !== "string" ||
        !PROMPT_VERSION_RE.test(meta.prompt_version.trim())
      ) {
        invalid.push("prompt_version (expected `<slug>@<semver>`)");
      }
    }
    if (meta.random_seed !== undefined && !isValidRandomSeed(meta.random_seed)) {
      invalid.push("random_seed (expected non-negative safe integer)");
    }

    if (missing.length > 0 || invalid.length > 0) {
      issues.push({ key, missing, invalid });
    }
  }
  return issues;
}

/**
 * Validate a CASE_META-shaped record. In non-strict mode, logs a warning per
 * offending entry. In strict mode, throws a single aggregated Error.
 *
 * Returns the list of issues so callers can react further if needed.
 */
export function validateCaseMeta(
  metaRecord: Readonly<Record<string, CaseMeta>>,
  options: CaseMetaValidationOptions = {},
): CaseMetaIssue[] {
  const { context = "case-meta", strict = false, warn = console.warn } = options;
  const issues = findCaseMetaIssues(metaRecord);
  if (issues.length === 0) return issues;

  const messages = issues.map(({ key, missing, invalid }) => {
    const parts: string[] = [];
    if (missing.length > 0) parts.push(`missing: ${missing.join(", ")}`);
    if (invalid.length > 0) parts.push(`invalid: ${invalid.join(", ")}`);
    return `[${context}] CASE_META.${key} — ${parts.join("; ")}`;
  });

  if (strict) {
    throw new Error(
      `CASE_META validation failed (${context}):\n${messages.join("\n")}`,
    );
  }
  for (const msg of messages) warn(msg);
  return issues;
}
