import type { PerturbationSpec } from "./types";

/** Deterministic default perturbation set — order is fixed. */
export function getDefaultPerturbationSet(): PerturbationSpec[] {
  return [
    {
      perturbation_type: "increase_load_percent",
      parameter_name: "load_percent",
      parameter_value: 5,
      description: "Increase all bus loads by +5%",
    },
    {
      perturbation_type: "decrease_load_percent",
      parameter_name: "load_percent",
      parameter_value: -5,
      description: "Decrease all bus loads by -5%",
    },
    {
      perturbation_type: "line_outage",
      parameter_name: "line_id",
      parameter_value: 0,
      description: "Single line outage on line index 0",
    },
    {
      perturbation_type: "generator_limit_change",
      parameter_name: "generator_limit_percent",
      parameter_value: -10,
      description: "Reduce all generator p_max by 10%",
    },
    {
      perturbation_type: "voltage_setpoint_shift",
      parameter_name: "voltage_pu",
      parameter_value: 0.02,
      description: "Shift PV/slack voltage setpoints by +0.02 pu",
    },
  ];
}
