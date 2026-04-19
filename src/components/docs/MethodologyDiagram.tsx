/**
 * Static SVG methodology diagram for GridArena.
 * Shows the end-to-end experimental pipeline: inputs → agent → action →
 * validation/simulation/evaluation → metrics → persistence.
 * Theme-aware via CSS variables (same pattern as ArchitectureDiagram).
 */
export function MethodologyDiagram({ className }: { className?: string }) {
  return (
    <div className={className}>
      <svg
        viewBox="0 0 900 560"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="GridArena experimental methodology diagram"
        className="w-full h-auto"
      >
        <defs>
          <marker
            id="m-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted-foreground)" />
          </marker>
        </defs>

        {/* Row 1 — Inputs */}
        <g>
          <rect x="40" y="30" width="200" height="70" rx="10"
                fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
          <text x="140" y="58" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--foreground)">Benchmark Case</text>
          <text x="140" y="78" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">case5 · case14 · case30</text>
        </g>

        <g>
          <rect x="350" y="30" width="200" height="70" rx="10"
                fill="var(--muted)" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="4 4" />
          <text x="450" y="58" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--foreground)">Perturbation</text>
          <text x="450" y="78" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">optional · robustness</text>
        </g>

        <g>
          <rect x="660" y="30" width="200" height="70" rx="10"
                fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
          <text x="760" y="58" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--foreground)">Prompt Builder</text>
          <text x="760" y="78" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">system + context</text>
        </g>

        {/* Row 2 — LLM Agent (core) */}
        <g>
          <rect x="320" y="155" width="260" height="80" rx="10"
                fill="color-mix(in oklab, var(--primary) 14%, transparent)" stroke="var(--primary)" strokeWidth="1.5" />
          <text x="450" y="183" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--foreground)">LLM Agent</text>
          <text x="450" y="204" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">Gemini · GPT-5 · seeded</text>
          <text x="450" y="220" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">temperature · top_p fixed</text>
        </g>

        {/* Row 3 — Parsed action */}
        <g>
          <rect x="340" y="270" width="220" height="60" rx="10"
                fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
          <text x="450" y="295" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--foreground)">Structured Action</text>
          <text x="450" y="315" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">type · target · value</text>
        </g>

        {/* Row 4 — Three evaluation lanes */}
        <g>
          <rect x="40" y="370" width="200" height="70" rx="10"
                fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
          <text x="140" y="398" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--foreground)">Validator</text>
          <text x="140" y="418" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">schema · bounds</text>
        </g>

        <g>
          <rect x="350" y="370" width="200" height="70" rx="10"
                fill="color-mix(in oklab, var(--primary) 14%, transparent)" stroke="var(--primary)" strokeWidth="1.5" />
          <text x="450" y="398" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--foreground)">Simulation</text>
          <text x="450" y="418" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">pandapower · DC fallback</text>
        </g>

        <g>
          <rect x="660" y="370" width="200" height="70" rx="10"
                fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
          <text x="760" y="398" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--foreground)">Rule Evaluator</text>
          <text x="760" y="418" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">deterministic baseline</text>
        </g>

        {/* Row 5 — Metrics + Persistence */}
        <g>
          <rect x="200" y="475" width="220" height="60" rx="10"
                fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
          <text x="310" y="500" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--foreground)">Metrics &amp; Scores</text>
          <text x="310" y="520" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">violations · feasibility · Δ</text>
        </g>

        <g>
          <rect x="480" y="475" width="220" height="60" rx="10"
                fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
          <text x="590" y="500" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--foreground)">Provenance &amp; Report</text>
          <text x="590" y="520" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">run record · trace · export</text>
        </g>

        {/* Arrows: inputs → agent */}
        <line x1="180" y1="100" x2="360" y2="153" stroke="var(--muted-foreground)" strokeWidth="1.5" markerEnd="url(#m-arrow)" />
        <line x1="450" y1="100" x2="450" y2="153" stroke="var(--muted-foreground)" strokeWidth="1.5" markerEnd="url(#m-arrow)" />
        <line x1="720" y1="100" x2="540" y2="153" stroke="var(--muted-foreground)" strokeWidth="1.5" markerEnd="url(#m-arrow)" />

        {/* Agent → action */}
        <line x1="450" y1="235" x2="450" y2="268" stroke="var(--muted-foreground)" strokeWidth="1.5" markerEnd="url(#m-arrow)" />

        {/* Action → three lanes */}
        <line x1="380" y1="330" x2="180" y2="368" stroke="var(--muted-foreground)" strokeWidth="1.5" markerEnd="url(#m-arrow)" />
        <line x1="450" y1="330" x2="450" y2="368" stroke="var(--muted-foreground)" strokeWidth="1.5" markerEnd="url(#m-arrow)" />
        <line x1="520" y1="330" x2="720" y2="368" stroke="var(--muted-foreground)" strokeWidth="1.5" markerEnd="url(#m-arrow)" />

        {/* Lanes → metrics */}
        <line x1="180" y1="440" x2="280" y2="473" stroke="var(--muted-foreground)" strokeWidth="1.5" markerEnd="url(#m-arrow)" />
        <line x1="430" y1="440" x2="340" y2="473" stroke="var(--muted-foreground)" strokeWidth="1.5" markerEnd="url(#m-arrow)" />
        <line x1="700" y1="440" x2="380" y2="473" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeDasharray="4 4" markerEnd="url(#m-arrow)" />

        {/* Metrics → report */}
        <line x1="420" y1="505" x2="478" y2="505" stroke="var(--muted-foreground)" strokeWidth="1.5" markerEnd="url(#m-arrow)" />
      </svg>
    </div>
  );
}
