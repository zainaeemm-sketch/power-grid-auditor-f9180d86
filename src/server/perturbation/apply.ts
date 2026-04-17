import type { PowerSystemCase } from "../simulation/types";
import type { PerturbationSpec } from "./types";

function deepCloneCase(c: PowerSystemCase): PowerSystemCase {
  return {
    name: c.name,
    base_mva: c.base_mva,
    buses: c.buses.map((b) => ({ ...b })),
    branches: c.branches.map((b) => ({ ...b })),
    generators: c.generators.map((g) => ({ ...g })),
  };
}

/**
 * Apply a perturbation to a case. Pure & deterministic — never mutates input.
 */
export function applyPerturbation(
  base: PowerSystemCase,
  spec: PerturbationSpec,
): PowerSystemCase {
  const c = deepCloneCase(base);
  const v = spec.parameter_value ?? 0;

  switch (spec.perturbation_type) {
    case "increase_load_percent":
    case "decrease_load_percent": {
      const factor = 1 + v / 100;
      for (const b of c.buses) b.pd_mw *= factor;
      break;
    }
    case "line_outage": {
      const idx = Math.round(v);
      c.branches = c.branches.filter((b) => b.index !== idx);
      break;
    }
    case "line_restoration": {
      // No-op: restoring a line not present in the model.
      break;
    }
    case "generator_limit_change": {
      const factor = 1 + v / 100;
      for (const g of c.generators) {
        g.p_max_mw = g.p_max_mw * factor;
        if (g.p_mw > g.p_max_mw) g.p_mw = g.p_max_mw;
      }
      break;
    }
    case "generator_dispatch_change": {
      const factor = 1 + v / 100;
      for (const g of c.generators) g.p_mw = g.p_mw * factor;
      break;
    }
    case "n1_contingency": {
      const idx = Math.round(v);
      c.branches = c.branches.filter((b) => b.index !== idx);
      break;
    }
    case "voltage_setpoint_shift": {
      for (const b of c.buses) {
        if (b.type === "pv" || b.type === "slack") b.vm_pu += v;
      }
      break;
    }
  }
  return c;
}
