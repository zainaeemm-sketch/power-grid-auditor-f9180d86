# Memory: index.md
Updated: just now

# Project Memory

## Core
GridArena: LLM agent research platform for power-system tasks.
Dark-only theme: slate bg (#0F172A), emerald primary. No light mode.
Supabase backend with user-scoped RLS. Email/password auth enabled (auto-confirm on).
Server functions in src/server/*.functions.ts, types in src/types/grid-arena.ts.
Protected routes under src/routes/_authenticated/. Login at /login.
Auth middleware chain: withAuthHeaders (client) → requireSupabaseAuth (server).
Public routes (no auth): /about, /docs/* — show Docs+About in nav for logged-out users.
Citation metadata centralized in src/lib/citation.ts; demo seeder in src/server/demo.functions.ts (idempotent, marks artifacts with "[Demo]" prefix).

## Memories
- [DB Schema](mem://features/db-schema) — runs, run_metadata, run_prompt_logs, experiment_presets tables with user-scoped RLS
