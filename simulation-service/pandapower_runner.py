"""pandapower runner — loads a standard case, applies a structured action, runs PF."""
from __future__ import annotations
from typing import Any
import pandapower as pp
import pandapower.networks as pn


def _load_case(name: str):
    n = name.lower().replace("_", "").replace("-", "")
    if n in ("case5", "ieee5"):
        return pn.case5()
    if n in ("case14", "ieee14"):
        return pn.case14()
    if n in ("case30", "ieee30"):
        return pn.case30()
    raise ValueError(f"Unknown case: {name}")


def _violations(net) -> tuple[int, list, list, list]:
    line_loadings = []
    overloads = 0
    if "loading_percent" in net.res_line.columns:
        for idx, row in net.res_line.iterrows():
            loading = float(row["loading_percent"]) if row["loading_percent"] == row["loading_percent"] else 0.0
            overloaded = loading > 100.0
            if overloaded:
                overloads += 1
            line_loadings.append({
                "branch_index": int(idx),
                "from_bus": int(net.line.at[idx, "from_bus"]),
                "to_bus": int(net.line.at[idx, "to_bus"]),
                "flow_mw": float(row.get("p_from_mw", 0.0)),
                "rate_mw": float(net.line.at[idx, "max_i_ka"] * net.bus.at[net.line.at[idx, "from_bus"], "vn_kv"] * 1.732),
                "loading_pct": round(loading, 2),
                "overloaded": overloaded,
            })

    voltage_violations = []
    for idx, row in net.res_bus.iterrows():
        vm = float(row["vm_pu"]) if row["vm_pu"] == row["vm_pu"] else 1.0
        if vm < 0.95:
            voltage_violations.append({"bus_index": int(idx), "vm_pu": round(vm, 4), "type": "low"})
        elif vm > 1.05:
            voltage_violations.append({"bus_index": int(idx), "vm_pu": round(vm, 4), "type": "high"})

    gen_violations = []
    for idx, row in net.gen.iterrows():
        p = float(net.res_gen.at[idx, "p_mw"]) if idx in net.res_gen.index else float(row["p_mw"])
        if p < float(row.get("min_p_mw", 0)) - 1e-3:
            gen_violations.append({"generator_index": int(idx), "bus": int(row["bus"]), "p_mw": round(p, 2), "type": "below_min"})
        elif p > float(row.get("max_p_mw", 1e9)) + 1e-3:
            gen_violations.append({"generator_index": int(idx), "bus": int(row["bus"]), "p_mw": round(p, 2), "type": "above_max"})

    return overloads + len(voltage_violations) + len(gen_violations), line_loadings, voltage_violations, gen_violations


def _apply(net, action: dict[str, Any]) -> None:
    if not action.get("enabled") or not action.get("action_type") or action["action_type"] == "none":
        return
    at = action["action_type"]
    if at == "scale_all_loads" and action.get("value") is not None:
        net.load["p_mw"] = net.load["p_mw"] * float(action["value"])
        net.load["q_mvar"] = net.load["q_mvar"] * float(action["value"])
    elif at == "set_generator_p_mw" and action.get("target_index") is not None and action.get("value") is not None:
        idx = int(action["target_index"])
        if idx in net.gen.index:
            net.gen.at[idx, "p_mw"] = float(action["value"])
    elif at == "line_outage" and action.get("target_index") is not None:
        idx = int(action["target_index"])
        if idx in net.line.index:
            net.line.at[idx, "in_service"] = False


def simulate_action(case_name: str, action: dict[str, Any]) -> dict[str, Any]:
    base = _load_case(case_name)
    try:
        pp.runpp(base, numba=False)
    except Exception as e:
        raise RuntimeError(f"Baseline PF failed: {e}")
    baseline_violations, _, _, _ = _violations(base)

    post = _load_case(case_name)
    _apply(post, action)
    feasibility = "feasible"
    try:
        pp.runpp(post, numba=False)
    except Exception:
        feasibility = "infeasible"
        return {
            "feasibility": "infeasible",
            "baseline_violations": baseline_violations,
            "post_action_violations": baseline_violations + 5,
            "violations_found": baseline_violations + 5,
            "violation_improvement": -5,
            "line_loadings": [],
            "voltage_violations": [],
            "generator_violations": [],
            "notes": "pandapower Newton-Raphson did not converge after action.",
        }

    post_violations, line_loadings, voltage_violations, gen_violations = _violations(post)
    if not action.get("enabled") or action.get("action_type") in (None, "none"):
        feasibility = "not_applicable"
    elif post_violations > baseline_violations + 2:
        feasibility = "infeasible"

    return {
        "feasibility": feasibility,
        "baseline_violations": baseline_violations,
        "post_action_violations": post_violations,
        "violations_found": post_violations,
        "violation_improvement": baseline_violations - post_violations,
        "line_loadings": line_loadings,
        "voltage_violations": voltage_violations,
        "generator_violations": gen_violations,
        "notes": f"pandapower AC power flow on {case_name}: {len(line_loadings)} lines analyzed.",
    }
