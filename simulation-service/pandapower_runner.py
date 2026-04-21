"""pandapower runner — loads a standard case, applies structured actions and
optional perturbation specs, runs PF, and reports violations."""
from __future__ import annotations
from typing import Any, Optional
import numpy as np
import pandas as pd
import pandapower as pp
import pandapower.networks as pn


def _make_writable(net) -> None:
    """Some pandapower/numpy combinations return DataFrames backed by read-only
    numpy arrays (cached network defs). Power-flow then crashes with
    'assignment destination is read-only'. Force a writable copy."""
    for attr in dir(net):
        if attr.startswith("_"):
            continue
        try:
            df = getattr(net, attr)
        except Exception:
            continue
        if isinstance(df, pd.DataFrame) and not df.empty:
            for col in df.columns:
                try:
                    arr = df[col].values
                    if isinstance(arr, np.ndarray) and not arr.flags.writeable:
                        df[col] = arr.copy()
                except Exception:
                    pass


def _load_case(name: str):
    n = name.lower().replace("_", "").replace("-", "")
    if n in ("case5", "ieee5"):
        net = pn.case5()
    elif n in ("case9", "ieee9"):
        net = pn.case9()
    elif n in ("case14", "ieee14"):
        net = pn.case14()
    elif n in ("case30", "ieee30"):
        net = pn.case30()
    elif n in ("case39", "ieee39", "case39ieee"):
        net = pn.case39()
    elif n in ("case57", "ieee57"):
        net = pn.case57()
    elif n in ("case118", "ieee118"):
        net = pn.case118()
    else:
        raise ValueError(f"Unknown case: {name}")
    _make_writable(net)
    return net


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


def _apply_perturbation(net, spec: dict[str, Any]) -> None:
    """Mutate net in-place per the perturbation spec (line outage, load scaling, etc)."""
    ptype = (spec.get("perturbation_type") or "").lower()
    val = spec.get("parameter_value")
    v = float(val) if val is not None else 0.0

    if ptype in ("increase_load_percent", "decrease_load_percent"):
        factor = 1.0 + v / 100.0
        net.load["p_mw"] = net.load["p_mw"] * factor
        net.load["q_mvar"] = net.load["q_mvar"] * factor
    elif ptype in ("line_outage", "n1_contingency"):
        idx = int(round(v))
        if idx in net.line.index:
            net.line.at[idx, "in_service"] = False
    elif ptype == "line_restoration":
        idx = int(round(v))
        if idx in net.line.index:
            net.line.at[idx, "in_service"] = True
    elif ptype == "generator_limit_change":
        factor = 1.0 + v / 100.0
        if "max_p_mw" in net.gen.columns:
            net.gen["max_p_mw"] = net.gen["max_p_mw"] * factor
            net.gen["p_mw"] = net.gen[["p_mw", "max_p_mw"]].min(axis=1)
    elif ptype == "generator_dispatch_change":
        factor = 1.0 + v / 100.0
        net.gen["p_mw"] = net.gen["p_mw"] * factor
    elif ptype == "voltage_setpoint_shift":
        if "vm_pu" in net.gen.columns:
            net.gen["vm_pu"] = net.gen["vm_pu"] + v
    # unknown types: no-op


def _evaluate(net, baseline_violations: int, action_enabled: bool, action_type: Optional[str], case_name: str) -> dict[str, Any]:
    feasibility = "feasible"
    try:
        pp.runpp(net, numba=False)
    except Exception:
        return {
            "feasibility": "infeasible",
            "baseline_violations": baseline_violations,
            "post_action_violations": baseline_violations + 5,
            "violations_found": baseline_violations + 5,
            "violation_improvement": -5,
            "line_loadings": [],
            "voltage_violations": [],
            "generator_violations": [],
            "notes": "pandapower Newton-Raphson did not converge.",
        }

    post_violations, line_loadings, voltage_violations, gen_violations = _violations(net)
    if not action_enabled or action_type in (None, "none"):
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


def simulate_action(case_name: str, action: dict[str, Any]) -> dict[str, Any]:
    base = _load_case(case_name)
    try:
        pp.runpp(base, numba=False)
    except Exception as e:
        raise RuntimeError(f"Baseline PF failed: {e}")
    baseline_violations, _, _, _ = _violations(base)

    post = _load_case(case_name)
    _apply(post, action)
    return _evaluate(post, baseline_violations, bool(action.get("enabled")), action.get("action_type"), case_name)


def simulate_perturbed(case_name: str, action: dict[str, Any], perturbation: dict[str, Any]) -> dict[str, Any]:
    """Apply perturbation + action together, then evaluate vs un-perturbed baseline (with same action)."""
    # Baseline: action only, no perturbation
    base_with_action = _load_case(case_name)
    _apply(base_with_action, action)
    baseline_pre = _load_case(case_name)
    try:
        pp.runpp(baseline_pre, numba=False)
    except Exception as e:
        raise RuntimeError(f"Baseline PF failed: {e}")
    pre_violations, _, _, _ = _violations(baseline_pre)
    baseline = _evaluate(base_with_action, pre_violations, bool(action.get("enabled")), action.get("action_type"), case_name)

    # Perturbed: perturbation + action
    perturbed_net = _load_case(case_name)
    _apply_perturbation(perturbed_net, perturbation)
    _apply(perturbed_net, action)
    perturbed = _evaluate(perturbed_net, pre_violations, bool(action.get("enabled")), action.get("action_type"), case_name)

    return {"baseline": baseline, "perturbed": perturbed}
