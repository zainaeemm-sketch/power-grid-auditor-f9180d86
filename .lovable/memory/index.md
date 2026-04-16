# Project Memory

## Core
GridArena: LLM agent research platform for power-system tasks.
Dark default, light mode available. Accent switcher: emerald/blue/purple/amber/rose. Preferences in localStorage.
Supabase backend with user-scoped RLS. Email/password auth enabled (auto-confirm on).
Server functions in src/server/*.functions.ts, types in src/types/grid-arena.ts.
Protected routes under src/routes/_authenticated/. Login at /login.
Auth middleware chain: withAuthHeaders (client) → requireSupabaseAuth (server).

## Memories
- [DB Schema](mem://features/db-schema) — runs, run_metadata, run_prompt_logs, experiment_presets, batches, batch_run_links tables with user-scoped RLS
