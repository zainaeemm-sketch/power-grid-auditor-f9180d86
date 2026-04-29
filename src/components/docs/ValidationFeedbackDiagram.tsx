/**
 * Static SVG diagram showing the AI-assisted validation feedback loop:
 *   case_meta validator → suggestion (LLM) → review drawer →
 *   accept/revert → overrides table → audit trail → re-validate.
 * Theme-aware via CSS variables (same pattern as ArchitectureDiagram /
 * MethodologyDiagram).
 */
export function ValidationFeedbackDiagram({ className }: { className?: string }) {
  return (
    <div className={className}>
      <svg
        viewBox="0 0 900 460"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="GridArena validation feedback loop diagram"
        className="w-full h-auto"
      >
        <defs>
          <marker
            id="vf-arrow"
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

        {/* Row 1 — CASE_META source + Validator */}
        <g>
          <rect x="40" y="40" width="200" height="70" rx="10"
                fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
          <text x="140" y="68" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--foreground)">CASE_META</text>
          <text x="140" y="88" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">curated metadata</text>
        </g>

        <g>
          <rect x="350" y="40" width="200" height="70" rx="10"
                fill="color-mix(in oklab, var(--primary) 12%, transparent)"
                stroke="var(--primary)" strokeWidth="1.5" />
          <text x="450" y="68" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--foreground)">Validator</text>
          <text x="450" y="88" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">findCaseMetaIssues</text>
        </g>

        <g>
          <rect x="660" y="40" width="200" height="70" rx="10"
                fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
          <text x="760" y="64" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--foreground)">Issues panel</text>
          <text x="760" y="82" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">errors · warnings</text>
          <text x="760" y="98" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">filter · export</text>
        </g>

        {/* Row 2 — LLM Suggest */}
        <g>
          <rect x="320" y="160" width="260" height="80" rx="10"
                fill="color-mix(in oklab, var(--primary) 14%, transparent)"
                stroke="var(--primary)" strokeWidth="1.5" />
          <text x="450" y="188" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--foreground)">AI Suggestion</text>
          <text x="450" y="208" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">suggestCaseMetaFix</text>
          <text x="450" y="224" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">model · rationale · value</text>
        </g>

        {/* Row 3 — Review drawer */}
        <g>
          <rect x="320" y="270" width="260" height="70" rx="10"
                fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
          <text x="450" y="296" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--foreground)">Review Drawer</text>
          <text x="450" y="316" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">diff · accept · dismiss</text>
        </g>

        {/* Row 4 — Overrides + Audit */}
        <g>
          <rect x="80" y="370" width="240" height="70" rx="10"
                fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
          <text x="200" y="396" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--foreground)">Overrides table</text>
          <text x="200" y="416" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">accept · revert · bulk</text>
        </g>

        <g>
          <rect x="580" y="370" width="240" height="70" rx="10"
                fill="color-mix(in oklab, oklch(0.78 0.14 75) 14%, transparent)"
                stroke="oklch(0.78 0.14 75)" strokeWidth="1.5" strokeDasharray="3 3" />
          <text x="700" y="396" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--foreground)">Audit trail</text>
          <text x="700" y="416" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">who · when · before → after</text>
        </g>

        {/* Arrows: source flow */}
        <line x1="240" y1="75" x2="348" y2="75" stroke="var(--muted-foreground)" strokeWidth="1.5" markerEnd="url(#vf-arrow)" />
        <line x1="550" y1="75" x2="658" y2="75" stroke="var(--muted-foreground)" strokeWidth="1.5" markerEnd="url(#vf-arrow)" />

        {/* Issues → Suggest */}
        <line x1="700" y1="110" x2="540" y2="158" stroke="var(--muted-foreground)" strokeWidth="1.5" markerEnd="url(#vf-arrow)" />
        {/* label */}
        <text x="640" y="140" fontSize="10" fill="var(--muted-foreground)">"Suggest fix"</text>

        {/* Suggest → Drawer */}
        <line x1="450" y1="240" x2="450" y2="268" stroke="var(--muted-foreground)" strokeWidth="1.5" markerEnd="url(#vf-arrow)" />

        {/* Drawer → Overrides (accept) */}
        <line x1="380" y1="340" x2="240" y2="368" stroke="var(--muted-foreground)" strokeWidth="1.5" markerEnd="url(#vf-arrow)" />
        <text x="270" y="356" fontSize="10" fill="var(--muted-foreground)">accept</text>

        {/* Overrides → Audit (each accept/revert is logged) */}
        <line x1="320" y1="405" x2="578" y2="405" stroke="oklch(0.78 0.14 75)" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#vf-arrow)" />
        <text x="430" y="396" fontSize="10" fill="var(--muted-foreground)">log entry</text>

        {/* Overrides → CASE_META merge (feedback loop) */}
        <line x1="200" y1="370" x2="140" y2="112" stroke="var(--primary)" strokeWidth="1.5" markerEnd="url(#vf-arrow)" />
        <text x="60" y="240" fontSize="10" fill="var(--muted-foreground)">mergeOverrides</text>
        <text x="60" y="254" fontSize="10" fill="var(--muted-foreground)">re-validate</text>

        {/* Drawer → Issues (dismiss, no change) */}
        <line x1="580" y1="295" x2="760" y2="112" stroke="var(--muted-foreground)" strokeWidth="1.2" strokeDasharray="4 4" markerEnd="url(#vf-arrow)" />
        <text x="660" y="220" fontSize="10" fill="var(--muted-foreground)">dismiss</text>
      </svg>
    </div>
  );
}
