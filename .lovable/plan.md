

## Goal
Show an automatic in-page recommendation banner on a batch detail page when its charts have zero meaningful results, suggesting users switch to a supported case (`ieee14`/`ieee30` for the built-in simulator, or `case14`/`case30` for the external PyPSA service).

## Detection logic
In `src/routes/_authenticated/batches.$batchId.tsx`, compute a `caseRecommendation` via `useMemo` from `data.runs`:

1. **Trigger conditions** (all must hold for the banner to appear):
   - At least 1 run exists and all runs have completed (`status` in `done`/`failed`).
   - Aggregate signals are empty: every run has `violation_improvement` of 0/null AND no run has any successful sensitivity or counterfactual result (check `r.sensitivity?.length`, `r.counterfactuals?.length` for entries lacking simulator output, or evaluation-skip reasons mentioning `"No simulator available"`).
2. **Case extraction**: Collect `r.run.case_name` across runs. Detect "unsupported" by matching against the known supported sets:
   - Built-in simulator: `ieee9`, `ieee14`, `ieee30`
   - External PyPSA: `case5`, `case14`, `case30`
   - If every distinct case in the batch is outside both sets → unsupported.
3. **Suggestion**: Recommend `ieee14` / `ieee30` (built-in) and `case14` / `case30` (PyPSA), with a one-line explanation referencing the unsupported case(s) actually used.

## UI
A new dismissible amber `Card` rendered just above the charts section:
- Icon: `Lightbulb` (from lucide-react, already in the dep tree).
- Title: "No simulator results — try a supported case"
- Body: "Runs in this batch used `<UNSUPPORTED>`, which neither the built-in simulator nor the PyPSA service can run. Create a new batch with `ieee14` or `ieee30` (built-in) or `case14` / `case30` (PyPSA) to populate charts."
- Primary action: `<Link to="/batches/new">New Batch</Link>` button.
- Secondary action: dismiss (`X`) — stored in `sessionStorage` keyed by `batch.id` so it stays hidden during the session but reappears in fresh sessions/other batches.

## Out of scope
- No DB schema or server-function changes.
- No changes to the new-batch form (case picker stays as-is).
- No changes to the report page (`reports.batch.$batchId.tsx`) — recommendation is on the operational batch detail page only, where users decide whether to re-run.
- Empty-state for batches with successful sims but legitimately zero improvement is not flagged (only triggers when simulator outputs are universally absent), avoiding false positives.

