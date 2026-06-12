# DC power-flow validation

Confirms that GridArena's in-Worker DC solver (`src/server/simulation/dc-powerflow.ts`)
computes correct branch flows on the built-in cases (`case5`, `case14`, `case30`),
by comparing it against **pandapower**, a widely used reference power-system tool.

## How it works

1. `dump_dc_reference.ts` imports your real `CASES` and runs your exported
   `runDcEvaluation` with a no-op action to get **baseline** branch flows. It
   writes the case definitions *and* those flows to `tools/dc_reference.json`.
   This keeps `cases.ts` as the single source of truth — no data is duplicated.
2. `validate_dc.py` rebuilds each network in pandapower from that same JSON
   (per-unit reactances converted to line parameters on a common 100 kV base,
   lossless, slack via `ext_grid`, the slack-bus generator omitted to mirror the
   solver), runs `rundcpp`, and compares pandapower's `p_from_mw` to your flows.

## Run it (from the repo root)

```bash
bun run tools/dump_dc_reference.ts        # writes tools/dc_reference.json
pip install pandapower numpy              # one-time
python tools/validate_dc.py               # pandapower reference  <-- the one for the thesis
python tools/validate_dc.py --internal    # numpy-only cross-check (no pandapower needed)
```

`--internal` uses a second, independent DC implementation (incidence-matrix
formulation). It needs only numpy, so it is a good fast check / CI gate even
where pandapower is awkward to install.

## Reading the output

Each branch prints `GridArena_MW`, the reference `MW`, and the absolute
difference. A run **PASSES** when every branch is within
`max(tol_abs, tol_rel * |flow|)` — defaults `1e-2` MW and `0.1%`. The process
exits `0` on pass, `1` on any mismatch, so it drops straight into CI:

```yaml
# .github/workflows/ci.yml (sketch)
- run: bun run tools/dump_dc_reference.ts
- run: pip install pandapower numpy
- run: python tools/validate_dc.py
```

## What this does and does not prove

- **Does prove:** your DC solver's *numerics* are correct — its flows match a
  recognized reference (and an independent second implementation) to
  floating-point precision on the networks you actually use.
- **Does NOT prove:** that the built-in `case5/14/30` are identical to the full
  standard IEEE datasets. The cases are deliberately simplified (see the note in
  `cases.ts`). If you need that too, load the canonical cases from pandapower
  (`pandapower.networks.case30`, etc.) and reconcile parameters separately — a
  distinct task from solver validation.
- **Scope:** DC only. Voltage-magnitude and reactive-power checks require the
  AC path (`simulation-service/`, PyPSA/pandapower); validate that separately.
