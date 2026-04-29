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
      { key: "caseA", missing: ["standardized notes", "simplified notes"] },
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
    expect(warn.mock.calls[0]?.[0]).toMatch(/CASE_META\.bad.*dataset_version/);
  });

  it("throws an aggregated error in strict mode", () => {
    expect(() =>
      validateCaseMeta(
        {
          a: { ...validMeta, dataset_version: "" },
          b: { ...validMeta, simplified: [] },
        },
        { context: "test", strict: true },
      ),
    ).toThrow(/CASE_META validation failed.*test/s);
  });

  it("does not warn or throw when all entries are valid", () => {
    const warn = vi.fn();
    expect(() =>
      validateCaseMeta({ ok: validMeta }, { strict: true, warn }),
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
});
