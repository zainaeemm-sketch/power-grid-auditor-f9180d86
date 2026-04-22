"""
GridArena PyPSA-based simulation runner.

Builds IEEE-style transmission test cases (case5, case14, case30) directly as
PyPSA networks and runs DC power flow. Returns a JSON shape compatible with
GridArena's TypeScript external-client.ts contract:

  {
    "feasibility": "feasible" | "infeasible",
    "baseline_violations": int,
    "post_action_violations": int,
    "violations_found": int,         # alias for post_action
    "violation_improvement": int,    # baseline - post_action
    "line_loadings": [{"index": i, "loading_percent": float}, ...],
    "voltage_violations": [],        # DC PF assumes flat voltages
    "generator_violations": [{"index": i, "p_mw": float, "p_max_mw": float}, ...],
    "engine": "pypsa",
    "notes": "..."
  }
"""
from __future__ import annotations

from typing import Any, Optional
import math
import warnings

import numpy as np
import pandas as pd
import pypsa

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=DeprecationWarning)


# ---------------------------------------------------------------------------
# Case builders — programmatic IEEE cases, no external file dependencies.
# Values are taken from the standard MATPOWER case data (per-unit on 100 MVA).
# Line ratings (s_nom) are sized so the baseline is feasible but tight enough
# that a 10–20 % load scale change produces visible loading deltas.
# ---------------------------------------------------------------------------

S_BASE = 100.0  # MVA


def _new_network() -> pypsa.Network:
    n = pypsa.Network()
    n.set_snapshots(["now"])
    return n


def _build_case5() -> pypsa.Network:
    """PJM 5-bus."""
    n = _new_network()
    # Buses
    for i in range(1, 6):
        n.add("Bus", f"bus_{i}", v_nom=230.0)
    # Loads (MW) at buses 2,3,4
    loads = {2: 300.0, 3: 300.0, 4: 400.0}
    for bus, p in loads.items():
        n.add("Load", f"load_{bus}", bus=f"bus_{bus}", p_set=p)
    # Generators (p_nom = max MW, marginal_cost arbitrary but positive)
    gens = [
        (1, 40.0, 14.0),
        (1, 170.0, 15.0),
        (3, 520.0, 30.0),
        (4, 200.0, 40.0),
        (5, 600.0, 10.0),
    ]
    for idx, (bus, p_nom, mc) in enumerate(gens):
        n.add(
            "Generator",
            f"gen_{idx}",
            bus=f"bus_{bus}",
            p_nom=p_nom,
            p_set=0.0,
            marginal_cost=mc,
            control="PV" if idx > 0 else "Slack",
        )
    # Lines: (from, to, x[pu], s_nom[MW])
    lines = [
        (1, 2, 0.0281, 400.0),
        (1, 4, 0.0304, 400.0),
        (1, 5, 0.0064, 400.0),
        (2, 3, 0.0108, 400.0),
        (3, 4, 0.0297, 400.0),
        (4, 5, 0.0297, 240.0),
    ]
    for idx, (f, t, x, s_nom) in enumerate(lines):
        n.add(
            "Line",
            f"line_{idx}",
            bus0=f"bus_{f}",
            bus1=f"bus_{t}",
            x=x,
            r=0.0,
            s_nom=s_nom,
        )
    return n


def _build_case14() -> pypsa.Network:
    """IEEE 14-bus (simplified DC topology, MATPOWER values)."""
    n = _new_network()
    for i in range(1, 15):
        n.add("Bus", f"bus_{i}", v_nom=138.0)
    loads = {
        2: 21.7, 3: 94.2, 4: 47.8, 5: 7.6, 6: 11.2, 9: 29.5,
        10: 9.0, 11: 3.5, 12: 6.1, 13: 13.5, 14: 14.9,
    }
    for bus, p in loads.items():
        n.add("Load", f"load_{bus}", bus=f"bus_{bus}", p_set=p)
    gens = [
        (1, 332.4, 20.0, "Slack"),
        (2, 140.0, 25.0, "PV"),
        (3, 100.0, 40.0, "PV"),
        (6, 100.0, 40.0, "PV"),
        (8, 100.0, 40.0, "PV"),
    ]
    for idx, (bus, p_nom, mc, ctrl) in enumerate(gens):
        n.add(
            "Generator",
            f"gen_{idx}",
            bus=f"bus_{bus}",
            p_nom=p_nom,
            p_set=0.0,
            marginal_cost=mc,
            control=ctrl,
        )
    lines = [
        (1, 2, 0.05917, 200.0),
        (1, 5, 0.22304, 120.0),
        (2, 3, 0.19797, 120.0),
        (2, 4, 0.17632, 120.0),
        (2, 5, 0.17388, 120.0),
        (3, 4, 0.17103, 120.0),
        (4, 5, 0.04211, 120.0),
        (4, 7, 0.20912, 80.0),
        (4, 9, 0.55618, 80.0),
        (5, 6, 0.25202, 80.0),
        (6, 11, 0.1989, 60.0),
        (6, 12, 0.25581, 60.0),
        (6, 13, 0.13027, 60.0),
        (7, 8, 0.17615, 80.0),
        (7, 9, 0.11001, 80.0),
        (9, 10, 0.0845, 60.0),
        (9, 14, 0.27038, 60.0),
        (10, 11, 0.19207, 60.0),
        (12, 13, 0.19988, 60.0),
        (13, 14, 0.34802, 60.0),
    ]
    for idx, (f, t, x, s_nom) in enumerate(lines):
        n.add(
            "Line",
            f"line_{idx}",
            bus0=f"bus_{f}",
            bus1=f"bus_{t}",
            x=x,
            r=0.0,
            s_nom=s_nom,
        )
    return n


def _build_case30() -> pypsa.Network:
    """IEEE 30-bus (MATPOWER topology, simplified)."""
    n = _new_network()
    for i in range(1, 31):
        n.add("Bus", f"bus_{i}", v_nom=132.0)
    loads = {
        2: 21.7, 3: 2.4, 4: 7.6, 5: 94.2, 7: 22.8, 8: 30.0,
        10: 5.8, 12: 11.2, 14: 6.2, 15: 8.2, 16: 3.5, 17: 9.0,
        18: 3.2, 19: 9.5, 20: 2.2, 21: 17.5, 23: 3.2, 24: 8.7,
        26: 3.5, 29: 2.4, 30: 10.6,
    }
    for bus, p in loads.items():
        n.add("Load", f"load_{bus}", bus=f"bus_{bus}", p_set=p)
    gens = [
        (1, 80.0, 20.0, "Slack"),
        (2, 80.0, 25.0, "PV"),
        (5, 50.0, 30.0, "PV"),
        (8, 35.0, 35.0, "PV"),
        (11, 30.0, 40.0, "PV"),
        (13, 40.0, 40.0, "PV"),
    ]
    for idx, (bus, p_nom, mc, ctrl) in enumerate(gens):
        n.add(
            "Generator",
            f"gen_{idx}",
            bus=f"bus_{bus}",
            p_nom=p_nom,
            p_set=0.0,
            marginal_cost=mc,
            control=ctrl,
        )
    lines = [
        (1, 2, 0.0575, 130.0), (1, 3, 0.1852, 130.0), (2, 4, 0.1737, 65.0),
        (3, 4, 0.0379, 130.0), (2, 5, 0.1983, 130.0), (2, 6, 0.1763, 65.0),
        (4, 6, 0.0414, 90.0), (5, 7, 0.116, 70.0), (6, 7, 0.082, 130.0),
        (6, 8, 0.042, 32.0), (6, 9, 0.208, 65.0), (6, 10, 0.556, 32.0),
        (9, 11, 0.208, 65.0), (9, 10, 0.11, 65.0), (4, 12, 0.256, 65.0),
        (12, 13, 0.14, 65.0), (12, 14, 0.2559, 32.0), (12, 15, 0.1304, 32.0),
        (12, 16, 0.1987, 32.0), (14, 15, 0.1997, 16.0), (16, 17, 0.1923, 16.0),
        (15, 18, 0.2185, 16.0), (18, 19, 0.1292, 16.0), (19, 20, 0.068, 32.0),
        (10, 20, 0.209, 32.0), (10, 17, 0.0845, 32.0), (10, 21, 0.0749, 32.0),
        (10, 22, 0.1499, 32.0), (21, 22, 0.0236, 32.0), (15, 23, 0.202, 16.0),
        (22, 24, 0.179, 16.0), (23, 24, 0.27, 16.0), (24, 25, 0.3292, 16.0),
        (25, 26, 0.38, 16.0), (25, 27, 0.2087, 16.0), (28, 27, 0.396, 65.0),
        (27, 29, 0.4153, 16.0), (27, 30, 0.6027, 16.0), (29, 30, 0.4533, 16.0),
        (8, 28, 0.2, 32.0), (6, 28, 0.0599, 32.0),
    ]
    for idx, (f, t, x, s_nom) in enumerate(lines):
        n.add(
            "Line",
            f"line_{idx}",
            bus0=f"bus_{f}",
            bus1=f"bus_{t}",
            x=x,
            r=0.0,
            s_nom=s_nom,
        )
    return n


_CASE_BUILDERS = {
    "case5": _build_case5,
    "case14": _build_case14,
    "case30": _build_case30,
}


def _load_case(case_name: str) -> pypsa.Network:
    name = (case_name or "").lower().strip()
    if name not in _CASE_BUILDERS:
        raise ValueError(
            f"Unknown case '{case_name}'. Supported: {sorted(_CASE_BUILDERS)}"
        )
    return _CASE_BUILDERS[name]()


# ---------------------------------------------------------------------------
# Dispatch helpers — pick a feasible generator dispatch before each PF, since
# our networks have p_set=0 by default.
# ---------------------------------------------------------------------------

def _set_economic_dispatch(n: pypsa.Network) -> None:
    """Greedy merit-order dispatch to cover total load. DC, lossless."""
    total_load = float(n.loads["p_set"].sum())
    gens = n.generators.copy()
    gens = gens.sort_values("marginal_cost")
    remaining = total_load
    p_set = {name: 0.0 for name in gens.index}
    for name, row in gens.iterrows():
        if remaining <= 0:
            break
        take = min(remaining, float(row["p_nom"]))
        p_set[name] = take
        remaining -= take
    # If load exceeds capacity, push the slack to its max — PF will still solve
    # but generator violation will be reported.
    if remaining > 0 and len(gens) > 0:
        slack_candidates = gens[gens["control"] == "Slack"]
        slack_name = slack_candidates.index[0] if len(slack_candidates) else gens.index[0]
        p_set[slack_name] += remaining
    for name, value in p_set.items():
        n.generators.at[name, "p_set"] = value


# ---------------------------------------------------------------------------
# Action application
# ---------------------------------------------------------------------------

def _apply_action(n: pypsa.Network, action: dict[str, Any]) -> str:
    """Mutate network in place. Returns a human-readable note."""
    if not action or not action.get("enabled", True):
        return "no action applied"
    a_type = (action.get("action_type") or "").strip()
    target = action.get("target_index")
    value = action.get("value")

    if a_type == "" or a_type == "none":
        return "no action applied"

    if a_type == "scale_all_loads":
        factor = float(value) if value is not None else 1.0
        n.loads["p_set"] = n.loads["p_set"] * factor
        return f"scaled all loads by {factor}"

    if a_type == "set_generator_p_mw":
        if target is None or value is None:
            return "set_generator_p_mw missing target_index/value"
        gen_names = list(n.generators.index)
        if not (0 <= int(target) < len(gen_names)):
            return f"generator index {target} out of range (have {len(gen_names)})"
        gname = gen_names[int(target)]
        n.generators.at[gname, "p_set"] = float(value)
        return f"set {gname} p_set = {float(value)} MW"

    if a_type == "line_outage":
        if target is None:
            return "line_outage missing target_index"
        line_names = list(n.lines.index)
        if not (0 <= int(target) < len(line_names)):
            return f"line index {target} out of range (have {len(line_names)})"
        lname = line_names[int(target)]
        # Take line out by setting s_nom huge negative impedance trick won't
        # work; instead drop the line from the network entirely.
        n.remove("Line", lname)
        return f"removed {lname} (line outage)"

    if a_type == "shed_load":
        # value = MW to shed, distributed proportionally
        if value is None:
            return "shed_load missing value"
        shed = float(value)
        total = float(n.loads["p_set"].sum())
        if total <= 0:
            return "no load to shed"
        scale = max(0.0, 1.0 - shed / total)
        n.loads["p_set"] = n.loads["p_set"] * scale
        return f"shed {shed} MW (scale {scale:.3f})"

    return f"unknown action_type '{a_type}' — ignored"


# ---------------------------------------------------------------------------
# Perturbations
# ---------------------------------------------------------------------------

def _apply_perturbation(n: pypsa.Network, spec: dict[str, Any]) -> str:
    if not spec:
        return "no perturbation"
    p_type = (spec.get("perturbation_type") or "").strip()
    val = spec.get("parameter_value")

    if p_type in ("load_increase", "load_scale"):
        factor = float(val) if val is not None else 1.0
        n.loads["p_set"] = n.loads["p_set"] * factor
        return f"perturb: scaled loads by {factor}"

    if p_type == "line_rating_decrease":
        factor = float(val) if val is not None else 0.9
        n.lines["s_nom"] = n.lines["s_nom"] * factor
        return f"perturb: scaled all line ratings by {factor}"

    if p_type == "generator_outage":
        idx = spec.get("parameter_value")
        gen_names = list(n.generators.index)
        if idx is None or not (0 <= int(idx) < len(gen_names)):
            return f"perturb: generator index {idx} out of range"
        gname = gen_names[int(idx)]
        n.remove("Generator", gname)
        return f"perturb: removed {gname}"

    return f"perturb: unknown type '{p_type}' — ignored"


# ---------------------------------------------------------------------------
# Power flow + violation counting
# ---------------------------------------------------------------------------

def _run_dc_pf(n: pypsa.Network) -> tuple[bool, str]:
    """Returns (converged, notes)."""
    try:
        n.lpf()
        return True, "lpf ok"
    except Exception as e:  # noqa: BLE001
        return False, f"lpf failed: {e}"


def _evaluate(n: pypsa.Network) -> dict[str, Any]:
    """Count line and generator violations from the last PF result."""
    line_loadings: list[dict[str, Any]] = []
    line_violations = 0
    if len(n.lines) > 0 and "now" in n.lines_t.p0.index:
        flows = n.lines_t.p0.loc["now"]
        for i, lname in enumerate(n.lines.index):
            s_nom = float(n.lines.at[lname, "s_nom"]) or 1.0
            flow = float(flows.get(lname, 0.0))
            loading = abs(flow) / s_nom * 100.0
            line_loadings.append(
                {"index": i, "name": lname, "loading_percent": round(loading, 2)}
            )
            if loading > 100.0:
                line_violations += 1

    gen_violations: list[dict[str, Any]] = []
    for i, gname in enumerate(n.generators.index):
        p_set = float(n.generators.at[gname, "p_set"])
        p_max = float(n.generators.at[gname, "p_nom"])
        if p_set > p_max + 1e-6 or p_set < -1e-6:
            gen_violations.append(
                {
                    "index": i,
                    "name": gname,
                    "p_mw": round(p_set, 2),
                    "p_max_mw": round(p_max, 2),
                }
            )

    total = line_violations + len(gen_violations)
    return {
        "violations": total,
        "line_violations": line_violations,
        "line_loadings": line_loadings,
        "voltage_violations": [],  # DC PF: flat 1.0 pu assumed
        "generator_violations": gen_violations,
    }


def _result_payload(
    case_name: str,
    baseline_violations: int,
    post_violations: int,
    eval_post: dict[str, Any],
    feasibility: str,
    notes: str,
) -> dict[str, Any]:
    return {
        "feasibility": feasibility,
        "baseline_violations": int(baseline_violations),
        "post_action_violations": int(post_violations),
        "violations_found": int(post_violations),
        "violation_improvement": int(baseline_violations - post_violations),
        "line_loadings": eval_post["line_loadings"],
        "voltage_violations": eval_post["voltage_violations"],
        "generator_violations": eval_post["generator_violations"],
        "engine": "pypsa",
        "case_name": case_name,
        "notes": notes,
    }


# ---------------------------------------------------------------------------
# Public entry points used by main.py
# ---------------------------------------------------------------------------

def simulate_action(case_name: str, action: dict[str, Any]) -> dict[str, Any]:
    # Baseline
    n_base = _load_case(case_name)
    _set_economic_dispatch(n_base)
    ok_b, note_b = _run_dc_pf(n_base)
    if not ok_b:
        eval_empty = {"violations": 0, "line_loadings": [], "voltage_violations": [], "generator_violations": []}
        return _result_payload(case_name, 0, 0, eval_empty, "infeasible", f"baseline {note_b}")
    base_eval = _evaluate(n_base)

    # Post-action
    n_post = _load_case(case_name)
    _set_economic_dispatch(n_post)
    action_note = _apply_action(n_post, action)
    # Re-dispatch after load changes so we don't carry stale p_set
    if (action.get("action_type") if action else None) in ("scale_all_loads", "shed_load"):
        _set_economic_dispatch(n_post)
    ok_p, note_p = _run_dc_pf(n_post)
    if not ok_p:
        return _result_payload(
            case_name,
            base_eval["violations"],
            base_eval["violations"],
            base_eval,
            "infeasible",
            f"action={action_note}; post {note_p}",
        )
    post_eval = _evaluate(n_post)
    feasibility = "feasible" if post_eval["violations"] == 0 else "infeasible"
    return _result_payload(
        case_name,
        base_eval["violations"],
        post_eval["violations"],
        post_eval,
        feasibility,
        f"action={action_note}",
    )


def simulate_perturbed(
    case_name: str,
    action: dict[str, Any],
    perturbation: dict[str, Any],
) -> dict[str, Any]:
    """Run baseline (action only, no perturbation) and perturbed (perturbation + action)."""
    baseline_result = simulate_action(case_name, action)

    # Perturbed network
    n = _load_case(case_name)
    pert_note = _apply_perturbation(n, perturbation)
    _set_economic_dispatch(n)
    ok_b, note_b = _run_dc_pf(n)
    if not ok_b:
        eval_empty = {"violations": 0, "line_loadings": [], "voltage_violations": [], "generator_violations": []}
        perturbed_result = _result_payload(
            case_name, 0, 0, eval_empty, "infeasible",
            f"{pert_note}; baseline {note_b}",
        )
        return {"baseline": baseline_result, "perturbed": perturbed_result}
    base_eval = _evaluate(n)

    n2 = _load_case(case_name)
    _apply_perturbation(n2, perturbation)
    _set_economic_dispatch(n2)
    action_note = _apply_action(n2, action)
    if (action.get("action_type") if action else None) in ("scale_all_loads", "shed_load"):
        _set_economic_dispatch(n2)
    ok_p, note_p = _run_dc_pf(n2)
    if not ok_p:
        perturbed_result = _result_payload(
            case_name, base_eval["violations"], base_eval["violations"], base_eval,
            "infeasible", f"{pert_note}; action={action_note}; post {note_p}",
        )
        return {"baseline": baseline_result, "perturbed": perturbed_result}
    post_eval = _evaluate(n2)
    feasibility = "feasible" if post_eval["violations"] == 0 else "infeasible"
    perturbed_result = _result_payload(
        case_name,
        base_eval["violations"],
        post_eval["violations"],
        post_eval,
        feasibility,
        f"{pert_note}; action={action_note}",
    )
    return {"baseline": baseline_result, "perturbed": perturbed_result}
