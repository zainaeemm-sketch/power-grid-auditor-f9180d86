#!/usr/bin/env python3
"""
Validate GridArena's in-Worker DC power-flow solver against pandapower.

Workflow (from repo root):
    bun run tools/dump_dc_reference.ts     # writes tools/dc_reference.json
    pip install pandapower numpy           # one-time
    python tools/validate_dc.py            # pandapower reference (the one for your thesis)
    python tools/validate_dc.py --internal # numpy-only independent cross-check, no pandapower

Exit code 0 = every branch within tolerance; 1 = at least one mismatch (CI-friendly).
"""
import argparse, json, sys
import numpy as np


def load_ref(path):
    with open(path) as f:
        return json.load(f)


def slack_index(case):
    for b in case["buses"]:
        if b["type"] == "slack":
            return b["index"]
    return 0


def injections_mw(case):
    n = len(case["buses"])
    p = np.zeros(n)
    for b in case["buses"]:
        p[b["index"]] -= b["pd_mw"]
    for g in case["generators"]:
        p[g["bus"]] += g["p_mw"]
    return p


def dc_incidence(case):
    """Independent clean-room DC PF (incidence/PTDF formulation), numpy only."""
    n, m = len(case["buses"]), len(case["branches"])
    slack = slack_index(case)
    A = np.zeros((m, n)); bd = np.zeros(m)
    for k, br in enumerate(case["branches"]):
        A[k, br["from_bus"]] = 1.0
        A[k, br["to_bus"]] = -1.0
        bd[k] = 1.0 / br["x_pu"]
    Bbus = A.T @ np.diag(bd) @ A
    P = injections_mw(case) / case["base_mva"]
    keep = [i for i in range(n) if i != slack]
    theta = np.zeros(n)
    theta[keep] = np.linalg.solve(Bbus[np.ix_(keep, keep)], P[keep])
    return (np.diag(bd) @ A @ theta) * case["base_mva"]


def dc_pandapower(case):
    """Reference DC PF using pandapower, built from the SAME case data."""
    import pandapower as pp
    vn_kv = 100.0
    zbase = vn_kv ** 2 / case["base_mva"]          # ohms; x_ohm = x_pu * zbase
    net = pp.create_empty_network(sn_mva=case["base_mva"])
    busmap = {}
    for b in sorted(case["buses"], key=lambda x: x["index"]):
        busmap[b["index"]] = pp.create_bus(net, vn_kv=vn_kv, name=str(b["index"]))
    slack = slack_index(case)
    pp.create_ext_grid(net, bus=busmap[slack], vm_pu=1.0)        # slack balances
    for b in case["buses"]:
        if b.get("pd_mw"):
            pp.create_load(net, bus=busmap[b["index"]], p_mw=b["pd_mw"])
    for g in case["generators"]:
        if g["bus"] == slack:
            continue   # GridArena's solver ignores the slack-bus generator's P
        pp.create_sgen(net, bus=busmap[g["bus"]], p_mw=g["p_mw"])
    line_idx = []
    for br in case["branches"]:
        line_idx.append(pp.create_line_from_parameters(
            net, from_bus=busmap[br["from_bus"]], to_bus=busmap[br["to_bus"]],
            length_km=1.0, r_ohm_per_km=0.0,         # lossless, matching DC assumptions
            x_ohm_per_km=br["x_pu"] * zbase, c_nf_per_km=0.0, max_i_ka=10.0,
        ))
    pp.rundcpp(net)
    return np.array([net.res_line.p_from_mw.at[i] for i in line_idx])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", default="tools/dc_reference.json")
    ap.add_argument("--tol-abs", type=float, default=1e-2, help="absolute MW tolerance")
    ap.add_argument("--tol-rel", type=float, default=1e-3, help="relative tolerance")
    ap.add_argument("--internal", action="store_true",
                    help="cross-check against numpy incidence solver instead of pandapower")
    args = ap.parse_args()

    ref = load_ref(args.ref)
    label = "numpy" if args.internal else "pandapower"
    engine = "numpy-incidence (independent)" if args.internal else "pandapower DC"
    print(f"Reference engine : {engine}")
    print(f"Tolerance        : |dMW| <= max({args.tol_abs}, {args.tol_rel}*|flow|)\n")

    overall_ok, worst = True, 0.0
    for name, case in ref["cases"].items():
        ts = {lf["branch_index"]: lf for lf in case.get("ts_line_flows", [])}
        if not ts:
            print(f"[{name}] no ts_line_flows — run the dumper first. SKIPPED")
            overall_ok = False
            continue
        refflow = dc_incidence(case) if args.internal else dc_pandapower(case)
        print(f"=== {name} ===")
        print(f"{'br':>4} {'from->to':>9} {'GridArena_MW':>13} {label+'_MW':>14} {'abs_diff':>10} {'status':>6}")
        case_ok = True
        for k, br in enumerate(case["branches"]):
            tsf = ts[br["index"]]["flow_mw"]
            rf = float(refflow[k])
            d = abs(rf - tsf)
            worst = max(worst, d)
            ok = d <= max(args.tol_abs, args.tol_rel * abs(tsf))
            case_ok &= ok
            print(f"{br['index']:4d} {br['from_bus']:4d}->{br['to_bus']:<3d} "
                  f"{tsf:13.4f} {rf:14.4f} {d:10.2e} {'OK' if ok else 'FAIL':>6}")
        print(f"  -> {name}: {'PASS' if case_ok else 'FAIL'}\n")
        overall_ok &= case_ok

    print(f"Max abs flow difference across all branches: {worst:.3e} MW")
    print("RESULT:", "PASS — GridArena DC solver matches the reference."
          if overall_ok else "FAIL — see rows marked FAIL above.")
    sys.exit(0 if overall_ok else 1)


if __name__ == "__main__":
    main()
