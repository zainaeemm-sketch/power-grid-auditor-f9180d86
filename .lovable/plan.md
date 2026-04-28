# Answer: no new API key is needed for these graphs

The missing chart results are not caused by a missing API key. Your project already has:

- LLM configuration present
- simulator configuration present
- simulator health check passing

The current batch is empty-looking because the data it produced has no measurable values:

```text
Batch: Test
Runs: 1
Agent: Power agent
Case: IEEE4
Evaluation: not_applicable
Violation improvement: 0
Action applied: No action applied
Reason: No valid structured action was parsed from the recommendation
```

There are two practical reasons this produced no usable graph values:

1. **`IEEE4` is not a supported simulator case.** The app supports `case5`, `case14`, and `case30` for built-in/simulation-backed results. Perturbation and counterfactual results for this batch also show: no simulator available for `IEEE4`.
2. **The recommendation was not parsed into a structured action.** The evaluator only produces meaningful improvement/feasibility numbers when the LLM output contains a recognizable action such as:
   - `scale all loads by 0.90`
   - `reduce all loads by 10%`
   - `set generator 1 to 80 MW`
   - `line outage 6`

So the fastest way to get graph results today is:

```text
Create a new batch with:
Agents: poweragent, powerfm, gridgpt
Cases: case5, case14, case30
Preset/evaluation: simulation
Prompt/task: Ask each agent to return exactly one supported action, e.g. scale_all_loads or set_generator_p_mw.
```

That will create multiple completed runs with nonzero or at least measurable values, so the four charts can compare agents and cases.

# Implementation plan to make this reliable

## 1. Make batch runs use the simulator path, not only rule-based scoring

Update run execution so after the LLM response is parsed, it calls the shared evaluator with the run’s configured `evaluation_mode`:

```text
LLM response → parser → evaluateWithSimulation(parseResult, caseName, evaluationMode)
```

This ensures batch graphs are based on real simulation-backed outputs when the batch/preset uses `simulation` or `auto`.

## 2. Add batch form controls that guide users toward result-producing batches

On **Create Batch Experiment**:

- Add an **Evaluation Mode** selector with `simulation` as the default.
- Keep `rule_based` available, but make it explicit that it is heuristic.
- Validate manually typed benchmark cases before creating the batch.
- Allow only supported cases for now: `case5`, `case14`, `case30`.

This prevents new batches like `IEEE4` from being created and then producing unusable graph metrics.

## 3. Improve the generated prompt for batch runs

When creating each batch run, store a prompt that explicitly asks for one parser-compatible structured action, for example:

```text
Return exactly one corrective action using one of these formats:
- scale all loads by 0.90
- reduce all loads by 10%
- set generator 1 to 80 MW
- line outage 6

Do not only explain; include the exact action sentence.
```

This directly fixes the current issue where the LLM response could not be parsed, causing `No action applied` and zero graph results.

## 4. Add a “result-producing benchmark batch” helper

Add a button or preset suggestion that creates a reliable demo/research batch:

```text
Agents: poweragent, powerfm, gridgpt
Cases: case5, case14, case30
Evaluation mode: simulation
Task: robustness/load-scaling comparison
```

This gives you chart-ready data for debate without manually tuning all fields.

## 5. Keep the charts as real-result charts

Do not replace the charts with empty-state cards. The fix is to make upstream runs produce valid data. The charts will then show:

- violation improvement by agent
- feasibility rate by agent
- confidence vs grounding
- case-level performance

# Expected result

After these changes, creating and executing a supported multi-agent batch should populate the graphs with actual comparative values, instead of zero-height bars from unsupported/unparsed runs.

# Files to update

- `src/server/llm.functions.ts`
- `src/server/batch.functions.ts`
- `src/routes/_authenticated/batches.new.tsx`
- possibly `src/lib/allowed-values.ts` if we want to expand supported cases later
