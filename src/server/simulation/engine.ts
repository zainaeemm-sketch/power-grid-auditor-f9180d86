import { resolveCase } from "./cases";
import { runDcEvaluation } from "./dc-powerflow";
import { callExternalSimulator } from "./external-client";
import type { EvaluationMode, SimulationResult, StructuredAction } from "./types";

/**
 * Tiered simulation orchestrator.
 *
 *   mode = "rule_based"  → returns null (caller uses rule-based path)
 *   mode = "simulation"  → external pandapower → DC PF → null
 *   mode = "auto"        → external pandapower → DC PF → null (then rule-based)
 *
 * Returns null when no simulation engine could produce a result; callers must
 * fall back to the rule-based evaluator in that case.
 */
export async function runSimulation(
  caseName: string,
  action: StructuredAction,
  mode: EvaluationMode,
): Promise<SimulationResult | null> {
  if (mode === "rule_based") return null;

  // 1. Try external pandapower service
  try {
    const ext = await callExternalSimulator(caseName, action);
    if (ext) return ext;
  } catch {
    // swallow — fall through
  }

  // 2. Try in-Worker DC power flow on built-in cases
  const baseCase = resolveCase(caseName);
  if (baseCase) {
    const dc = runDcEvaluation(baseCase, action);
    if (dc) return dc;
  }

  // 3. No simulator available
  return null;
}
