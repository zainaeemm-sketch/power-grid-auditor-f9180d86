# Memory: index.md
Updated: now

# Project Memory

## Core
GridArena: LLM agent research platform for power-system tasks.
Dark-only theme: slate bg (#0F172A), emerald primary. No light mode.
Supabase backend with user-scoped RLS. Email/password auth enabled (auto-confirm on).
Server functions in src/server/*.functions.ts, types in src/types/grid-arena.ts.
Protected routes under src/routes/_authenticated/. Login at /login.
Auth middleware chain: withAuthHeaders (client) → requireSupabaseAuth (server).
run_status enum is "queued" | "running" | "completed" — there is NO "failed" status. LLM failures revert status to "queued" and append to run_metadata.notes.

## Memories
- [DB Schema](mem://features/db-schema) — runs, run_metadata, run_prompt_logs, experiment_presets, validation_results tables with user-scoped RLS
- [Deployment](mem://features/deployment) — Phase 9 production notes, health checks, retry/concurrency utils
- Phase 10 reporting: /reports/run/$id, /reports/batch/$id, /reports/compare?runs=… with print/PDF, CSV, LaTeX exports and Recharts SVG/PNG download.
- Layer A validation: /validation route with deterministic parser/evaluation/reproducibility/batch_stability tests persisted to validation_results (user-scoped RLS); pure helpers parseRecommendationText (llm.functions.ts) and applyParsedAction/computeEvaluation (evaluation.functions.ts).
