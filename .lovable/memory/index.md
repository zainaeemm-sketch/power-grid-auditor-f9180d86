---
name: index
description: Project memory index for GridArena
type: index
---
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
Phase 11: durable job_queue + job_logs tables; processJobBatch worker; useJobDrain client hook; /system-status dashboard.

## Memories
- [DB Schema](mem://features/db-schema) — runs, run_metadata, run_prompt_logs, experiment_presets, validation_results, job_queue, job_logs tables
