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
};

export type CaseMetaValidationOptions = {
  /** Label used in log/error messages, e.g. "docs/cases". */
  context?: string;
  /** When true, throw an Error if any issues are found. Otherwise console.warn. */
  strict?: boolean;
  /** Logger override (defaults to console.warn). Useful for tests. */
  warn?: (message: string) => void;
};

export type CaseMetaIssue = { key: string; missing: string[] };

/**
 * Inspect a CASE_META-shaped record and return a list of entries with missing
 * required fields. Pure — does not log or throw on its own.
 */
export function findCaseMetaIssues(
  metaRecord: Readonly<Record<string, CaseMeta>>,
): CaseMetaIssue[] {
  const issues: CaseMetaIssue[] = [];
  for (const [key, meta] of Object.entries(metaRecord)) {
    const missing: string[] = [];
    if (!meta.dataset_version?.trim()) missing.push("dataset_version");
    if (!meta.standardized?.length) missing.push("standardized notes");
    if (!meta.simplified?.length) missing.push("simplified notes");
    if (missing.length > 0) issues.push({ key, missing });
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

  const messages = issues.map(
    ({ key, missing }) =>
      `[${context}] CASE_META.${key} is missing required fields: ${missing.join(", ")}`,
  );

  if (strict) {
    throw new Error(
      `CASE_META validation failed (${context}):\n${messages.join("\n")}`,
    );
  }
  for (const msg of messages) warn(msg);
  return issues;
}
