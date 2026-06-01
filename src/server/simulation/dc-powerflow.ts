import type {
  PowerSystemCase,
  StructuredAction,
  SimulationResult,
  LineLoading,
  GeneratorViolation,
} from "./types";

/**
 * Pure-TypeScript DC power flow solver.
 *
 * DC PF assumptions: flat voltage magnitudes (1.0 pu), small angle differences,
 * and lossless lines. Solves B' · θ = P where B' is the susceptance matrix
 * (1/x) of branches and P is net injection at each non-slack bus.
 *
 * Deterministic: pure linear algebra on fixed inputs, no RNG, no time deps.
 */

function cloneCase(c: PowerSystemCase): PowerSystemCase {
  return {
    name: c.name,
    base_mva: c.base_mva,
    buses: c.buses.map((b) => ({ ...b })),
    branches: c.branches.map((b) => ({ ...b })),
    generators: c.generators.map((g) => ({ ...g })),
  };
}

/** Apply a structured action to a case copy. Returns the modified copy. */
function applyAction(base: PowerSystemCase, action: StructuredAction): PowerSystemCase {
  const c = cloneCase(base);
  if (!action.enabled || !action.action_type || action.action_type === "none") return c;

  if (action.action_type === "scale_all_loads" && typeof action.value === "number") {
    for (const b of c.buses) b.pd_mw *= action.value;
  } else if (
    action.action_type === "set_generator_p_mw" &&
    action.target_index != null &&
    typeof action.value === "number"
  ) {
    const g = c.generators[action.target_index];
    if (g) g.p_mw = action.value;
  } else if (action.action_type === "line_outage" && action.target_index != null) {
    c.branches = c.branches.filter((b) => b.index !== action.target_index);
  }

  return c;
}

/** Solve A·x = b for small dense matrices via Gaussian elimination with partial pivoting. */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let i = 0; i < n; i++) {
    // Partial pivot
    let maxRow = i;
    let maxVal = Math.abs(M[i][i]);
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > maxVal) {
        maxVal = Math.abs(M[k][i]);
        maxRow = k;
      }
    }
    if (maxVal < 1e-12) return null; // singular
    if (maxRow !== i) [M[i], M[maxRow]] = [M[maxRow], M[i]];

    for (let k = i + 1; k < n; k++) {
      const factor = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) M[k][j] -= factor * M[i][j];
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) sum -= M[i][j] * x[j];
    x[i] = sum / M[i][i];
  }
  return x;
}

/** Compute net real power injection at every bus (gen - load), in MW. */
function netInjections(c: PowerSystemCase): number[] {
  const n = c.buses.length;
  const p = new Array(n).fill(0);
  for (const b of c.buses) p[b.index] -= b.pd_mw;
  for (const g of c.generators) p[g.bus] += g.p_mw;
  return p;
}

/** Run DC PF on a case. Returns line loadings or null if the system is disconnected. */
function runDcPf(c: PowerSystemCase): LineLoading[] | null {
  const n = c.buses.length;
  const slack = c.buses.find((b) => b.type === "slack")?.index ?? 0;
  const baseMva = c.base_mva;

  // Build Bbus (n×n) in pu
  const B: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const br of c.branches) {
    if (br.x_pu === 0) continue;
    const b = 1 / br.x_pu;
    B[br.from_bus][br.from_bus] += b;
    B[br.to_bus][br.to_bus] += b;
    B[br.from_bus][br.to_bus] -= b;
    B[br.to_bus][br.from_bus] -= b;
  }

  // Reduce by removing the slack row/column
  const idx = c.buses.map((b) => b.index).filter((i) => i !== slack);
  const A: number[][] = idx.map((i) => idx.map((j) => B[i][j]));
  const inj = netInjections(c).map((p) => p / baseMva); // pu
  const Pred = idx.map((i) => inj[i]);

  const thetaReduced = solveLinearSystem(A, Pred);
  if (!thetaReduced) return null;

  const theta = new Array(n).fill(0);
  idx.forEach((busIdx, k) => (theta[busIdx] = thetaReduced[k]));

  // Compute branch flows: P_ij = (theta_i - theta_j) / x_ij  (pu) → MW
  return c.branches.map((br) => {
    const flowPu = (theta[br.from_bus] - theta[br.to_bus]) / br.x_pu;
    const flowMw = flowPu * baseMva;
    const loadingPct = (Math.abs(flowMw) / br.rate_mw) * 100;
    return {
      branch_index: br.index,
      from_bus: br.from_bus,
      to_bus: br.to_bus,
      flow_mw: +flowMw.toFixed(3),
      rate_mw: br.rate_mw,
      loading_pct: +loadingPct.toFixed(2),
      overloaded: loadingPct > 100,
    };
  });
}

function generatorViolations(c: PowerSystemCase): GeneratorViolation[] {
  const out: GeneratorViolation[] = [];
  for (const g of c.generators) {
    if (g.p_mw < g.p_min_mw - 1e-3) {
      out.push({ generator_index: g.index, bus: g.bus, p_mw: g.p_mw, type: "below_min" });
    } else if (g.p_mw > g.p_max_mw + 1e-3) {
      out.push({ generator_index: g.index, bus: g.bus, p_mw: g.p_mw, type: "above_max" });
    }
  }
  return out;
}

/**
 * Run baseline + post-action DC power flow and return a comparable evaluation.
 * Returns null if either solve is singular (caller should fall back).
 */
export function runDcEvaluation(
  baseCase: PowerSystemCase,
  action: StructuredAction,
): SimulationResult | null {
  const baseLoadings = runDcPf(baseCase);
  if (!baseLoadings) return null;
  const baselineOverloads = baseLoadings.filter((l) => l.overloaded).length;
  const baselineGenViolations = generatorViolations(baseCase).length;
  const baseline_violations = baselineOverloads + baselineGenViolations;

  const postCase = applyAction(baseCase, action);
  const postLoadings = runDcPf(postCase);
  if (!postLoadings) {
    // The action made the network unsolvable (islanded it or produced a singular
    // Bbus). We cannot quantify post-action violations on the same scale, so we
    // report infeasible WITHOUT inventing a violation count.
    return {
      engine: "dc_powerflow",
      feasibility: "infeasible",
      baseline_violations,
      post_action_violations: baseline_violations,
      violations_found: baseline_violations,
      violation_improvement: 0,
      line_loadings: baseLoadings,
      voltage_violations: [],
      generator_violations: generatorViolations(postCase),
      notes:
        "Post-action DC power flow did not converge: the action disconnected the " +
        "network or produced a singular system. Marked infeasible.",
    };
  }
  const postOverloads = postLoadings.filter((l) => l.overloaded).length;
  const genViolations = generatorViolations(postCase);
  const post_action_violations = postOverloads + genViolations.length;

  const isApplicable = action.enabled && action.action_type && action.action_type !== "none";
  // Feasible = the corrective action leaves the system with NO violations
  // (all branch loadings <= 100% of rating and all generators within limits).
  // This matches the task objective; no tolerance band, which would let an
  // action that still leaves violations count as "feasible".
  const feasibility: SimulationResult["feasibility"] = !isApplicable
    ? "not_applicable"
    : post_action_violations === 0
      ? "feasible"
      : "infeasible";

  return {
    engine: "dc_powerflow",
    feasibility,
    baseline_violations,
    post_action_violations,
    violations_found: post_action_violations,
    violation_improvement: baseline_violations - post_action_violations,
    line_loadings: postLoadings,
    voltage_violations: [], // DC PF does not compute voltage magnitudes
    generator_violations: genViolations,
    notes: `DC power flow on ${baseCase.name}: ${postOverloads} line overload(s), ${genViolations.length} generator-limit violation(s).`,
  };
}
