

# GridArena — Implementation Plan

## Overview
GridArena is a full-stack research platform for evaluating and auditing LLM agents on power-system tasks. Dark professional theme with emerald accent, Supabase backend, secure server-side LLM execution.

## Phase 1: Foundation — Layout, Navigation, Theme, Core Pages

- **Dark theme**: Slate background (`#0F172A`), emerald primary (`#10B981`), rounded cards, professional research dashboard aesthetic
- **Navigation header**: Home, Runs, New Run, Presets, Batches, Compare — with active link highlighting
- **Route files**: `index.tsx`, `runs.tsx`, `runs.$runId.tsx`, `new-run.tsx`, `presets.tsx`, `batches.tsx`, `batches.$batchId.tsx`, `compare.tsx`
- **Home page**: Hero section introducing GridArena, CTA buttons (Start New Run, View Runs), overview stat cards
- **Runs page**: Placeholder list UI with search/filter controls
- **New Run page**: Form shell with preset dropdown

## Phase 2: Supabase Schema & CRUD

- **Enable Lovable Cloud** with Supabase for database + auth
- **Create all tables**: `runs`, `run_metadata`, `run_prompt_logs`, `run_recommendations`, `run_parse_results`, `run_actions`, `experiment_presets`, `batches`, `batch_run_links`, plus `run_results` for evaluation summaries
- **RLS policies**: Users own their data via `user_id` foreign key on runs, presets, and batches
- **Auth**: Basic email/password login, protected routes for authenticated users
- **Server functions**: CRUD operations for all entities
- **Seed data**: Sample runs, presets, and batch data inserted via migrations

## Phase 3: Run Details Page

- **Run header**: Title, agent, status badge, export CSV button
- **Status controls**: Buttons to transition queued → running → completed
- **Metadata panel**: Editable fields for provider, model, prompt version, dataset version, seed, notes
- **Prompt/Response log panel**: Editable text areas for prompt and response
- **Recommendation panel**: Display/edit recommendation text
- **Parser provenance panel**: Show parsed source, notes, action type, target, value
- **Action proposal panel**: Structured action display with enable/disable toggles
- **Results summary panel**: Feasibility, violations, confidence, grounding quality
- **Tool trace & provenance timeline panels**: Placeholder sections for future expansion

## Phase 4: Secure Server-Side LLM Execution

- **Server function** (`createServerFn`): "Run LLM Automatically" endpoint
- **Flow**: Read run metadata → get `provider_base_url` + `model_name` → fallback to secrets if blank → read `prompt_text` → call LLM API server-side → save `response_text` → copy to `run_recommendations` → trigger parser → save structured action → return results
- **Secrets**: Store default LLM provider URL and API key via Lovable secrets management
- **Error handling**: Graceful failures with user-facing error messages

## Phase 5: Parser, Structured Actions & Evaluation

- **Rule-based parser**: Support `none`, `scale_all_loads`, `set_generator_p_mw`, `line_outage` action types
- **Parser notes**: Explain how recommendation text was interpreted
- **Results engine**: Placeholder evaluation storing feasibility, violations, confidence, grounding quality, action applied, notes
- **UI wiring**: Parse results and evaluation summaries display in run details

## Phase 6: Compare, Batches & Exports

- **Compare page**: Select two runs via dropdowns, side-by-side comparison of metadata, recommendations, parsed actions, evaluation summaries
- **Batches page**: Create batch with name/task/research question, link multiple runs, batch detail view with analytics cards and charts (using Recharts)
- **CSV exports**: Run-level export, comparison export, batch analytics export — all generated server-side and downloaded
- **Batch analytics**: Summary statistics, success rates, violation charts across batch runs

## Design System
- Background: `oklch(0.129 0.042 264.695)` (dark slate)
- Primary: Emerald green (`#10B981` / oklch equivalent)
- Cards: Dark elevated surfaces with subtle borders, rounded corners
- Typography: Clean hierarchy with muted labels and bright values
- Status badges: Color-coded (queued=yellow, running=blue, completed=green)

## Architecture
- **Routes**: File-based routing via TanStack Start
- **Server functions**: All mutations and LLM calls via `createServerFn`
- **Components**: Reusable cards, forms, tables, status badges, filter bars
- **Database**: Supabase with RLS, user-scoped data
- **Auth**: Supabase auth with protected layout route (`_authenticated`)

