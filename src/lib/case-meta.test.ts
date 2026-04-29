import { describe, expect, it, vi } from "vitest";
import { findCaseMetaIssues, validateCaseMeta, type CaseMeta } from "./case-meta";

const validMeta: CaseMeta = {
  dataset_version: "test@1.0.0",
  source: "Test source",
  last_reviewed: "2026-04-28",
  standardized: ["a"],
  simplified: ["b"],
};

describe("findCaseMetaIssues", () => {
  it("returns no issues when all entries are complete", () => {
    expect(findCaseMetaIssues({ caseX: validMeta })).toEqual([]);
  });

  it("flags missing dataset_version (empty / whitespace)", () => {
    const issues = findCaseMetaIssues({
      caseA: { ...validMeta, dataset_version: "" },
      caseB: { ...validMeta, dataset_version: "   " },
    });
    expect(issues).toHaveLength(2);
    expect(issues.every((i) => i.missing.includes("dataset_version"))).toBe(true);
  });

  it("flags missing standardized and simplified notes", () => {
    const issues = findCaseMetaIssues({
      caseA: { ...validMeta, standardized: [], simplified: [] },
    });
    expect(issues).toEqual([
      { key: "caseA", missing: ["standardized notes", "simplified notes"], invalid: [] },
    ]);
  });

  it("aggregates multiple missing fields per entry", () => {
    const issues = findCaseMetaIssues({
      bad: { ...validMeta, dataset_version: "", standardized: [], simplified: [] },
    });
    expect(issues[0]?.missing).toEqual([
      "dataset_version",
      "standardized notes",
      "simplified notes",
    ]);
  });

  it("accepts well-formed prompt_version and random_seed", () => {
    expect(
      findCaseMetaIssues({
        ok: { ...validMeta, prompt_version: "case5-baseline@1.2.0", random_seed: 42 },
        ok2: { ...validMeta, prompt_version: "x@0.0.1-rc.1", random_seed: 0 },
      }),
    ).toEqual([]);
  });

  it("flags malformed prompt_version", () => {
    const issues = findCaseMetaIssues({
      a: { ...validMeta, prompt_version: "no-version" },
      b: { ...validMeta, prompt_version: "name@1.2" },
      c: { ...validMeta, prompt_version: "" },
    });
    expect(issues).toHaveLength(3);
    expect(issues.every((i) => i.invalid[0]?.startsWith("prompt_version"))).toBe(true);
  });

  it("flags malformed random_seed", () => {
    const issues = findCaseMetaIssues({
      neg: { ...validMeta, random_seed: -1 },
      float: { ...validMeta, random_seed: 1.5 },
      // @ts-expect-error — intentional bad type
      str: { ...validMeta, random_seed: "42" },
    });
    expect(issues).toHaveLength(3);
    expect(issues.every((i) => i.invalid[0]?.startsWith("random_seed"))).toBe(true);
  });

  it("does not flag absent optional fields", () => {
    expect(findCaseMetaIssues({ ok: validMeta })).toEqual([]);
  });
});

describe("validateCaseMeta", () => {
  it("warns (not throws) by default and reports each issue", () => {
    const warn = vi.fn();
    const issues = validateCaseMeta(
      { bad: { ...validMeta, dataset_version: "" } },
      { context: "test", warn },
    );
    expect(issues).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/CASE_META\.bad.*missing: dataset_version/);
  });

  it("warns about invalid optional fields with `invalid:` label", () => {
    const warn = vi.fn();
    validateCaseMeta(
      { bad: { ...validMeta, prompt_version: "nope" } },
      { context: "test", warn },
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/invalid: prompt_version/);
  });

  it("throws an aggregated error in strict mode", () => {
    expect(() =>
      validateCaseMeta(
        {
          a: { ...validMeta, dataset_version: "" },
          b: { ...validMeta, simplified: [] },
          c: { ...validMeta, random_seed: -5 },
        },
        { context: "test", strict: true },
      ),
    ).toThrow(/CASE_META validation failed.*test/s);
  });

  it("does not warn or throw when all entries are valid", () => {
    const warn = vi.fn();
    expect(() =>
      validateCaseMeta(
        { ok: { ...validMeta, prompt_version: "p@1.0.0", random_seed: 7 } },
        { strict: true, warn },
      ),
    ).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("project CASE_META (smoke)", () => {
  it("live CASE_META in docs/cases has no missing required fields", async () => {
    const { CASE_META } = await import("@/routes/docs.cases");
    const issues = findCaseMetaIssues(CASE_META);
    expect(issues, JSON.stringify(issues, null, 2)).toEqual([]);
  });

  // Mirrors what the docs page would do in "strict" mode. Kept as a separate
  // test so the failure message is the aggregated Error from validateCaseMeta,
  // making CI logs immediately actionable. The browser dev panel intentionally
  // never throws — strict enforcement lives here, in CI.
  it("strict validation passes for the live CASE_META (CI gate)", async () => {
    const { CASE_META } = await import("@/routes/docs.cases");
    expect(() =>
      validateCaseMeta(CASE_META, { context: "ci", strict: true }),
    ).not.toThrow();
  });
});
