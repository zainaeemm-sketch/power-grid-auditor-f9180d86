import { createFileRoute, getRouteApi, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Download } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TopologyDiagram } from "@/components/docs/TopologyDiagram";
import { CASES } from "@/server/simulation/cases";
import type { PowerSystemCase } from "@/server/simulation/types";
import { SuggestionReviewDrawer, type SuggestTarget } from "@/components/docs/SuggestionReviewDrawer";
import { OverridesSection } from "@/components/docs/OverridesSection";
import { OverrideAuditSection } from "@/components/docs/OverrideAuditSection";
import {
  listCaseMetaOverrides,
  type CaseMetaOverrideRow,
  type JsonValue,
} from "@/server/case-fix.functions";
import { mergeOverrides } from "@/lib/case-meta";
import { normalizeServerFnError } from "@/lib/server-fn-errors";

function downloadBlob(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toCsv(rows: Array<Record<string, string | number>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = rows.map((r) => headers.map((h) => escape(r[h])).join(","));
  return [headers.join(","), ...body].join("\n");
}

function exportCaseJson(c: PowerSystemCase) {
  downloadBlob(`${c.name}.json`, "application/json", JSON.stringify(c, null, 2));
}

function exportCaseCsv(c: PowerSystemCase) {
  const sections = [
    `# ${c.name} — base_mva=${c.base_mva}`,
    "",
    "## buses",
    toCsv(c.buses.map((b) => ({ index: b.index, type: b.type, pd_mw: b.pd_mw, vm_pu: b.vm_pu }))),
    "",
    "## branches",
    toCsv(
      c.branches.map((br) => ({
        index: br.index,
        from_bus: br.from_bus,
        to_bus: br.to_bus,
        x_pu: br.x_pu,
        rate_mw: br.rate_mw,
      })),
    ),
    "",
    "## generators",
    toCsv(
      c.generators.map((g) => ({
        index: g.index,
        bus: g.bus,
        p_mw: g.p_mw,
        p_min_mw: g.p_min_mw,
        p_max_mw: g.p_max_mw,
      })),
    ),
    "",
  ];
  downloadBlob(`${c.name}.csv`, "text/csv", sections.join("\n"));
}

const casesSearchSchema = z.object({
  filter: fallback(
    z.enum(["all", "missing", "prompt_version", "random_seed"]),
    "all",
  ).default("all"),
  // Per-filter "show details" persistence: comma-separated list of filter ids
  // that currently have details enabled (e.g. "missing,prompt_version").
  // Stored as a string for URL compactness; parsed/serialized in the panel.
  details: fallback(z.string(), "").default(""),
  q: fallback(z.string(), "").default(""),
  severity: fallback(z.enum(["any", "errors", "warnings"]), "any").default("any"),
});

const casesRouteApi = getRouteApi("/docs/cases");

export const Route = createFileRoute("/docs/cases")({
  validateSearch: zodValidator(casesSearchSchema),
  head: () => ({
    meta: [
      { title: "Test Systems — GridArena Docs" },
      {
        name: "description",
        content:
          "Topology, ratings, and parameters for the case5, case14, and case30 power-system presets used by GridArena's DC power flow solver.",
      },
      { property: "og:title", content: "Test Systems — GridArena Docs" },
      {
        property: "og:description",
        content:
          "Bus, branch, and generator tables for the IEEE-style benchmark networks used in GridArena experiments.",
      },
    ],
  }),
  component: CasesPage,
});

function fmt(n: number, digits = 2): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(digits);
}

function summarize(c: PowerSystemCase) {
  const slack = c.buses.filter((b) => b.type === "slack").length;
  const pv = c.buses.filter((b) => b.type === "pv").length;
  const pq = c.buses.filter((b) => b.type === "pq").length;
  const totalLoad = c.buses.reduce((s, b) => s + b.pd_mw, 0);
  const totalCap = c.generators.reduce((s, g) => s + g.p_max_mw, 0);
  const totalDispatch = c.generators.reduce((s, g) => s + g.p_mw, 0);
  return {
    slack,
    pv,
    pq,
    branches: c.branches.length,
    generators: c.generators.length,
    totalLoad,
    totalCap,
    totalDispatch,
  };
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}

function MetaField({
  label,
  children,
  anchorId,
}: {
  label: string;
  children: React.ReactNode;
  anchorId?: string;
}) {
  return (
    <div id={anchorId} className={anchorId ? "scroll-mt-24" : undefined}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xs">{children}</div>
    </div>
  );
}

import { type CaseMeta, findCaseMetaIssues, validateCaseMeta } from "@/lib/case-meta";

export const CASE_META: Record<string, CaseMeta> = {
  case5: {
    dataset_version: "gridarena-case5@1.0.0",
    source: "PJM 5-bus educational example (Li & Bo, 2010)",
    source_url: "https://matpower.org/docs/ref/matpower5.0/case5.html",
    last_reviewed: "2026-04-28",
    standardized: [
      "Topology (5 buses, 6 branches) matches the canonical PJM 5-bus.",
      "Bus types (slack/PV/PQ) follow the original classification.",
      "Line reactances (x_pu) preserved from the reference dataset.",
    ],
    simplified: [
      "Resistances and shunts dropped — DC power flow only.",
      "Generator cost curves replaced by a flat merit-order ranking.",
      "Voltage limits not enforced (flat 1.0 pu assumption).",
    ],
  },
  case14: {
    dataset_version: "gridarena-case14@1.0.0",
    source: "IEEE 14-bus (AEP, Feb 1962) via MATPOWER case14",
    source_url: "https://icseg.iti.illinois.edu/ieee-14-bus-system/",
    last_reviewed: "2026-04-28",
    standardized: [
      "14 buses, 20 branches, 5 generators per the IEEE reference.",
      "Bus loads (Pd) match published values.",
      "Per-line thermal ratings preserved (50–200 MW).",
    ],
    simplified: [
      "Transformer tap ratios collapsed into plain reactances.",
      "Reactive load (Qd) and bus shunts ignored under DC-PF.",
      "Generator Q-limits and voltage setpoints omitted.",
    ],
  },
  case30: {
    dataset_version: "gridarena-case30@1.0.0",
    source: "IEEE 30-bus (AEP, Dec 1961) via MATPOWER case30",
    source_url: "https://icseg.iti.illinois.edu/ieee-30-bus-system/",
    last_reviewed: "2026-04-28",
    standardized: [
      "30 buses, 41 branches, 6 generators per the IEEE reference.",
      "Bus loads (Pd) match published values.",
      "Branch reactances preserved from the standard dataset.",
    ],
    simplified: [
      "Uniform 130 MW thermal rating applied to every branch.",
      "Transformers, shunts, and reactive elements dropped.",
      "Generator cost curves replaced by greedy merit order.",
    ],
  },
};

if (import.meta.env.DEV) {
  // Browser DEV: warn-only. We deliberately never throw here, even when
  // VITE_STRICT_CASE_META=1, so a CASE_META problem cannot crash the docs
  // page or block unrelated flows like saving experiment presets.
  // Strict enforcement (throwing) is the job of the CI test in
  // `src/lib/case-meta.test.ts` — see `validateCaseMeta(..., { strict: true })`.
  validateCaseMeta(CASE_META, { context: "docs/cases", strict: false });
}

type CaseSectionProps = {
  readonly c: PowerSystemCase;
  readonly title: string;
  readonly origin: React.ReactNode;
  readonly meta: CaseMeta;
  readonly id: string;
};

function CaseSection({ c, title, origin, meta, id }: CaseSectionProps) {
  const s = summarize(c);
  return (
    <section id={id} className="not-prose mt-10 mb-6 scroll-mt-20">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCaseCsv(c)}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportCaseJson(c)}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            JSON
          </Button>
        </div>
      </div>
      <p className="my-3 leading-relaxed text-muted-foreground">{origin}</p>

      <div className="my-4 rounded-md border border-border bg-muted/20 px-4 py-3 text-xs">
        <div className="grid gap-2 sm:grid-cols-3">
          <MetaField label="Dataset version" anchorId={`case-${id.replace(/^case-/, "")}-dataset_version`}>
            <code className="text-foreground">{meta.dataset_version}</code>
          </MetaField>
          <MetaField label="Source">
            {meta.source_url ? (
              <a
                href={meta.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                {meta.source}
              </a>
            ) : (
              <span className="text-foreground">{meta.source}</span>
            )}
          </MetaField>
          <MetaField label="Last reviewed">
            <span className="text-foreground tabular-nums">{meta.last_reviewed}</span>
          </MetaField>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <MetaField
            label="Prompt version"
            anchorId={`case-${id.replace(/^case-/, "")}-prompt_version`}
          >
            {meta.prompt_version ? (
              <code className="text-foreground">{meta.prompt_version}</code>
            ) : (
              <span className="text-muted-foreground italic">— not set</span>
            )}
          </MetaField>
          <MetaField
            label="Random seed"
            anchorId={`case-${id.replace(/^case-/, "")}-random_seed`}
          >
            {meta.random_seed !== undefined ? (
              <code className="text-foreground tabular-nums">{meta.random_seed}</code>
            ) : (
              <span className="text-muted-foreground italic">— not set</span>
            )}
          </MetaField>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div
            id={`case-${id.replace(/^case-/, "")}-standardized`}
            className="scroll-mt-24"
          >
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
              Standardized
            </div>
            <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
              {meta.standardized.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div
            id={`case-${id.replace(/^case-/, "")}-simplified`}
            className="scroll-mt-24"
          >
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400/90">
              Simplified
            </div>
            <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
              {meta.simplified.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="my-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Buses" value={`${c.buses.length} (slack ${s.slack} · PV ${s.pv} · PQ ${s.pq})`} />
        <StatCard label="Branches" value={`${s.branches}`} />
        <StatCard label="Generators" value={`${s.generators}`} />
        <StatCard label="Base MVA" value={`${c.base_mva}`} />
        <StatCard label="Total load" value={`${fmt(s.totalLoad, 1)} MW`} />
        <StatCard label="Initial dispatch" value={`${fmt(s.totalDispatch, 1)} MW`} />
        <StatCard label="Total gen capacity" value={`${fmt(s.totalCap, 1)} MW`} />
        <StatCard
          label="Reserve margin"
          value={`${fmt(((s.totalCap - s.totalLoad) / Math.max(s.totalLoad, 1)) * 100, 0)}%`}
        />
      </div>

      <h3 className="mb-2 mt-5 text-base font-semibold text-foreground">Topology</h3>
      <TopologyDiagram c={c} />

      <h3 className="mb-2 mt-5 text-base font-semibold text-foreground">Buses</h3>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs tabular-nums">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-1.5 font-medium">#</th>
              <th className="px-3 py-1.5 font-medium">Type</th>
              <th className="px-3 py-1.5 font-medium">Pd (MW)</th>
              <th className="px-3 py-1.5 font-medium">Vm (pu)</th>
            </tr>
          </thead>
          <tbody>
            {c.buses.map((b) => (
              <tr key={b.index} className="border-t border-border even:bg-muted/20">
                <td className="px-3 py-1">{b.index}</td>
                <td className="px-3 py-1 uppercase">{b.type}</td>
                <td className="px-3 py-1">{fmt(b.pd_mw, 2)}</td>
                <td className="px-3 py-1">{fmt(b.vm_pu, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mb-2 mt-5 text-base font-semibold text-foreground">Branches</h3>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs tabular-nums">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-1.5 font-medium">#</th>
              <th className="px-3 py-1.5 font-medium">From</th>
              <th className="px-3 py-1.5 font-medium">To</th>
              <th className="px-3 py-1.5 font-medium">x (pu)</th>
              <th className="px-3 py-1.5 font-medium">Rating (MW)</th>
            </tr>
          </thead>
          <tbody>
            {c.branches.map((br) => (
              <tr key={br.index} className="border-t border-border even:bg-muted/20">
                <td className="px-3 py-1">{br.index}</td>
                <td className="px-3 py-1">{br.from_bus}</td>
                <td className="px-3 py-1">{br.to_bus}</td>
                <td className="px-3 py-1">{fmt(br.x_pu, 5)}</td>
                <td className="px-3 py-1">{fmt(br.rate_mw, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mb-2 mt-5 text-base font-semibold text-foreground">Generators</h3>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs tabular-nums">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-1.5 font-medium">#</th>
              <th className="px-3 py-1.5 font-medium">Bus</th>
              <th className="px-3 py-1.5 font-medium">P (MW)</th>
              <th className="px-3 py-1.5 font-medium">P_min (MW)</th>
              <th className="px-3 py-1.5 font-medium">P_max (MW)</th>
            </tr>
          </thead>
          <tbody>
            {c.generators.map((g) => (
              <tr key={g.index} className="border-t border-border even:bg-muted/20">
                <td className="px-3 py-1">{g.index}</td>
                <td className="px-3 py-1">{g.bus}</td>
                <td className="px-3 py-1">{fmt(g.p_mw, 1)}</td>
                <td className="px-3 py-1">{fmt(g.p_min_mw, 1)}</td>
                <td className="px-3 py-1">{fmt(g.p_max_mw, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type IssueFilter = "all" | "missing" | "prompt_version" | "random_seed";
type SeverityFilter = "any" | "errors" | "warnings";

type ExportableIssue = { key: string; missing: string[]; invalid: string[] };

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard may be unavailable in some sandboxes; silently ignore
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={copied ? "Copied!" : label}
      className={`shrink-0 rounded border px-1 py-px text-[10px] font-medium uppercase tracking-wider transition-colors ${
        copied
          ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-100"
          : "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
      }`}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

type ExportScope = "all" | "errors" | "warnings";

type IssueRow = {
  display_order: number;
  case_key: string;
  severity: "error" | "warning";
  problem_type: "missing" | "invalid";
  field: string;
  message: string;
};

function scopeIssues(issues: ExportableIssue[], scope: ExportScope): ExportableIssue[] {
  if (scope === "errors") {
    return issues
      .map((i) => ({ key: i.key, missing: i.missing, invalid: [] as string[] }))
      .filter((i) => i.missing.length > 0);
  }
  if (scope === "warnings") {
    return issues
      .map((i) => ({ key: i.key, missing: [] as string[], invalid: i.invalid }))
      .filter((i) => i.invalid.length > 0);
  }
  return issues;
}

function buildIssueRows(scoped: ExportableIssue[]): IssueRow[] {
  const rows: IssueRow[] = [];
  let order = 0;
  for (const { key, missing, invalid } of scoped) {
    for (const field of missing) {
      rows.push({
        display_order: order++,
        case_key: key,
        severity: "error",
        problem_type: "missing",
        field,
        message: "",
      });
    }
    for (const message of invalid) {
      const field = message.split(/[=\s(]/, 1)[0] ?? "";
      rows.push({
        display_order: order++,
        case_key: key,
        severity: "warning",
        problem_type: "invalid",
        field,
        message,
      });
    }
  }
  return rows;
}


function exportIssues(
  issues: ExportableIssue[],
  filter: IssueFilter,
  format: "json" | "csv",
  options: { scope?: ExportScope } = {},
) {
  const { scope = "all" } = options;
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const base = `case-meta-issues_${filter}_${scope}_${ts}`;
  const scoped = scopeIssues(issues, scope);

  if (format === "json") {
    const payload = {
      generated_at: new Date().toISOString(),
      filter,
      scope,
      total_entries: scoped.length,
      total_missing: scoped.reduce((n, i) => n + i.missing.length, 0),
      total_invalid: scoped.reduce((n, i) => n + i.invalid.length, 0),
      issues: scoped,
    };
    downloadBlob(`${base}.json`, "application/json", JSON.stringify(payload, null, 2));
    return;
  }

  // CSV: one row per individual problem (missing field or invalid message).
  // See `buildIssueRows` for column documentation and ordering guarantees.
  const rows = buildIssueRows(scoped);
  const csv =
    rows.length > 0
      ? toCsv(rows as unknown as Array<Record<string, string | number>>)
      : "display_order,case_key,severity,problem_type,field,message\n";
  downloadBlob(`${base}.csv`, "text/csv", csv);
}

/**
 * Severity legend for the dev panel:
 * - `error`   → required field missing (blocks CI via strict validation).
 * - `warning` → optional field present but malformed (does not block CI).
 *
 * `count` is optional: when omitted the badge renders as a plain inline label
 * (used next to each list item); when provided it renders as a header chip
 * showing the total of that severity (e.g. "3 errors").
 */
function SeverityBadge({
  severity,
  count,
  title: titleOverride,
}: {
  severity: "error" | "warning";
  count?: number;
  /** Optional explicit tooltip; defaults to the generic CI explanation. */
  title?: string;
}) {
  const isError = severity === "error";
  const label = isError ? "error" : "warning";
  const cls = isError
    ? "border-red-400/50 bg-red-500/25 text-red-50"
    : "border-amber-400/50 bg-amber-500/25 text-amber-50";
  const title =
    titleOverride ??
    (isError
      ? "Required field missing — fails strict CI validation"
      : "Optional field has invalid format — warns only, does not fail CI");
  if (count === undefined) {
    return (
      <span
        title={title}
        className={`inline-block rounded border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider ${cls}`}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider ${cls} ${
        count === 0 ? "opacity-40" : ""
      }`}
    >
      {label}s <span className="tabular-nums">{count}</span>
    </span>
  );
}

/**
 * Map a missing-field label or invalid-field message to a precise tooltip
 * naming the strict CI check that will fail. The check is implemented by
 * `validateCaseMeta(..., { strict: true })` in `src/lib/case-meta.ts` and
 * is enforced by the "strict validation passes for the live CASE_META"
 * test in `src/lib/case-meta.test.ts`.
 */
function ciCheckTitle(severity: "error" | "warning", message: string): string {
  const slug = fieldSlug(message);
  const test = "validateCaseMeta strict-mode test (src/lib/case-meta.test.ts)";
  if (severity === "error") {
    const requirement: Record<string, string> = {
      dataset_version: "must be a non-empty string",
      standardized: "`standardized` notes array must be non-empty",
      simplified: "`simplified` notes array must be non-empty",
    };
    const detail = requirement[slug] ?? "required field is missing or empty";
    return `Strict CI failure: CASE_META.<key>.${slug} — ${detail}.\nFails: ${test}`;
  }
  // warning — only invalid optional formats, currently prompt_version / random_seed
  const requirement: Record<string, string> = {
    prompt_version:
      "must match `<slug>@<major>.<minor>.<patch>` (e.g. `case5-baseline@1.2.0`)",
    random_seed:
      "must be a non-negative safe integer (0 .. 2^53-1; no strings, negatives, or decimals)",
  };
  const detail = requirement[slug] ?? "value does not match the expected format";
  return `Non-blocking warning (does not fail CI): CASE_META.<key>.${slug} — ${detail}.`;
}

/**
 * Compact run-quality summary for the panel's current filtered view.
 *
 * Status:
 * - "pass" — no errors and no warnings in scope (CI-clean).
 * - "warn" — warnings only (non-blocking; CI still passes).
 * - "fail" — at least one error (would fail strict CI).
 *
 * Also surfaces whether the view is narrowed: `viewTotals` reflects the
 * issues currently visible after filter+search+severity, while `totals`
 * reflects the full project. When they differ we tell the user.
 */
function ViewStatusBar({
  viewTotals,
  totals,
}: {
  viewTotals: { errors: number; warnings: number; cases: number };
  totals: { errors: number; warnings: number };
}) {
  const status: "pass" | "warn" | "fail" =
    viewTotals.errors > 0 ? "fail" : viewTotals.warnings > 0 ? "warn" : "pass";

  const cfg = {
    pass: {
      label: "Pass",
      detail: "No errors or warnings in this view — strict CI would pass.",
      cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
      dot: "bg-emerald-400",
    },
    warn: {
      label: "Warn",
      detail: "Warnings only — non-blocking, strict CI still passes.",
      cls: "border-amber-500/40 bg-amber-500/10 text-amber-100",
      dot: "bg-amber-400",
    },
    fail: {
      label: "Fail",
      detail: "At least one required field is missing — strict CI would fail.",
      cls: "border-red-500/50 bg-red-500/10 text-red-100",
      dot: "bg-red-400",
    },
  }[status];

  const isNarrowed =
    viewTotals.errors !== totals.errors || viewTotals.warnings !== totals.warnings;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mb-3 flex flex-wrap items-center gap-2 rounded border px-2 py-1.5 text-[11px] leading-snug ${cfg.cls}`}
    >
      <span className="flex items-center gap-1.5">
        <span className={`inline-block h-2 w-2 rounded-full ${cfg.dot}`} aria-hidden />
        <span className="font-semibold uppercase tracking-wider">{cfg.label}</span>
      </span>
      <span className="opacity-90">{cfg.detail}</span>
      <span className="ml-auto flex items-center gap-2 font-mono text-[10.5px] opacity-90">
        <span title="Errors visible in this view">
          err <span className="tabular-nums">{viewTotals.errors}</span>
        </span>
        <span aria-hidden>·</span>
        <span title="Warnings visible in this view">
          warn <span className="tabular-nums">{viewTotals.warnings}</span>
        </span>
        <span aria-hidden>·</span>
        <span title="Cases shown in this view">
          cases <span className="tabular-nums">{viewTotals.cases}</span>
        </span>
        {isNarrowed && (
          <span
            className="rounded border border-current/40 px-1 py-px text-[9.5px] uppercase tracking-wider opacity-80"
            title={`Filtered view (project total: ${totals.errors} errors, ${totals.warnings} warnings)`}
          >
            filtered
          </span>
        )}
      </span>
    </div>
  );
}

function ExportPreviewModal({
  scope,
  format,
  filter,
  issues,
  onCancel,
  onConfirm,
}: {
  scope: ExportScope;
  format: "csv" | "json";
  filter: IssueFilter;
  issues: ExportableIssue[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const scoped = useMemo(() => scopeIssues(issues, scope), [issues, scope]);
  const rows = useMemo(() => buildIssueRows(scoped), [scoped]);
  const PREVIEW_LIMIT = 50;
  const shown = rows.slice(0, PREVIEW_LIMIT);
  const hidden = Math.max(0, rows.length - shown.length);

  // Close on Escape for keyboard parity with the rest of the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const scopeLabel =
    scope === "errors" ? "Errors only" : scope === "warnings" ? "Warnings only" : "All";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${format.toUpperCase()} export preview`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onCancel}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-amber-500/40 bg-slate-900 text-xs text-amber-50 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-amber-500/30 px-4 py-2">
          <div>
            <div className="text-sm font-semibold">{format.toUpperCase()} export preview</div>
            <div className="text-[11px] text-amber-100/70">
              Scope: <span className="font-mono">{scopeLabel}</span> · Field filter:{" "}
              <span className="font-mono">{filter}</span> · {rows.length} row
              {rows.length === 1 ? "" : "s"}
              {format === "csv" && hidden > 0 ? ` (showing first ${shown.length})` : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close preview"
            className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] hover:bg-amber-500/20"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {rows.length === 0 ? (
            <div className="px-4 py-6 text-center text-amber-100/60">
              No rows match the current scope.
            </div>
          ) : format === "json" ? (
            <pre className="whitespace-pre-wrap break-words px-4 py-3 font-mono text-[11px] leading-snug text-amber-100/85">
              {JSON.stringify(
                {
                  generated_at: "<set at download time>",
                  filter,
                  scope,
                  total_entries: scoped.length,
                  total_missing: scoped.reduce((n, i) => n + i.missing.length, 0),
                  total_invalid: scoped.reduce((n, i) => n + i.invalid.length, 0),
                  issues: scoped,
                },
                null,
                2,
              )}
            </pre>
          ) : (
            <table className="w-full border-collapse text-[11px]">
              <thead className="sticky top-0 bg-slate-800 text-amber-100/80">
                <tr>
                  <th className="px-2 py-1 text-left font-semibold">#</th>
                  <th className="px-2 py-1 text-left font-semibold">case_key</th>
                  <th className="px-2 py-1 text-left font-semibold">severity</th>
                  <th className="px-2 py-1 text-left font-semibold">field</th>
                  <th className="px-2 py-1 text-left font-semibold">message</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr
                    key={r.display_order}
                    className="border-t border-amber-500/10 even:bg-slate-800/40"
                  >
                    <td className="px-2 py-1 font-mono tabular-nums text-amber-100/60">
                      {r.display_order}
                    </td>
                    <td className="px-2 py-1 font-mono">{r.case_key}</td>
                    <td className="px-2 py-1">
                      <span
                        className={`rounded border px-1 py-px text-[10px] font-semibold uppercase ${
                          r.severity === "error"
                            ? "border-red-400/50 bg-red-500/20 text-red-100"
                            : "border-amber-300/50 bg-amber-400/20 text-amber-100"
                        }`}
                      >
                        {r.severity}
                      </span>
                    </td>
                    <td className="px-2 py-1 font-mono">{r.field}</td>
                    <td className="px-2 py-1 break-words text-amber-100/80">{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-amber-500/30 px-4 py-2">
          {format === "csv" && hidden > 0 && (
            <span className="mr-auto text-[11px] text-amber-100/60">
              + {hidden} more row{hidden === 1 ? "" : "s"} will be included in the download
            </span>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-500/15"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={rows.length === 0}
            className="rounded border border-emerald-400/50 bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold text-emerald-50 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Download {format.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}

function CaseMetaDevPanel() {
  const [overrides, setOverrides] = useState<CaseMetaOverrideRow[]>([]);
  const [overridesLoading, setOverridesLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Bumped after every accept/revert so the audit panel re-pulls fresh rows.
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const refreshOverrides = async () => {
    setOverridesLoading(true);
    try {
      const result = await listCaseMetaOverrides();
      if (result.ok) {
        setOverrides(result.overrides);
        setAuditRefreshKey((k) => k + 1);
      } else {
        setOverrides([]);
        // `unauthenticated` no longer happens (the server returns an empty
        // list for anon visitors), so any `ok: false` here is a real failure
        // worth toasting (config_missing / db_error).
        toast.error(result.message);
      }
    } catch (e) {
      // Belt-and-braces: any unexpected throw (network blip, etc.) still
      // gets normalized so we never surface "[object Response]".
      setOverrides([]);
      const err = await normalizeServerFnError(e, "Failed to load overrides");
      if (!err.silent) toast.error(err.message);
    } finally {
      setOverridesLoading(false);
    }
  };
  useEffect(() => {
    refreshOverrides();
  }, []);
  const mergedMeta = useMemo(
    () => {
      const safe = Array.isArray(overrides) ? overrides : [];
      return mergeOverrides(
        CASE_META,
        safe.map((o) => ({ case_key: o.case_key, field: o.field, value: o.value })),
      );
    },
    [overrides],
  );
  const allIssues = findCaseMetaIssues(mergedMeta);
  const { filter, details, q, severity } = casesRouteApi.useSearch();
  const navigate = useNavigate({ from: "/docs/cases" });

  // Parse the URL `details` token list into a Set of filter ids that have
  // "Show details" turned on. Each field filter (all/missing/prompt_version/
  // random_seed) keeps its own independent visibility choice.
  const detailsSet = useMemo<Set<IssueFilter>>(() => {
    const set = new Set<IssueFilter>();
    for (const raw of details.split(",")) {
      const s = raw.trim();
      if (s === "all" || s === "missing" || s === "prompt_version" || s === "random_seed") {
        set.add(s);
      }
    }
    return set;
  }, [details]);
  const detailsForCurrent = detailsSet.has(filter);

  // CSV export preview state: when set, the panel renders a modal showing
  // the rows that would be written to disk so the user can confirm before
  // committing the download.
  const [preview, setPreview] = useState<{ scope: ExportScope; format: "csv" | "json" } | null>(
    null,
  );
  const serializeDetails = (set: Set<IssueFilter>) =>
    set.size === 0 ? undefined : Array.from(set).join(",");

  const setFilter = (next: IssueFilter) => {
    navigate({
      search: (prev: { filter?: IssueFilter; details?: string }) => ({
        ...prev,
        filter: next === "all" ? undefined : next,
      }),
      replace: true,
    });
    // After updating the URL, scroll to the first case section that matches
    // the newly chosen filter. Use rAF so the DOM (and any newly-rendered
    // anchors) reflect the navigation before we look up the target.
    requestAnimationFrame(() => {
      const anchorId = firstMatchingAnchorId(allIssues, next);
      if (!anchorId) return;
      const el = document.getElementById(anchorId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const toggleDetails = () => {
    const nextSet = new Set(detailsSet);
    if (nextSet.has(filter)) nextSet.delete(filter);
    else nextSet.add(filter);
    const nextDetails = serializeDetails(nextSet);
    navigate({
      search: (prev: { filter?: IssueFilter; details?: string; q?: string }) => ({
        ...prev,
        details: nextDetails,
      }),
      replace: true,
    });
  };
  const setQuery = (next: string) =>
    navigate({
      search: (prev: { filter?: IssueFilter; details?: string; q?: string; severity?: SeverityFilter }) => ({
        ...prev,
        q: next.trim() === "" ? undefined : next,
      }),
      replace: true,
    });
  const setSeverity = (next: SeverityFilter) => {
    navigate({
      search: (prev: { filter?: IssueFilter; details?: string; q?: string; severity?: SeverityFilter }) => ({
        ...prev,
        severity: next === "any" ? undefined : next,
      }),
      replace: true,
    });
    // Jump to the first issue row inside the panel that matches the
    // newly chosen severity (combined with the current field filter and
    // search query, so what we scroll to is what the user will actually see).
    requestAnimationFrame(() => {
      const target = firstMatchingIssueKey(allIssues, filter, q, next);
      if (!target) return;
      const el = document.getElementById(`dev-issue-${target}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  // Ref to the search input so the `/` shortcut can focus it.
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcuts for the dev panel (DEV-only render so this
  // listener never ships to production). Skips when the user is typing in
  // any input/textarea/contentEditable so we don't hijack normal text entry.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable === true;

      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        if (q !== "") setQuery("");
        searchInputRef.current?.blur();
        return;
      }

      if (isTyping) return;

      switch (e.key.toLowerCase()) {
        case "d":
          e.preventDefault();
          toggleDetails();
          break;
        case "1":
          e.preventDefault();
          setFilter("all");
          break;
        case "2":
          e.preventDefault();
          setFilter("missing");
          break;
        case "3":
          e.preventDefault();
          setFilter("prompt_version");
          break;
        case "4":
          e.preventDefault();
          setFilter("random_seed");
          break;
        case "a":
          e.preventDefault();
          setSeverity("any");
          break;
        case "e":
          e.preventDefault();
          setSeverity("errors");
          break;
        case "w":
          e.preventDefault();
          setSeverity("warnings");
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filter, severity]);


  const counts = useMemo(() => {
    let missing = 0;
    let promptVersion = 0;
    let randomSeed = 0;
    for (const issue of allIssues) {
      if (issue.missing.length > 0) missing++;
      if (issue.invalid.some((m) => m.startsWith("prompt_version"))) promptVersion++;
      if (issue.invalid.some((m) => m.startsWith("random_seed"))) randomSeed++;
    }
    return { all: allIssues.length, missing, prompt_version: promptVersion, random_seed: randomSeed };
  }, [allIssues]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allIssues
      .filter((i) => (needle === "" ? true : i.key.toLowerCase().includes(needle)))
      .map(({ key, missing, invalid }) => {
        // Field-level filter (which slot does the issue belong to).
        let m = missing;
        let inv = invalid;
        if (filter === "missing") inv = [];
        else if (filter === "prompt_version") {
          m = [];
          inv = invalid.filter((x) => x.startsWith("prompt_version"));
        } else if (filter === "random_seed") {
          m = [];
          inv = invalid.filter((x) => x.startsWith("random_seed"));
        }
        // Severity-level filter (errors = missing, warnings = invalid).
        if (severity === "errors") inv = [];
        else if (severity === "warnings") m = [];
        return { key, missing: m, invalid: inv };
      })
      .filter((i) => i.missing.length > 0 || i.invalid.length > 0);
  }, [allIssues, filter, q, severity]);

  if (allIssues.length === 0) return null;

  const totals = useMemo(() => {
    let errors = 0;
    let warnings = 0;
    for (const i of allIssues) {
      errors += i.missing.length;
      warnings += i.invalid.length;
    }
    return { errors, warnings };
  }, [allIssues]);

  const viewTotals = useMemo(() => {
    let errors = 0;
    let warnings = 0;
    for (const i of filtered) {
      errors += i.missing.length;
      warnings += i.invalid.length;
    }
    return { errors, warnings, cases: filtered.length };
  }, [filtered]);

  const hasErrors = totals.errors > 0;

  const filterOptions: Array<{ id: IssueFilter; label: string; count: number }> = [
    { id: "all", label: "All", count: counts.all },
    { id: "missing", label: "Missing fields", count: counts.missing },
    { id: "prompt_version", label: "Invalid prompt_version", count: counts.prompt_version },
    { id: "random_seed", label: "Invalid random_seed", count: counts.random_seed },
  ];

  return (
    <>
    <aside
      role="alert"
      className={`not-prose my-4 rounded-md border px-4 py-3 text-xs ${
        hasErrors
          ? "border-red-500/50 bg-red-500/10 text-red-100"
          : "border-amber-500/40 bg-amber-500/10 text-amber-100"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            hasErrors
              ? "bg-red-500/25 text-red-100"
              : "bg-amber-500/20 text-amber-200"
          }`}
        >
          Dev only
        </span>
        <span className="font-semibold">CASE_META validation issues ({allIssues.length})</span>
        <span
          className="flex items-center gap-1"
          role="group"
          aria-label="Filter by severity"
        >
          <button
            type="button"
            onClick={() => setSeverity("any")}
            aria-pressed={severity === "any"}
            title="Show errors and warnings"
            className={`rounded border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              severity === "any"
                ? "border-amber-200 bg-amber-400/30 text-amber-50"
                : "border-amber-500/30 bg-amber-500/5 text-amber-200 hover:bg-amber-500/15"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setSeverity("errors")}
            aria-pressed={severity === "errors"}
            disabled={totals.errors === 0}
            title="Show only required-field errors (these fail strict CI)"
            className={`rounded border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              severity === "errors"
                ? "border-red-300 bg-red-500/40 text-red-50"
                : "border-red-400/50 bg-red-500/15 text-red-100 hover:bg-red-500/25"
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            Errors <span className="tabular-nums">{totals.errors}</span>
          </button>
          <button
            type="button"
            onClick={() => setSeverity("warnings")}
            aria-pressed={severity === "warnings"}
            disabled={totals.warnings === 0}
            title="Show only invalid-format warnings (non-blocking)"
            className={`rounded border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              severity === "warnings"
                ? "border-amber-200 bg-amber-400/40 text-amber-50"
                : "border-amber-400/50 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            Warnings <span className="tabular-nums">{totals.warnings}</span>
          </button>
        </span>
        <div className="ml-auto flex gap-1.5">
          <label
            className="flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/5 px-2 py-0.5 text-[11px] font-medium text-amber-200 hover:bg-amber-500/15 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-40"
            title="Download a JSON file of the filtered issues, choosing whether to include all rows, only errors, or only warnings"
          >
            <span>Export JSON:</span>
            <select
              aria-label="Export JSON scope"
              disabled={filtered.length === 0}
              value=""
              onChange={(e) => {
                const v = e.target.value as ExportScope | "";
                if (v === "") return;
                setPreview({ scope: v, format: "json" });
                e.target.value = "";
              }}
              className="cursor-pointer rounded border border-amber-500/30 bg-amber-500/10 px-1 py-px text-[11px] font-medium text-amber-100 focus:border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-300 disabled:cursor-not-allowed"
            >
              <option value="" disabled>
                Choose scope…
              </option>
              <option value="all" disabled={filtered.length === 0}>
                All ({viewTotals.errors + viewTotals.warnings})
              </option>
              <option value="errors" disabled={viewTotals.errors === 0}>
                Errors only ({viewTotals.errors})
              </option>
              <option value="warnings" disabled={viewTotals.warnings === 0}>
                Warnings only ({viewTotals.warnings})
              </option>
            </select>
          </label>
          <label
            className="flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/5 px-2 py-0.5 text-[11px] font-medium text-amber-200 hover:bg-amber-500/15 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-40"
            title="Download a CSV of the filtered issues, choosing whether to include all rows, only errors, or only warnings"
          >
            <span>Export CSV:</span>
            <select
              aria-label="Export CSV scope"
              disabled={filtered.length === 0}
              value=""
              onChange={(e) => {
                const v = e.target.value as ExportScope | "";
                if (v === "") return;
                setPreview({ scope: v, format: "csv" });
                e.target.value = "";
              }}
              className="cursor-pointer rounded border border-amber-500/30 bg-amber-500/10 px-1 py-px text-[11px] font-medium text-amber-100 focus:border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-300 disabled:cursor-not-allowed"
            >
              <option value="" disabled>
                Choose scope…
              </option>
              <option value="all" disabled={filtered.length === 0}>
                All ({viewTotals.errors + viewTotals.warnings})
              </option>
              <option value="errors" disabled={viewTotals.errors === 0}>
                Errors only ({viewTotals.errors})
              </option>
              <option value="warnings" disabled={viewTotals.warnings === 0}>
                Warnings only ({viewTotals.warnings})
              </option>
            </select>
          </label>
          <label
            className="flex cursor-pointer items-center gap-1.5 rounded border border-amber-500/30 bg-amber-500/5 px-2 py-0.5 text-[11px] font-medium text-amber-200 hover:bg-amber-500/15"
            title={`Show or hide the full validation message under each invalid field (saved per filter — currently "${filter}")`}
          >
            <input
              type="checkbox"
              checked={detailsForCurrent}
              onChange={toggleDetails}
              className="h-3 w-3 cursor-pointer accent-amber-400"
              aria-label="Show full invalid messages"
            />
            Show details
          </label>
        </div>
      </div>
      <ViewStatusBar viewTotals={viewTotals} totals={totals} />
      <p className="mb-3 rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 text-[11px] leading-relaxed text-amber-100/80">
        <span className="font-semibold text-amber-100">Non-blocking in dev:</span> these
        warnings never fail the page or block flows like saving experiment presets.{" "}
        <span className="font-semibold text-amber-100">CI is strict:</span> the{" "}
        <code className="rounded bg-amber-500/15 px-1 py-px font-mono">case-meta</code>{" "}
        test runs{" "}
        <code className="rounded bg-amber-500/15 px-1 py-px font-mono">
          validateCaseMeta(…, &#123; strict: true &#125;)
        </code>{" "}
        and fails the build on any of the issues listed below.
      </p>
      <div className="mb-2">
        <label className="flex items-center gap-2">
          <span className="sr-only">Filter case IDs</span>
          <input
            ref={searchInputRef}
            type="search"
            value={q}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter case IDs (press / to focus)"
            aria-label="Filter case IDs"
            className="w-full rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[11px] text-amber-50 placeholder:text-amber-100/40 focus:border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-300"
          />
          {q !== "" && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="shrink-0 rounded border border-amber-500/30 bg-amber-500/5 px-2 py-0.5 text-[11px] font-medium text-amber-200 hover:bg-amber-500/15"
              title="Clear search"
            >
              Clear
            </button>
          )}
        </label>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter issues">
        {filterOptions.map((opt) => {
          const active = filter === opt.id;
          const disabled = opt.count === 0 && opt.id !== "all";
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFilter(opt.id)}
              disabled={disabled}
              aria-pressed={active}
              className={`rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                active
                  ? "border-amber-300 bg-amber-400/30 text-amber-50"
                  : "border-amber-500/30 bg-amber-500/5 text-amber-200 hover:bg-amber-500/15"
              } ${disabled ? "cursor-not-allowed opacity-40 hover:bg-amber-500/5" : ""}`}
            >
              {opt.label} <span className="opacity-70">({opt.count})</span>
            </button>
          );
        })}
      </div>
      {filtered.length === 0 ? (
        <p className="italic text-amber-100/70">No issues match the current filter.</p>
      ) : (
        <ul className="list-disc space-y-1.5 pl-5">
          {filtered.map(({ key, missing, invalid }) => (
            <li key={key} id={`dev-issue-${key}`} className="scroll-mt-24">
              <a
                href={`#case-${key}`}
                className="font-mono text-amber-200 underline-offset-4 hover:underline"
              >
                {key}
              </a>
              {missing.length > 0 && (
                <ul className="ml-1 mt-0.5 list-none space-y-0.5">
                  {missing.map((m) => {
                    const slug = fieldSlug(m);
                    return (
                      <li key={m} className="text-amber-100/80">
                        <SeverityBadge
                          severity="error"
                          title={ciCheckTitle("error", m)}
                        />{" "}
                        <a
                          href={`#case-${key}-${slug}`}
                          className="font-mono text-amber-200 underline-offset-4 hover:underline"
                          title={`Jump to ${slug} in ${key}`}
                        >
                          {m}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
              {invalid.length > 0 && (
                <ul className="ml-1 mt-0.5 list-none space-y-0.5">
                  {invalid.map((msg) => {
                    const slug = fieldSlug(msg);
                    return (
                      <li key={msg} className="text-amber-100/80">
                        <SeverityBadge
                          severity="warning"
                          title={ciCheckTitle("warning", msg)}
                        />{" "}
                        <a
                          href={`#case-${key}-${slug}`}
                          className="font-mono text-amber-200 underline-offset-4 hover:underline"
                          title={`Jump to ${slug} in ${key}`}
                        >
                          {slug}
                        </a>
                        {detailsForCurrent ? (
                          <div className="ml-5 mt-0.5 flex items-start gap-1.5">
                            <div className="break-words font-mono text-[11px] leading-snug text-amber-100/75">
                              {msg}
                            </div>
                            <CopyButton value={msg} label={`Copy ${slug} validation message`} />
                          </div>
                        ) : (
                          <span className="sr-only"> — {msg}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 border-t border-amber-500/20 pt-1.5 text-[10px] text-amber-100/60">
        Shortcuts:{" "}
        <kbd className="rounded border border-amber-500/30 bg-amber-500/10 px-1 font-mono">/</kbd> search ·{" "}
        <kbd className="rounded border border-amber-500/30 bg-amber-500/10 px-1 font-mono">d</kbd> details ·{" "}
        <kbd className="rounded border border-amber-500/30 bg-amber-500/10 px-1 font-mono">1</kbd>–
        <kbd className="rounded border border-amber-500/30 bg-amber-500/10 px-1 font-mono">4</kbd> field filter ·{" "}
        <kbd className="rounded border border-amber-500/30 bg-amber-500/10 px-1 font-mono">a</kbd>/
        <kbd className="rounded border border-amber-500/30 bg-amber-500/10 px-1 font-mono">e</kbd>/
        <kbd className="rounded border border-amber-500/30 bg-amber-500/10 px-1 font-mono">w</kbd> any/errors/warnings ·{" "}
        <kbd className="rounded border border-amber-500/30 bg-amber-500/10 px-1 font-mono">Esc</kbd> clear search
      </p>
    </aside>
    <OverridesSection overrides={overrides} onChanged={refreshOverrides} loading={overridesLoading} />
    <OverrideAuditSection refreshKey={auditRefreshKey} />
    {filtered.length > 0 && (
      <div className="not-prose my-2 flex justify-end">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded border border-emerald-400/50 bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/25"
        >
          Suggest AI fixes for visible ({viewTotals.errors + viewTotals.warnings})
        </button>
      </div>
    )}
    {drawerOpen && (
      <SuggestionReviewDrawer
        targets={(() => {
          const out: SuggestTarget[] = [];
          for (const i of filtered) {
            for (const f of i.missing) {
              out.push({ caseKey: i.key, field: f, severity: "error", message: "", currentValue: undefined });
            }
            for (const msg of i.invalid) {
              const field = msg.split(/[=\s(]/, 1)[0] ?? "";
              out.push({
                caseKey: i.key,
                field,
                severity: "warning",
                message: msg,
                currentValue: (mergedMeta[i.key] as Record<string, JsonValue> | undefined)?.[field],
              });
            }
          }
          return out;
        })()}
        currentMetaByCase={mergedMeta as unknown as Record<string, Record<string, JsonValue>>}
        onClose={() => setDrawerOpen(false)}
        onApplied={refreshOverrides}
      />
    )}
    {preview !== null && (
      <ExportPreviewModal
        scope={preview.scope}
        format={preview.format}
        filter={filter}
        issues={filtered}
        onCancel={() => setPreview(null)}
        onConfirm={() => {
          exportIssues(filtered, filter, preview.format, { scope: preview.scope });
          setPreview(null);
        }}
      />
    )}
    </>
  );
}

/**
 * Map a missing-field label or invalid-field message to the anchor slug used
 * by `MetaField` and the standardized/simplified blocks in `CaseSection`.
 */
function fieldSlug(message: string): string {
  const head = message.split(/[=\s(]/, 1)[0]?.trim() ?? "";
  if (head === "standardized") return "standardized";
  if (head === "simplified") return "simplified";
  if (head === "dataset_version") return "dataset_version";
  if (head === "prompt_version") return "prompt_version";
  if (head === "random_seed") return "random_seed";
  return head || "dataset_version";
}

/**
 * Resolve the DOM id to scroll to when a given filter chip is activated.
 * Returns the most specific anchor that matches the filter, or null when
 * no issue matches (in which case scrolling is skipped).
 */
function firstMatchingAnchorId(
  issues: ReadonlyArray<{ key: string; missing: string[]; invalid: string[] }>,
  filter: IssueFilter,
): string | null {
  if (filter === "all") {
    const first = issues[0];
    return first ? `case-${first.key}` : null;
  }
  if (filter === "missing") {
    const first = issues.find((i) => i.missing.length > 0);
    if (!first) return null;
    return `case-${first.key}-${fieldSlug(first.missing[0]!)}`;
  }
  // "prompt_version" | "random_seed"
  const first = issues.find((i) => i.invalid.some((m) => m.startsWith(filter)));
  if (!first) return null;
  return `case-${first.key}-${filter}`;
}

/**
 * Find the case key of the first issue that survives the panel's combined
 * filter pipeline (field filter + search query + severity). Returns null
 * when nothing matches, in which case the caller should skip scrolling.
 */
function firstMatchingIssueKey(
  issues: ReadonlyArray<{ key: string; missing: string[]; invalid: string[] }>,
  filter: IssueFilter,
  q: string,
  severity: SeverityFilter,
): string | null {
  const needle = q.trim().toLowerCase();
  for (const i of issues) {
    if (needle !== "" && !i.key.toLowerCase().includes(needle)) continue;
    let m = i.missing;
    let inv = i.invalid;
    if (filter === "missing") inv = [];
    else if (filter === "prompt_version") {
      m = [];
      inv = inv.filter((x) => x.startsWith("prompt_version"));
    } else if (filter === "random_seed") {
      m = [];
      inv = inv.filter((x) => x.startsWith("random_seed"));
    }
    if (severity === "errors") inv = [];
    else if (severity === "warnings") m = [];
    if (m.length > 0 || inv.length > 0) return i.key;
  }
  return null;
}

function CasesPage() {
  return (
    <>
      <h1>Test Systems</h1>
      {import.meta.env.DEV && <CaseMetaDevPanel />}

      <h2 id="ai-suggestions">Reviewing AI suggestions</h2>
      <p>
        When the dev panel finds a missing or invalid case-meta field, you can ask GridArena
        to draft a fix. The suggestion flow is read-only by default — nothing is written to the
        merged <code>CASE_META</code> until you explicitly accept it — and every accept or revert
        is recorded in an append-only audit trail (see the{" "}
        <a href="/docs/architecture#validation-feedback">validation feedback loop</a> for the
        end-to-end picture).
      </p>

      <h3>1. Open the suggestion drawer</h3>
      <p>
        Click <strong>Suggest fix</strong> on any issue row. The right-hand drawer calls{" "}
        <code>suggestCaseMetaFix</code>, which sends the case key, field, and current value to the
        configured LLM and returns a structured proposal: the new value, the model that produced it,
        and a short rationale. A spinner appears while the request is in flight; failures show an
        inline toast and leave the panel unchanged.
      </p>

      <h3>2. Inspect the diff</h3>
      <p>
        The drawer renders the previous value next to the proposed value so you can eyeball the
        change before committing. Use this to catch hallucinated <code>source_url</code> values,
        wrong <code>last_reviewed</code> dates, or rationales that don&apos;t match the field type.
        If the suggestion is wrong, just close the drawer — nothing is persisted.
      </p>

      <h3>3. Accept or revert</h3>
      <p>
        <strong>Accept</strong> writes a row to <code>case_meta_overrides</code> and immediately
        re-merges the override into <code>CASE_META</code> so the validator re-runs. Accepted
        overrides appear in the <strong>Overrides</strong> table directly under the dev panel.
        Each row has a <strong>Revert</strong> action that deletes the override and restores the
        original value — the UI updates optimistically and rolls back if the server rejects the
        request.
      </p>

      <h3>4. Bulk actions</h3>
      <p>
        For sweeps across many cases, tick the row checkboxes in the Overrides table and use{" "}
        <strong>Bulk revert</strong> to remove a batch in a single database round-trip. The audit
        trail records one entry per affected override so the history stays granular even when the
        action was bulk.
      </p>

      <h3>5. Audit trail</h3>
      <p>
        Every accept and revert is appended to <code>case_meta_override_audit</code> with the
        actor, timestamp, action, previous value, new value, and the AI model + rationale (when
        the action originated from a suggestion). The <strong>Audit history</strong> panel below
        the Overrides table renders the chronological log so you can answer{" "}
        <em>"who changed this field, when, and why"</em> long after the fact. Audit rows are
        user-scoped via RLS and cannot be edited or deleted.
      </p>

      <h2 id="exporting-invalid-items">Exporting invalid items</h2>
      <p>
        The dev panel above lists every case-meta validation issue detected at build time.
        Two scope-aware dropdowns at the top of the panel — <strong>Export CSV</strong> and{" "}
        <strong>Export JSON</strong> — let you download the currently filtered list of invalid
        items for offline review or for attaching to a bug report.
      </p>

      <h3>Filter and sort awareness</h3>
      <p>
        Exports follow the panel&apos;s active filter and the on-screen sort order exactly. A{" "}
        <code>display_order</code> column is included in every row so you can trace any line
        in the export back to its position in the panel, even after re-sorting or re-filtering.
      </p>

      <h3>Choosing a scope</h3>
      <p>
        Each dropdown offers three scopes. Counts shown next to each option are live, and an
        option is disabled when its bucket is empty:
      </p>
      <ul>
        <li><strong>All</strong> — every issue in the current filter.</li>
        <li><strong>Errors only</strong> — rows where a required field is <strong>missing</strong>.</li>
        <li><strong>Warnings only</strong> — rows where a field is present but its <strong>format is invalid</strong>.</li>
      </ul>
      <p>
        The <code>severity</code> column reflects this distinction: <code>error</code> for
        missing fields, <code>warning</code> for invalid formats.
      </p>

      <h3>Preview before download</h3>
      <p>
        Choosing a scope opens a preview modal instead of downloading immediately:
      </p>
      <ul>
        <li>
          <strong>CSV preview</strong> — a table of up to the first 50 rows showing{" "}
          <code>case_key</code>, <code>severity</code>, <code>field</code>, and{" "}
          <code>message</code>, plus the total row count and the active filter.
        </li>
        <li>
          <strong>JSON preview</strong> — the full payload rendered in a code block so you can
          inspect the exact structure before saving.
        </li>
      </ul>
      <p>
        Both modals expose <strong>Download</strong> and <strong>Cancel</strong> buttons, and{" "}
        <kbd>Esc</kbd> dismisses the preview without downloading.
      </p>

      <h3>CSV column schema</h3>
      <table>
        <thead>
          <tr>
            <th>Column</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>display_order</code></td>
            <td>integer</td>
            <td>Position in the on-screen list (preserves the current sort).</td>
          </tr>
          <tr>
            <td><code>case_key</code></td>
            <td>string</td>
            <td>Identifier of the case the issue belongs to.</td>
          </tr>
          <tr>
            <td><code>severity</code></td>
            <td><code>error</code> | <code>warning</code></td>
            <td><code>error</code> = missing field, <code>warning</code> = invalid format.</td>
          </tr>
          <tr>
            <td><code>problem_type</code></td>
            <td><code>missing</code> | <code>invalid</code></td>
            <td>Same distinction in machine-friendly form.</td>
          </tr>
          <tr>
            <td><code>field</code></td>
            <td>string</td>
            <td>Name of the offending meta field.</td>
          </tr>
          <tr>
            <td><code>message</code></td>
            <td>string</td>
            <td>Human-readable validation message (empty for <code>missing</code>).</td>
          </tr>
        </tbody>
      </table>

      <h3>JSON shape</h3>
      <p>
        The JSON export mirrors the CSV: an array of objects with the same six keys per row,
        in the same order as the on-screen list.
      </p>

      <h3>Worked examples</h3>
      <p>CSV:</p>
      <pre><code>{`display_order,case_key,severity,problem_type,field,message
1,case14,error,missing,prompt_version,
2,case14,warning,invalid,random_seed,"random_seed must be an integer"`}</code></pre>
      <p>JSON:</p>
      <pre><code>{`[
  { "display_order": 1, "case_key": "case14", "severity": "error",
    "problem_type": "missing", "field": "prompt_version", "message": "" },
  { "display_order": 2, "case_key": "case14", "severity": "warning",
    "problem_type": "invalid", "field": "random_seed",
    "message": "random_seed must be an integer" }
]`}</code></pre>

      <p>
        GridArena ships three built-in <strong>IEEE-style transmission benchmarks</strong> —{" "}
        <code>case5</code>, <code>case14</code>, and <code>case30</code>. They are simplified,
        deterministic versions of well-known reference networks, embedded directly in the
        codebase (<code>src/server/simulation/cases.ts</code>) so the in-Worker DC power flow
        and the optional PyPSA microservice produce reproducible results without external
        downloads.
      </p>
      <p>
        The tables below are generated at build time from the actual case definitions, so what
        you see here is exactly what the solver runs.
      </p>

      <h2>Engine assumptions</h2>
      <p>Both solvers use <strong>DC power flow</strong>:</p>
      <ul>
        <li>Lossless network (line resistance ignored).</li>
        <li>Flat 1.0 pu voltage magnitudes — voltage-magnitude violations are always empty.</li>
        <li>Small-angle approximation (sin θ ≈ θ).</li>
        <li>
          Generator dispatch is greedy <strong>merit-order</strong> by marginal cost to cover
          total load before each PF run.
        </li>
      </ul>
      <p>
        These assumptions make results meaningful for{" "}
        <strong>line loading, thermal violations, and redispatch</strong>, but not for reactive
        power, voltage collapse, or losses.
      </p>

      <CaseSection
        c={CASES.case5}
        id="case-case5"
        title="case5 — 5-bus system" meta={CASE_META.case5}
        origin={
          <>
            A small 5-bus system commonly used for teaching LMP and congestion. Roughly based on
            the <strong>PJM 5-bus educational example</strong>. Useful as a sanity check: the
            topology is small enough to reason about by hand.
          </>
        }
      />

      <CaseSection
        c={CASES.case14}
        id="case-case14"
        title="case14 — IEEE 14-bus" meta={CASE_META.case14}
        origin={
          <>
            Derived from the classic <strong>IEEE 14-bus test case</strong>, which represents a
            portion of the American Electric Power (AEP) system in the US Midwest as of February
            1962. The most widely cited small-scale benchmark in power-flow literature.
          </>
        }
      />

      <CaseSection
        c={CASES.case30}
        id="case-case30"
        title="case30 — IEEE 30-bus" meta={CASE_META.case30}
        origin={
          <>
            Derived from the <strong>IEEE 30-bus test case</strong>, also based on the AEP
            system (December 1961). Standard benchmark for contingency / N-1 analysis with
            enough topology to exercise meaningful re-routing under line outages.
          </>
        }
      />

      <h2>Supported actions</h2>
      <p>The solvers accept these structured actions on any case:</p>
      <ul>
        <li><code>scale_all_loads</code> — multiply every load by <code>value</code>.</li>
        <li><code>set_generator_p_mw</code> — set generator at <code>target_index</code> to <code>value</code> MW.</li>
        <li><code>line_outage</code> — remove branch at <code>target_index</code>.</li>
        <li><code>shed_load</code> — shed <code>value</code> MW total, scaled across loads.</li>
      </ul>

      <h2>Supported perturbations</h2>
      <p>For sensitivity / robustness analysis (batch perturbation jobs):</p>
      <ul>
        <li><code>load_scale</code> / <code>load_increase</code> — scale every load by <code>parameter_value</code>.</li>
        <li><code>line_rating_decrease</code> — scale every line <code>s_nom</code> by <code>parameter_value</code>.</li>
        <li><code>generator_outage</code> — remove generator at index <code>parameter_value</code>.</li>
      </ul>

      <h2>References</h2>
      <ul>
        <li>
          <a href="https://matpower.org" target="_blank" rel="noreferrer">
            MATPOWER
          </a>{" "}
          — canonical <code>.m</code> case archive (<code>case5.m</code>, <code>case14.m</code>,{" "}
          <code>case30.m</code>).
        </li>
        <li>
          <a href="https://pypsa.readthedocs.io" target="_blank" rel="noreferrer">
            PyPSA documentation
          </a>{" "}
          — engine used by the optional simulation microservice.
        </li>
        <li>
          <a
            href="https://icseg.iti.illinois.edu/power-cases/"
            target="_blank"
            rel="noreferrer"
          >
            Illinois Center for a Smarter Electric Grid
          </a>{" "}
          — one-line diagrams and history of the IEEE 14 / 30 systems.
        </li>
        <li>
          In-repo: <code>src/server/simulation/cases.ts</code>,{" "}
          <code>src/server/simulation/dc-powerflow.ts</code>,{" "}
          <code>simulation-service/README.md</code>.
        </li>
      </ul>
    </>
  );
}
