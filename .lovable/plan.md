

## Report v3 — add diagrams + math equations

I'll produce **`gridarena-report-v3.docx`** with three upgrades over v2.

### 1. Architecture diagram (JPG, embedded)

Render a clean 5-layer system diagram and embed it as a JPG inside §6 Architecture.

```text
Browser (React/Tailwind)
        │
        ▼
Edge Worker (Cloudflare · TanStack server fns)
   ├──► OpenAI API  (gpt-4o / gpt-5, structured tool-calls)
   ├──► Postgres   (runs, traces, prompts · RLS)
   └──► PyPSA Sim Service  (AC powerflow, optional)
                │
                ▼
        DC fallback solver (in-Worker)
```

Generated with matplotlib at 200 DPI → saved as `architecture.jpg` → embedded via `ImageRun({ type: "jpg", ... })` at ~6 inches wide, with caption *Figure 1 — GridArena system architecture*.

### 2. Methodology diagram (JPG, embedded)

A horizontal 9-stage pipeline flowchart for §5 Methodology:

```text
Config → Prompt Build → LLM Call → Parse Action → Validate
   → Simulate (DC/AC) → Evaluate Metrics → Counterfactual → Persist & Trace
```

Same render path → `methodology.jpg` → embedded with caption *Figure 2 — Evaluation pipeline*.

### 3. Mathematical model (real equation formatting)

Add a new sub-section **§5.3 Mathematical formulation** with proper Word equation objects (OOXML `<m:oMath>`) so equations render as real math, not plain text. Covers:

- **DC power flow**: `B · θ = P`, with `P_ij = (θ_i − θ_j) / x_ij`
- **Line-limit constraint**: `|P_ij| ≤ P_ij^max`
- **Re-dispatch optimisation surrogate**: minimise `Σ c_g · ΔP_g` s.t. `Σ ΔP_g = ΔP_load` and `P_g^min ≤ P_g + ΔP_g ≤ P_g^max`
- **Violation improvement**: `ν = (V_base − V_post) / max(V_base, ε)`
- **Optimality gap**: `γ = (J_agent − J*) / |J*|`
- **Decision regret**: `ρ = J_agent − min_{a ∈ A} J(a)`

Each equation gets a number on the right (Eq. 1, Eq. 2, …) and a one-line variable legend underneath.

### Generation approach

- Node script using `docx` lib for the document body, tables, and embedded images.
- Python + matplotlib for the two diagrams (rendered to JPG).
- Equations: hand-built OOXML math fragments inserted via `Math` / `MathRun` from the `docx` package (which supports `<m:oMath>`). If the lib's math API is too limited for any equation, I'll fall back to unpacking the docx and injecting raw `<m:oMath>` XML directly — equations will render natively in Word, not as images.
- Page-by-page PDF→JPG QA on every page before delivery; verify diagrams are sharp and equations render as math.

### Deliverable

- `/mnt/documents/gridarena-report-v3.docx` (v1 and v2 stay available).
- Surfaced as a `<lov-artifact>` for one-click download.

### Out of scope

- No changes to the GridArena app or codebase.
- No interactive/animated diagrams — static JPG only (Word requirement).
- No LaTeX export — Word-native math only.

