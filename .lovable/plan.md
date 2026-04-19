
The user wants a methodology diagram for GridArena — the experimental flow showing how an LLM agent is evaluated end-to-end (input case → agent reasoning → action → simulation → evaluation → metrics/provenance).

I'll add it as a static SVG component (matching the existing `ArchitectureDiagram` pattern, theme-aware via CSS tokens), and embed it in the docs.

**Plan:**

1. **Create `src/components/docs/MethodologyDiagram.tsx`** — static SVG (viewBox ~900×520) with these stages flowing left→right, top→bottom:

   ```text
   [Benchmark Case]    [Perturbation]    [Prompt Builder]
   case5/14/30           optional            system + context
          \                  |                   /
           └──────► [LLM Agent (seeded)] ◄──────┘
                            │
                  [Structured Action]
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        [Validator]  [Simulation]  [Rule Eval]
                     pandapower / DC
                            │
                   [Metrics & Scores]
                            │
        [Provenance Log] ── [Run Record + Report]
   ```

   Colors: primary tint for the LLM Agent and Simulation boxes (the core), card/border for inputs, muted dashed border for fallback paths. Same `var(--token)` pattern as `ArchitectureDiagram`.

2. **Embed in `src/routes/docs.workflow.tsx`** — add a "Methodology" section near the top with a short intro paragraph and the diagram in a bordered card (matching the architecture-diagram presentation in `docs.architecture.tsx`).

3. **Optional cross-link** — add one sentence + link in `docs.architecture.tsx` pointing to the methodology diagram so the two diagrams reference each other.

No new routes, no deps, no schema. Pure additive UI.
