export type EvaluationMode = "rule_based" | "simulation" | "auto";
export type SimulationEngine = "rule_based" | "dc_powerflow" | "pandapower";

export interface PowerSystemBus {
  /** 0-based bus index */
  index: number;
  /** "slack" | "pv" | "pq" */
  type: "slack" | "pv" | "pq";
  /** load demand in MW (positive = consumption) */
  pd_mw: number;
  /** nominal voltage magnitude (pu) */
  vm_pu: number;
}

export interface PowerSystemBranch {
  index: number;
  from_bus: number;
  to_bus: number;
  /** series reactance in pu (DC PF uses only x) */
  x_pu: number;
  /** thermal rating in MW */
  rate_mw: number;
}

export interface PowerSystemGenerator {
  index: number;
  bus: number;
  /** dispatched real power in MW */
  p_mw: number;
  p_min_mw: number;
  p_max_mw: number;
}

export interface PowerSystemCase {
  name: string;
  base_mva: number;
  buses: PowerSystemBus[];
  branches: PowerSystemBranch[];
  generators: PowerSystemGenerator[];
}

export interface StructuredAction {
  action_type: string | null;
  target_index: number | null;
  value: number | null;
  enabled: boolean;
}

export interface LineLoading {
  branch_index: number;
  from_bus: number;
  to_bus: number;
  flow_mw: number;
  rate_mw: number;
  loading_pct: number;
  overloaded: boolean;
}

export interface VoltageViolation {
  bus_index: number;
  vm_pu: number;
  type: "low" | "high";
}

export interface GeneratorViolation {
  generator_index: number;
  bus: number;
  p_mw: number;
  type: "below_min" | "above_max";
}

export interface SimulationResult {
  engine: SimulationEngine;
  feasibility: "feasible" | "infeasible" | "not_applicable";
  baseline_violations: number;
  post_action_violations: number;
  violations_found: number;
  violation_improvement: number;
  line_loadings: LineLoading[];
  voltage_violations: VoltageViolation[];
  generator_violations: GeneratorViolation[];
  notes: string;
}
