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
        const got = JSON.stringify(meta.prompt_version);
        invalid.push(
          `prompt_version=${got} — expected format \`<slug>@<major>.<minor>.<patch>\` ` +
            "(slug = letters/digits/`.`/`_`/`-`; optional `-prerelease` or `+build` suffix). " +
            "Examples: `case5-baseline@1.2.0`, `case14_v2@0.1.0-rc.1`, `case30.alt@2.0.0+exp.42`",
        );
      }
    }
    if (meta.random_seed !== undefined && !isValidRandomSeed(meta.random_seed)) {
      const got = JSON.stringify(meta.random_seed);
      invalid.push(
        `random_seed=${got} — expected a non-negative safe integer ` +
          "(number, 0 .. 2^53-1; no strings, no negatives, no decimals). " +
          "Examples: `0`, `42`, `2025`, `1234567890`",
      );
    }

    if (missing.length > 0 || invalid.length > 0) {
      issues.push({ key, missing, invalid });
    }
  }
  return issues;
}

/* -------------------------------------------------------- override merge --
 * A single user-accepted override for one (case, field). Stored in the
 * `case_meta_overrides` table; each row patches one field on top of the
 * baseline CASE_META used by `findCaseMetaIssues` so accepted fixes
 * immediately resolve the corresponding issue in the docs panel.
 */
export type CaseMetaOverride = {
  case_key: string;
  field: string;
  value: unknown;
};

export function mergeOverrides(
  meta: Readonly<Record<string, CaseMeta>>,
  overrides: ReadonlyArray<CaseMetaOverride>,
): Record<string, CaseMeta> {
  if (overrides.length === 0) return { ...meta };
  const out: Record<string, CaseMeta> = {};
  for (const [k, v] of Object.entries(meta)) out[k] = { ...v };
  for (const o of overrides) {
    const target = out[o.case_key] ?? ({} as CaseMeta);
    out[o.case_key] = { ...target, [o.field]: o.value as never };
  }
  return out;
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
