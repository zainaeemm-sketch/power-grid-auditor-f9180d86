

# Phase 3: Run Details Research Workspace

## Overview

Refactor the monolithic `runs.$runId.tsx` into a well-structured research workspace with 10 distinct panels, each as a reusable component. The existing editable panels (metadata, prompt log, recommendation, status controls) stay but move into dedicated component files. Five new panels are added: Structured Action, Results Summary, Tool Trace, Provenance Timeline, and an enhanced Parser Provenance.

## New Components (all in `src/components/run-details/`)

| Component | Data Source | Editable? |
|-----------|------------|-----------|
| `RunHeader.tsx` | run | No (display + back link + export placeholder) |
| `RunStatusControls.tsx` | run.status | Yes (status transitions) |
| `RunMetadataPanel.tsx` | run_metadata | Yes (upsert form) |
| `RunPromptLogPanel.tsx` | run_prompt_logs | Yes (upsert form) |
| `RunRecommendationPanel.tsx` | run_recommendations | Yes (upsert form) |
| `ParserProvenancePanel.tsx` | run_parse_results | No (read-only display) |
| `StructuredActionPanel.tsx` | run_parse_results | No (derived display) |
| `ResultsSummaryPanel.tsx` | Placeholder/derived | No (mock badges/chips) |
| `ToolTracePanel.tsx` | Mock based on status | No (mock trace entries) |
| `ProvenanceTimelinePanel.tsx` | Derived from run state | No (lifecycle timeline) |

## Implementation Details

### 1. RunHeader
Shows title, agent, StatusBadge, run ID (monospace truncated), created_at, export button (disabled placeholder), and a back-to-runs link.

### 2. RunStatusControls
Extracts the status transition logic. Shows current status badge and a "Mark [next]" button. Uses `updateRunStatus` server function + `router.invalidate()`.

### 3-5. Editable Panels (Metadata, Prompt Log, Recommendation)
Extract existing inline form logic from `runs.$runId.tsx` into standalone components. Each receives the initial data + `run_id` as props. Uses `useServerFn` + `useState` internally. Adds `toast.success`/`toast.error` (sonner) for save feedback.

### 6. ParserProvenancePanel
Extracts existing read-only parser display. Shows source_text, parser_notes, action_type, target_index, value, enabled. Graceful "No parse results yet" fallback.

### 7. StructuredActionPanel
New panel. Reads `parseResult` and renders a human-friendly action description:
- `none` → "No structured action was derived"
- `scale_all_loads` → "Scale all loads with factor {value}"
- `set_generator_p_mw` → "Set generator {target_index} to {value} MW"
- `line_outage` → "Take line {target_index} out of service"
Falls back to "No parse result available" when null.

### 8. ResultsSummaryPanel
New placeholder panel with a grid of evaluation metrics displayed as labeled stat cards with badge/chip styling:
- feasibility, violations_found, baseline_violations, post_action_violations, violation_improvement, confidence, grounding_quality, action_applied, notes
All show "—" or "Pending" placeholder values. Structured so a real evaluation table can replace mock data later.

### 9. ToolTracePanel
New panel. Generates mock tool-trace entries based on run status (queued → 2 entries, running → 4, completed → 6). Each entry: tool_name, purpose, input_summary, output_summary, status (done/running/pending), timestamp. Rendered as a vertical list of trace cards.

### 10. ProvenanceTimelinePanel
New panel. Generates a lifecycle timeline from run state:
- Steps: Experiment created, Benchmark prepared, Agent configured, Recommendation parsed, Research question registered, Analysis started, Analysis completed, Validation completed
- Each step gets a status: `done`, `current`, or `pending` based on run.status and data availability
- Rendered as a vertical timeline with status badges (emerald for done, blue for current, muted for pending)

### Route File Changes (`runs.$runId.tsx`)
- Strip all inline panel logic
- Import all 10 components
- Pass data as props from loader
- Layout: full-width header → status controls → 2-column grid for panels → full-width panels for Results Summary, Tool Trace, and Timeline

## Files Changed

| File | Action |
|------|--------|
| `src/components/run-details/RunHeader.tsx` | Create |
| `src/components/run-details/RunStatusControls.tsx` | Create |
| `src/components/run-details/RunMetadataPanel.tsx` | Create |
| `src/components/run-details/RunPromptLogPanel.tsx` | Create |
| `src/components/run-details/RunRecommendationPanel.tsx` | Create |
| `src/components/run-details/ParserProvenancePanel.tsx` | Create |
| `src/components/run-details/StructuredActionPanel.tsx` | Create |
| `src/components/run-details/ResultsSummaryPanel.tsx` | Create |
| `src/components/run-details/ToolTracePanel.tsx` | Create |
| `src/components/run-details/ProvenanceTimelinePanel.tsx` | Create |
| `src/routes/_authenticated/runs.$runId.tsx` | Rewrite (compose components) |

No database changes needed — all tables exist from Phase 2.

