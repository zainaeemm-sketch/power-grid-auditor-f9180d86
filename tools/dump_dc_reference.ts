/**
 * Dump GridArena's built-in cases AND the baseline branch flows computed by the
 * project's OWN DC power-flow solver to tools/dc_reference.json.
 *
 * This is the single source of truth for validation: it exercises the real
 * exported solver (runDcEvaluation) so the validator checks your actual code.
 *
 * Run from the repo root:
 *     bun run tools/dump_dc_reference.ts
 * Then:
 *     python tools/validate_dc.py            # compare against pandapower
 *     python tools/validate_dc.py --internal # numpy-only cross-check (no pandapower)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { CASES } from "../src/server/simulation/cases";
import { runDcEvaluation } from "../src/server/simulation/dc-powerflow";

// A disabled / "none" action makes runDcEvaluation return the *baseline* flows
// (post-action == base case), which is exactly the reference we want to check.
const NOOP = { action_type: "none", target_index: null, value: null, enabled: false } as any;

const out: { generated_at: string; cases: Record<string, unknown> } = {
  generated_at: new Date().toISOString(),
  cases: {},
};

for (const name of Object.keys(CASES)) {
  const c = CASES[name];
  const res = runDcEvaluation(c, NOOP);
  out.cases[name] = {
    base_mva: c.base_mva,
    buses: c.buses,
    branches: c.branches,
    generators: c.generators,
    ts_line_flows: res?.line_loadings ?? [],
  };
}

mkdirSync("tools", { recursive: true });
writeFileSync("tools/dc_reference.json", JSON.stringify(out, null, 2));
console.log(`Wrote tools/dc_reference.json with ${Object.keys(out.cases).length} cases.`);
