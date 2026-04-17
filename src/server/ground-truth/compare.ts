import type { GroundTruthAction } from "@/types/grid-arena";

export interface AgentActionLike {
  action_type: string | null;
  target_index: number | null;
  value: number | null;
}

export interface AgentEvalLike {
  feasibility: string; // "feasible" | "infeasible" | "unknown"
  violation_improvement: number;
}

export interface GroundTruthComparison {
  action_match: "exact" | "partial" | "none";
  feasibility_match: "correct" | "incorrect";
  optimality_gap: number;
  deviation_from_reference: number;
  matched_reference_action_id: string | null;
}

const VALUE_EPS = 1e-6;

function scoreMatch(
  agent: AgentActionLike,
  ref: GroundTruthAction,
): { match: "exact" | "partial" | "none"; deviation: number } {
  if (!agent.action_type || agent.action_type !== ref.action_type) {
    return { match: "none", deviation: Number.POSITIVE_INFINITY };
  }
  // types match — check target_index when both sides specify it
  if (
    agent.target_index != null &&
    ref.target_index != null &&
    agent.target_index !== ref.target_index
  ) {
    return { match: "none", deviation: Number.POSITIVE_INFINITY };
  }

  const agentVal = typeof agent.value === "number" ? agent.value : null;
  const refVal = typeof ref.value === "number" ? ref.value : null;
  if (agentVal != null && refVal != null) {
    const dev = Math.abs(agentVal - refVal);
    return { match: dev < VALUE_EPS ? "exact" : "partial", deviation: dev };
  }
  // missing value on either side → can still be partial (same type/target)
  if (agentVal == null && refVal == null) {
    return { match: "exact", deviation: 0 };
  }
  return { match: "partial", deviation: Number.POSITIVE_INFINITY };
}

export function compareToGroundTruth(
  agentAction: AgentActionLike,
  agentEval: AgentEvalLike,
  referenceActions: GroundTruthAction[],
): GroundTruthComparison {
  if (referenceActions.length === 0) {
    return {
      action_match: "none",
      feasibility_match: "incorrect",
      optimality_gap: 0,
      deviation_from_reference: Number.POSITIVE_INFINITY,
      matched_reference_action_id: null,
    };
  }

  const rank = { exact: 2, partial: 1, none: 0 } as const;
  let best: {
    match: "exact" | "partial" | "none";
    deviation: number;
    ref: GroundTruthAction;
  } = {
    match: "none",
    deviation: Number.POSITIVE_INFINITY,
    ref: referenceActions[0],
  };

  for (const ref of referenceActions) {
    const s = scoreMatch(agentAction, ref);
    if (
      rank[s.match] > rank[best.match] ||
      (rank[s.match] === rank[best.match] && s.deviation < best.deviation)
    ) {
      best = { ...s, ref };
    }
  }

  const expectedFeasible = best.ref.expected_feasibility;
  const agentFeasible = agentEval.feasibility === "feasible";
  const feasibility_match: "correct" | "incorrect" =
    expectedFeasible === agentFeasible ? "correct" : "incorrect";

  const expectedImprovement = Number(best.ref.expected_violation_improvement ?? 0);
  const actualImprovement = Number(agentEval.violation_improvement ?? 0);
  const optimality_gap = expectedImprovement - actualImprovement;

  return {
    action_match: best.match,
    feasibility_match,
    optimality_gap,
    deviation_from_reference: best.deviation,
    matched_reference_action_id: best.match === "none" ? null : best.ref.id,
  };
}
