/**
 * Static GridArena knowledge base used to ground the Ask AI assistant.
 * Kept short on purpose — the LLM uses this to anchor terminology and avoid
 * hallucinating non-existent features.
 */
export const GRIDARENA_KNOWLEDGE = `
GRIDARENA — PLATFORM IDENTITY
GridArena is an evaluation and audit platform for LLM-based agents that solve
power-system decision tasks (e.g. recommending operator actions on a grid case).
GridArena is NOT itself the agent — it sets up runs, captures prompts/responses,
parses recommendations into structured actions, applies them to a power-flow
simulator, evaluates feasibility and improvement, and provides analytics,
reproducibility, ground truth, sensitivity, and counterfactual layers.

PAGE / MODULE MAP
- Home (/): Landing & quick links.
- Runs (/runs): Filterable list of all runs with status, agent, case, scores.
- New Run (/new-run): Create a single run. Choose preset, model, temperature,
  prompt, case, agent. "Run LLM Automatically" triggers the full pipeline
  (LLM call → parse → simulate → evaluate) without manual steps.
- Run Details (/runs/:id): Single-run drill-down with multiple panels:
  • Run Header: status + actions (rerun, delete).
  • Run Metadata: model_name, model_version, temperature, top_p, max_tokens,
    random_seed, prompt_template_version, parser_version,
    evaluation_logic_version, dataset_version. This is the reproducibility
    snapshot.
  • Run Prompt Log: full prompt sent and raw response received.
  • Agent Recommendation: free-text recommendation produced by the LLM.
  • Parser Provenance: how the parser extracted action_type, target_index,
    value from the raw text. Shows source_text and parser_notes.
  • Structured Action: the parsed action that was actually applied.
  • Results Summary: feasibility, baseline_violations, post_action_violations,
    violation_improvement, optimality_gap, grounding_quality, confidence.
  • Tool Trace / Decision Trace / Provenance Timeline: ordered stages
    (LLM call, parse, simulate, evaluate) with timing and status.
  • Counterfactual Panel (Layer E): what-if alternative actions and their
    decision_regret, optimality_gap, feasibility_change.
  • Sensitivity Panel: robustness against perturbed inputs.
  • Ground Truth Comparison: action_match / feasibility_match vs reference.
- Presets (/presets): Reusable experiment configurations (model, temperature,
  prompt template, evaluation mode, versions). Use them to keep batches
  reproducible.
- Batches (/batches): Group of runs sharing a config, used for systematic
  experiments. Batch detail page has analytics + bulk actions.
- Compare (/compare): Side-by-side comparison of two or more runs.
- Validation (/validation): Engine self-tests (parser, evaluator) to verify
  GridArena itself is behaving correctly.
- Ground Truth (/ground-truth): Curated reference scenarios + expected
  actions, used to score agent action_match and feasibility_match.
- System Status (/system-status): Job queue, KPIs, live indicator.
- Reports (/reports/run/:id, /reports/batch/:id, /reports/compare):
  Exportable executive summaries (CSV / LaTeX / SVG).

GLOSSARY
- feasibility: Whether the post-action grid state respects all operational
  limits (no thermal/voltage/convergence violations).
- baseline_violations: # of constraint violations BEFORE the agent's action.
- post_action_violations: # of violations AFTER applying the parsed action.
- violation_improvement: baseline_violations − post_action_violations.
  Positive = the action helped.
- optimality_gap: How far the agent's outcome is from the best feasible
  outcome found in the search/counterfactual space. Lower is better.
  0 means the agent matched the best alternative.
- decision_regret: For a counterfactual alternative, the difference in
  improvement vs the agent's actual choice. High regret on an alternative
  means the agent left value on the table.
- grounding_quality: Qualitative tag (good/partial/poor) for whether the
  recommendation references real elements of the case.
- confidence: Agent-stated or model-derived confidence label.
- parser_provenance: The audit trail showing exactly which substring of the
  recommendation produced each field of the structured action.
- action_match: Did the parsed action equal the ground-truth action?
- feasibility_match: Did the resulting feasibility match the ground truth?
- robustness_score: Stability of the decision under input perturbations
  (Sensitivity layer). Higher = more robust.
- failure_reason: Machine-readable cause when a stage fails (e.g.
  parser_returned_none, sim_did_not_converge, llm_error).

TROUBLESHOOTING PLAYBOOK
- "action_type = none" / parser returned none: The LLM's recommendation did
  not contain a parseable action. Check the Prompt Log and Agent
  Recommendation panels. Often fixed by tightening the system prompt or
  asking the model to output a structured action block.
- Run stuck in queued/running: Check System Status → job queue. Lease may
  have expired; jobs auto-retry up to max_attempts.
- Model not available / 401: The configured OPENAI_MODEL is not accessible
  with the current key, or the key is wrong. Verify in Run Metadata.
- Empty analytics on a batch: Runs may not have completed yet, or all runs
  failed at parse stage. Open a representative run and inspect Decision
  Trace.
- Reproducibility mismatch: Compare Run Metadata snapshots — differing
  prompt_template_version, parser_version, or random_seed will produce
  different outputs even with the same model.
- Counterfactual results missing: Counterfactual jobs run asynchronously;
  see Batch Perturbation Jobs dialog or rerun the counterfactual.
- Export missing fields: Exports reflect what was captured at run time;
  older runs may lack newer metadata fields.

ASSISTANT BEHAVIOR
- Be GridArena-specific. Prefer concrete page/panel references over generic
  advice ("open Run Details → Parser Provenance").
- Be honest when something is not in this knowledge base or in the provided
  page context. Do not invent feature names, routes, or metric formulas.
- For troubleshooting, give a short ranked list of likely causes and the
  panel/route the user should open.
- Never reveal API keys, secrets, or internal env var values.
- Keep answers concise by default; expand only when the user asks "why" or
  "explain in detail".
`.trim();

export const QUICK_PROMPTS = [
  "Explain Runs",
  "Explain Presets",
  "Help me debug a failed run",
  "Explain parser provenance",
  "What does optimality gap mean?",
  "How does counterfactual analysis work?",
] as const;
