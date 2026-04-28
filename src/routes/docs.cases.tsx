import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
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

function CaseSection({
  c,
  title,
  origin,
}: {
  c: PowerSystemCase;
  title: string;
  origin: React.ReactNode;
}) {
  const s = summarize(c);
  return (
    <section className="not-prose mt-10 mb-6">
      <h2 className="mb-2 text-xl font-semibold text-foreground">{title}</h2>
      <p className="my-3 leading-relaxed text-muted-foreground">{origin}</p>

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

function CasesPage() {
  return (
    <>
      <h1>Test Systems</h1>
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
        title="case5 — 5-bus system"
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
        title="case14 — IEEE 14-bus"
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
        title="case30 — IEEE 30-bus"
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
