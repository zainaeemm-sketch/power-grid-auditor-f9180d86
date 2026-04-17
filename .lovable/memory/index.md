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
Evaluation has tiered engines: external pandapower → in-Worker DC PF → rule-based fallback. Mode chosen per-run via run_metadata.evaluation_mode.

## Memories
- [DB Schema](mem://features/db-schema) — runs, run_metadata (+evaluation_mode), run_evaluations (+engine_used, simulation_details), validation_results, experiment_presets
