import { createFileRoute, getRouteApi, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Download } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { TopologyDiagram } from "@/components/docs/TopologyDiagram";
import { CASES } from "@/server/simulation/cases";
import type { PowerSystemCase } from "@/server/simulation/types";

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

export const Route = createFileRoute("/docs/cases")({
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

type ExportableIssue = { key: string; missing: string[]; invalid: string[] };

function exportIssues(
  issues: ExportableIssue[],
  filter: IssueFilter,
  format: "json" | "csv",
) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const base = `case-meta-issues_${filter}_${ts}`;

  if (format === "json") {
    const payload = {
      generated_at: new Date().toISOString(),
      filter,
      total_entries: issues.length,
      total_missing: issues.reduce((n, i) => n + i.missing.length, 0),
      total_invalid: issues.reduce((n, i) => n + i.invalid.length, 0),
      issues,
    };
    downloadBlob(`${base}.json`, "application/json", JSON.stringify(payload, null, 2));
    return;
  }

  // CSV: one row per individual problem (missing field or invalid message)
  const rows: Array<Record<string, string | number>> = [];
  for (const { key, missing, invalid } of issues) {
    for (const field of missing) {
      rows.push({ case_key: key, problem_type: "missing", field, message: "" });
    }
    for (const message of invalid) {
      const field = message.split(/[=\s(]/, 1)[0] ?? "";
      rows.push({ case_key: key, problem_type: "invalid", field, message });
    }
  }
  const csv =
    rows.length > 0
      ? toCsv(rows)
      : "case_key,problem_type,field,message\n";
  downloadBlob(`${base}.csv`, "text/csv", csv);
}

function CaseMetaDevPanel() {
  if (!import.meta.env.DEV) return null;
  const allIssues = findCaseMetaIssues(CASE_META);
  const { filter } = casesRouteApi.useSearch();
  const navigate = useNavigate({ from: "/docs/cases" });
  const setFilter = (next: IssueFilter) =>
    navigate({
      search: (prev) => ({ ...prev, filter: next === "all" ? undefined : next }),
      replace: true,
    });

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
    return allIssues
      .map(({ key, missing, invalid }) => {
        if (filter === "all") return { key, missing, invalid };
        if (filter === "missing") return { key, missing, invalid: [] as string[] };
        const prefix = filter; // "prompt_version" | "random_seed"
        return {
          key,
          missing: [] as string[],
          invalid: invalid.filter((m) => m.startsWith(prefix)),
        };
      })
      .filter((i) => i.missing.length > 0 || i.invalid.length > 0);
  }, [allIssues, filter]);

  if (allIssues.length === 0) return null;

  const filterOptions: Array<{ id: IssueFilter; label: string; count: number }> = [
    { id: "all", label: "All", count: counts.all },
    { id: "missing", label: "Missing fields", count: counts.missing },
    { id: "prompt_version", label: "Invalid prompt_version", count: counts.prompt_version },
    { id: "random_seed", label: "Invalid random_seed", count: counts.random_seed },
  ];

  return (
    <aside
      role="alert"
      className="not-prose my-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-100"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
          Dev only
        </span>
        <span className="font-semibold">CASE_META validation issues ({allIssues.length})</span>
        <div className="ml-auto flex gap-1.5">
          <button
            type="button"
            onClick={() => exportIssues(filtered, filter, "json")}
            disabled={filtered.length === 0}
            className="rounded border border-amber-500/30 bg-amber-500/5 px-2 py-0.5 text-[11px] font-medium text-amber-200 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-40"
            title="Download filtered issues as JSON"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => exportIssues(filtered, filter, "csv")}
            disabled={filtered.length === 0}
            className="rounded border border-amber-500/30 bg-amber-500/5 px-2 py-0.5 text-[11px] font-medium text-amber-200 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-40"
            title="Download filtered issues as CSV"
          >
            Export CSV
          </button>
        </div>
      </div>
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
            <li key={key}>
              <a
                href={`#case-${key}`}
                className="font-mono text-amber-200 underline-offset-4 hover:underline"
              >
                {key}
              </a>
              {missing.length > 0 && (
                <div className="ml-1 mt-0.5 text-amber-100/80">
                  <span className="font-semibold text-amber-100">missing:</span>{" "}
                  {missing.map((m, idx) => {
                    const slug = fieldSlug(m);
                    return (
                      <span key={m}>
                        <a
                          href={`#case-${key}-${slug}`}
                          className="font-mono text-amber-200 underline-offset-4 hover:underline"
                          title={`Jump to ${slug} in ${key}`}
                        >
                          {m}
                        </a>
                        {idx < missing.length - 1 ? ", " : ""}
                      </span>
                    );
                  })}
                </div>
              )}
              {invalid.length > 0 && (
                <ul className="ml-1 mt-0.5 list-none space-y-0.5">
                  {invalid.map((msg) => {
                    const slug = fieldSlug(msg);
                    return (
                      <li key={msg} className="text-amber-100/80">
                        <span className="font-semibold text-amber-100">invalid:</span>{" "}
                        <a
                          href={`#case-${key}-${slug}`}
                          className="font-mono text-amber-200 underline-offset-4 hover:underline"
                          title={`Jump to ${slug} in ${key}`}
                        >
                          {slug}
                        </a>{" "}
                        <span className="text-amber-100/70">— {msg}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
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

function CasesPage() {
  return (
    <>
      <h1>Test Systems</h1>
      <CaseMetaDevPanel />
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
