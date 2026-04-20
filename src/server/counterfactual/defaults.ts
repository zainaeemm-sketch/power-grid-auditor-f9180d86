import type { CounterfactualSpec } from "./types";
import type { StructuredAction } from "../simulation/types";

/**
 * Deterministic default counterfactual set, contextual to the baseline action.
 * Returns alternative actions to compare against the agent's choice.
 */
export function getDefaultCounterfactualSet(
  baseline: StructuredAction,
): CounterfactualSpec[] {
  const specs: CounterfactualSpec[] = [];
  const type = baseline.action_type ?? "none";

  if (type === "scale_all_loads") {
    const variants = [0.9, 0.95, 1.0];
    for (const v of variants) {
      if (baseline.value != null && Math.abs(v - baseline.value) < 1e-6) continue;
      specs.push({
        action_type: "scale_all_loads",
        target_index: null,
        value: v,
        description: `Scale all loads by ${v.toFixed(2)}`,
        source: "default",
      });
    }
  } else if (type === "set_generator_p_mw") {
    const idx = baseline.target_index ?? 0;
    const base = baseline.value ?? 0;
    specs.push({
      action_type: "set_generator_p_mw",
      target_index: idx,
      value: +(base * 1.1).toFixed(2),
      description: `Increase gen[${idx}] dispatch by +10%`,
      source: "default",
    });
    specs.push({
      action_type: "set_generator_p_mw",
      target_index: idx,
      value: +(base * 0.9).toFixed(2),
      description: `Decrease gen[${idx}] dispatch by −10%`,
      source: "default",
    });
  } else if (type === "line_outage") {
    const idx = baseline.target_index ?? 0;
    specs.push({
      action_type: "none",
      target_index: null,
      value: null,
      description: `Restore line ${idx} (no outage)`,
      source: "default",
    });
    specs.push({
      action_type: "line_outage",
      target_index: idx + 1,
      value: null,
      description: `Isolate a different line (index ${idx + 1})`,
      source: "default",
    });
  }

  // Always include a "do nothing" baseline alternative for comparison
  if (type !== "none") {
    specs.push({
      action_type: "none",
      target_index: null,
      value: null,
      description: "Take no action",
      source: "default",
    });
  }

  // Fallback: if baseline had no recognised type, propose load-scaling sweep
  if (!specs.length) {
    for (const v of [0.9, 0.95, 1.0]) {
      specs.push({
        action_type: "scale_all_loads",
        target_index: null,
        value: v,
        description: `Scale all loads by ${v.toFixed(2)}`,
        source: "default",
      });
    }
  }

  return specs;
}
