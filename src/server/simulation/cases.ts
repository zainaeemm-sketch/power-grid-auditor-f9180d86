import type { PowerSystemCase } from "./types";

/**
 * Minimal IEEE-style benchmark cases for the in-Worker DC power flow.
 * These are simplified topologies (not the full standard datasets) but are
 * deterministic and physically sane for the action types GridArena supports.
 */
export const CASES: Record<string, PowerSystemCase> = {
  case5: {
    name: "case5",
    base_mva: 100,
    buses: [
      { index: 0, type: "slack", pd_mw: 0, vm_pu: 1.0 },
      { index: 1, type: "pv", pd_mw: 300, vm_pu: 1.0 },
      { index: 2, type: "pq", pd_mw: 300, vm_pu: 1.0 },
      { index: 3, type: "pq", pd_mw: 400, vm_pu: 1.0 },
      { index: 4, type: "pv", pd_mw: 0, vm_pu: 1.0 },
    ],
    branches: [
      { index: 0, from_bus: 0, to_bus: 1, x_pu: 0.0281, rate_mw: 400 },
      { index: 1, from_bus: 0, to_bus: 3, x_pu: 0.0304, rate_mw: 400 },
      { index: 2, from_bus: 1, to_bus: 2, x_pu: 0.0064, rate_mw: 400 },
      { index: 3, from_bus: 2, to_bus: 3, x_pu: 0.0108, rate_mw: 240 },
      { index: 4, from_bus: 3, to_bus: 4, x_pu: 0.0297, rate_mw: 240 },
      { index: 5, from_bus: 1, to_bus: 4, x_pu: 0.0297, rate_mw: 240 },
    ],
    generators: [
      { index: 0, bus: 0, p_mw: 200, p_min_mw: 0, p_max_mw: 400 },
      { index: 1, bus: 1, p_mw: 200, p_min_mw: 0, p_max_mw: 170 },
      { index: 2, bus: 4, p_mw: 600, p_min_mw: 0, p_max_mw: 600 },
    ],
  },
  case14: {
    name: "case14",
    base_mva: 100,
    buses: Array.from({ length: 14 }, (_, i) => ({
      index: i,
      type: i === 0 ? "slack" : i === 1 || i === 2 || i === 5 || i === 7 ? "pv" : "pq",
      pd_mw: [0, 21.7, 94.2, 47.8, 7.6, 11.2, 0, 0, 29.5, 9, 3.5, 6.1, 13.5, 14.9][i],
      vm_pu: 1.0,
    })) as PowerSystemCase["buses"],
    branches: [
      { index: 0, from_bus: 0, to_bus: 1, x_pu: 0.05917, rate_mw: 200 },
      { index: 1, from_bus: 0, to_bus: 4, x_pu: 0.22304, rate_mw: 200 },
      { index: 2, from_bus: 1, to_bus: 2, x_pu: 0.19797, rate_mw: 100 },
      { index: 3, from_bus: 1, to_bus: 3, x_pu: 0.17632, rate_mw: 100 },
      { index: 4, from_bus: 1, to_bus: 4, x_pu: 0.17388, rate_mw: 100 },
      { index: 5, from_bus: 2, to_bus: 3, x_pu: 0.17103, rate_mw: 100 },
      { index: 6, from_bus: 3, to_bus: 4, x_pu: 0.04211, rate_mw: 100 },
      { index: 7, from_bus: 3, to_bus: 6, x_pu: 0.20912, rate_mw: 100 },
      { index: 8, from_bus: 3, to_bus: 8, x_pu: 0.55618, rate_mw: 100 },
      { index: 9, from_bus: 4, to_bus: 5, x_pu: 0.25202, rate_mw: 100 },
      { index: 10, from_bus: 5, to_bus: 10, x_pu: 0.1989, rate_mw: 50 },
      { index: 11, from_bus: 5, to_bus: 11, x_pu: 0.25581, rate_mw: 50 },
      { index: 12, from_bus: 5, to_bus: 12, x_pu: 0.13027, rate_mw: 50 },
      { index: 13, from_bus: 6, to_bus: 7, x_pu: 0.17615, rate_mw: 100 },
      { index: 14, from_bus: 6, to_bus: 8, x_pu: 0.11001, rate_mw: 100 },
      { index: 15, from_bus: 8, to_bus: 9, x_pu: 0.0845, rate_mw: 50 },
      { index: 16, from_bus: 8, to_bus: 13, x_pu: 0.27038, rate_mw: 50 },
      { index: 17, from_bus: 9, to_bus: 10, x_pu: 0.19207, rate_mw: 50 },
      { index: 18, from_bus: 11, to_bus: 12, x_pu: 0.19988, rate_mw: 50 },
      { index: 19, from_bus: 12, to_bus: 13, x_pu: 0.34802, rate_mw: 50 },
    ],
    generators: [
      { index: 0, bus: 0, p_mw: 232, p_min_mw: 0, p_max_mw: 332 },
      { index: 1, bus: 1, p_mw: 40, p_min_mw: 0, p_max_mw: 140 },
      { index: 2, bus: 2, p_mw: 0, p_min_mw: 0, p_max_mw: 100 },
      { index: 3, bus: 5, p_mw: 0, p_min_mw: 0, p_max_mw: 100 },
      { index: 4, bus: 7, p_mw: 0, p_min_mw: 0, p_max_mw: 100 },
    ],
  },
  case30: {
    name: "case30",
    base_mva: 100,
    buses: [21.7, 2.4, 7.6, 0, 94.2, 0, 22.8, 30, 0, 5.8, 0, 11.2, 0, 6.2, 8.2, 3.5, 9, 3.2, 9.5, 2.2, 17.5, 0, 3.2, 8.7, 0, 3.5, 0, 0, 2.4, 10.6].map(
      (pd, i) => ({
        index: i,
        type: i === 0 ? "slack" : [1, 12, 21, 22, 26].includes(i) ? "pv" : "pq",
        pd_mw: pd,
        vm_pu: 1.0,
      }),
    ) as PowerSystemCase["buses"],
    branches: [
      [0, 1, 0.0575], [0, 2, 0.1652], [1, 3, 0.1737], [2, 3, 0.0379], [1, 4, 0.1983],
      [1, 5, 0.1763], [3, 5, 0.0414], [4, 6, 0.116], [5, 6, 0.082], [5, 7, 0.042],
      [5, 8, 0.208], [5, 9, 0.556], [8, 10, 0.208], [8, 9, 0.11], [3, 11, 0.256],
      [11, 12, 0.14], [11, 13, 0.2559], [11, 14, 0.1304], [11, 15, 0.1987], [13, 14, 0.1997],
      [15, 16, 0.1923], [14, 17, 0.2185], [17, 18, 0.1292], [18, 19, 0.068], [9, 19, 0.209],
      [9, 16, 0.0845], [9, 20, 0.0749], [9, 21, 0.1499], [20, 21, 0.0236], [14, 22, 0.202],
      [21, 23, 0.179], [22, 23, 0.27], [23, 24, 0.3292], [24, 25, 0.38], [24, 26, 0.2087],
      [27, 26, 0.0396], [26, 28, 0.4153], [26, 29, 0.6027], [28, 29, 0.4533], [7, 27, 0.2],
      [5, 27, 0.0599],
    ].map(([f, t, x], i) => ({
      index: i,
      from_bus: f as number,
      to_bus: t as number,
      x_pu: x as number,
      rate_mw: 130,
    })),
    generators: [
      { index: 0, bus: 0, p_mw: 138.6, p_min_mw: 0, p_max_mw: 200 },
      { index: 1, bus: 1, p_mw: 57.6, p_min_mw: 0, p_max_mw: 80 },
      { index: 2, bus: 12, p_mw: 0, p_min_mw: 0, p_max_mw: 50 },
      { index: 3, bus: 21, p_mw: 24.6, p_min_mw: 0, p_max_mw: 50 },
      { index: 4, bus: 22, p_mw: 21.6, p_min_mw: 0, p_max_mw: 30 },
      { index: 5, bus: 26, p_mw: 47.0, p_min_mw: 0, p_max_mw: 55 },
    ],
  },
};

/**
 * Resolve a user-supplied case name. Accepts "case5", "ieee14", "ieee_14", etc.
 * Returns null if unknown.
 */
export function resolveCase(name: string): PowerSystemCase | null {
  if (!name) return null;
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized === "case5" || normalized === "ieee5") return CASES.case5;
  if (normalized === "case14" || normalized === "ieee14") return CASES.case14;
  if (normalized === "case30" || normalized === "ieee30") return CASES.case30;
  return null;
}
