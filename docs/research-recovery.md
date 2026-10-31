# Recover the conference pilot before extending it

Source audited: `zainaeemm-sketch/power-grid-auditor-f9180d86`, original
commit `fc80f3e280e4ae3df42cc0d16d7d726d34cf8121`.
The simulator repository `zainaeemm-sketch/gridarena-sim` was also inspected.
This audit concerns those source versions; it does not establish which
commit is deployed or which code generated the conference pilot.

## What to do first

1. Open the GridArena deployment you used for the paper. This repository's
   README links to `https://gridarena.eu`.
2. Open **Runs** (`/runs`) and identify the original eight scored runs. Keep
   their full IDs and dates. Include failed or unscored attempts in a separate
   set so the eight scored runs are not mistaken for all attempted calls.
3. On the existing app, open each original run and click **Export Run CSV**.
   The current report page also has CSV export. These files are a useful
   first recovery step; the CSV does not contain every record needed for the
   paper's oracle claims.
4. After this branch is integrated and deployed, use **Export Research JSON**
   on a run, or **Research JSON** on its report page. Export the original
   records before initiating any rerun. Each file contains the fetched run,
   metadata, raw prompt and response, recommendation, parse, evaluation,
   reference scenario/actions, and optional language-model judgment.
5. Download decision/tool traces and any optimizer records from the version
   that actually produced the paper's results. These are outside this JSON
   export's declared scope. In this checkout I could not locate the claimed
   four-objective DC-OPF oracle or associated tables.

The JSON exporter performs no database writes, inference calls, simulation,
backfill, or score recomputation. It flags missing fields/sections and keeps
unknown verdicts and zero/false values. Missing data is not reconstructed.
The exporter version is not evidence of the historical simulator version.

## Source findings that must be resolved

| Paper-related claim | Inspected code | Consequence |
| --- | --- | --- |
| Four-objective DC-OPF oracle | No such implementation was located in this checkout, the other two accessible application main-branch trees, or the standalone simulator. | Recover the oracle code/version before making an implementation or optimum claim. Absence from these copies is not proof that no separate version exists. |
| `optimality_gap` | `src/server/ground-truth/compare.ts` subtracts observed violation improvement from a stored reference action's expected violation improvement. | This code path computes a difference in counts against a stored reference; it does not certify an OPF optimum. It does not reveal the original eight runs' objective identifier. |
| Dispatch deviation as full-vector L1 MW | The same comparator measures absolute difference between two action values when action types/targets match. | Depending on action type, the value may be MW or a dimensionless load factor. Do not assume this field is a full-vector dispatch norm. |
| Standard, identical IEEE cases | `src/server/simulation/cases.ts` explicitly calls its cases simplified. Its case5 topology, generator set and limits differ from `simulation-service/pypsa_runner.py`. | Case names alone do not align the two engines. Confirm identical network data before interpreting engine agreement. |
| AC-capable external service | The inspected `simulation-service/main.py` and runner implement DC `lpf` only. | AC validation must be separately located or implemented; README wording alone is insufficient. |
| Demo reproduction as empirical results | `src/server/demo.functions.ts` writes predefined example responses and evaluation values from `src/lib/demo-dataset.ts`. | Seeding inserts demonstration records; it is not fresh inference or a recomputed physics experiment. Keep any such records separate from real experiments. |
| Slack-limit verification | The Worker reduces the slack equation but checks scheduled generator values without updating balancing dispatch. The PyPSA runner similarly checks `p_set` rather than solved slack output. | Slack-limit feasibility must be validated before using these verdicts for expanded capability claims. |

No original eight-run database records were accessed in this source audit.
An exported `optimality_gap` field alone does not resolve these distinctions.

## Record needed for each original run

- Original run ID/date, task, case version and operating state.
- Model/provider snapshot, rendered prompt, sampling settings, raw response.
- Parser version, parsed action, actual physical engine and evaluator version.
- Full stored reference scenario and actions.
- Objective identifier, formula, weights, units, optimizer status/tolerances.
- Full oracle dispatch/value, projected action and re-simulated value if used.
- Actual post-action dispatch, feasibility checks and timing definition.
- Decision/tool traces and fallbacks, failures or retries.

If a field was not recorded, retain it as missing and distinguish that from
an explicit zero, no-op, or successful validation.

## Sequence for the additional reviewer experiments

1. Recover the pilot and match its counts and means to identifiable records.
2. Align case data, slack treatment, action application and evaluator checks.
3. Locate or implement the oracle under a stated objective and control set.
4. Validate canonical larger cases, including IEEE 118-bus, before inference.
5. Run paired scenarios with fresh repeated calls and multiple prompts, keeping
   attempts, failures and within-scenario clustering visible.
6. Extend the protocol to sequences with feedback and intermediate-state
   checks; compare against an oracle with matched controls and horizon.
7. Regenerate tables, figures, and reviewer responses from the actual records.

The prospective experiment design in the revised paper is not a completed
evaluation. Repeated runs, 118-bus results, multi-action control and a DC-OPF
oracle must not be inferred from the research-export feature.
