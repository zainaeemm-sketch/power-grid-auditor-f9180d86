/**
 * Static SVG architecture diagram for GridArena.
 * Uses CSS variables so it inherits the active theme/accent.
 * Note: tokens in src/styles.css are full color values (oklch(...)), so they
 * must be referenced directly via var(--token), not wrapped in hsl()/rgb().
 */
export function ArchitectureDiagram({ className }: { className?: string }) {
  return (
    <div className={className}>
      <svg
        viewBox="0 0 800 460"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="GridArena system architecture diagram"
        className="w-full h-auto"
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted-foreground)" />
          </marker>
        </defs>

        {/* Browser */}
        <g>
          <rect x="40" y="40" width="200" height="80" rx="10"
                fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
          <text x="140" y="68" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--foreground)">Browser</text>
          <text x="140" y="90" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">TanStack Start UI</text>
          <text x="140" y="106" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">React 19 · Vite</text>
        </g>

        {/* Edge Worker */}
        <g>
          <rect x="300" y="40" width="200" height="120" rx="10"
                fill="color-mix(in oklab, var(--primary) 12%, transparent)" stroke="var(--primary)" strokeWidth="1.5" />
          <text x="400" y="68" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--foreground)">Edge Worker</text>
          <text x="400" y="90" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">Server Functions</text>
          <text x="400" y="106" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">Queue Worker</text>
          <text x="400" y="122" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">DC Powerflow Solver</text>
          <text x="400" y="142" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">Auth · Validation · Eval</text>
        </g>

        {/* Postgres */}
        <g>
          <rect x="560" y="40" width="200" height="120" rx="10"
                fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
          <text x="660" y="68" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--foreground)">Postgres (Cloud)</text>
          <text x="660" y="90" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">Runs · Evaluations</text>
          <text x="660" y="106" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">Job Queue · Logs</text>
          <text x="660" y="122" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">RLS (user-scoped)</text>
          <text x="660" y="142" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">Validation Results</text>
        </g>

        {/* LLM Gateway */}
        <g>
          <rect x="200" y="260" width="180" height="80" rx="10"
                fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
          <text x="290" y="288" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--foreground)">LLM Gateway</text>
          <text x="290" y="310" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">Gemini · GPT-5</text>
          <text x="290" y="326" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">deterministic seed</text>
        </g>

        {/* Simulation Service */}
        <g>
          <rect x="420" y="260" width="200" height="80" rx="10"
                fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
          <text x="520" y="288" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--foreground)">Simulation Service</text>
          <text x="520" y="310" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">PyPSA (Python)</text>
          <text x="520" y="326" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">optional · external</text>
        </g>

        {/* Fallback box */}
        <g>
          <rect x="300" y="380" width="200" height="50" rx="8"
                fill="var(--muted)" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="4 4" />
          <text x="400" y="400" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--foreground)">Rule-based Fallback</text>
          <text x="400" y="418" textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">always available</text>
        </g>

        {/* Arrows */}
        <line x1="240" y1="80" x2="298" y2="80" stroke="var(--muted-foreground)" strokeWidth="1.5" markerEnd="url(#arrow)" />
        <line x1="500" y1="80" x2="558" y2="80" stroke="var(--muted-foreground)" strokeWidth="1.5" markerEnd="url(#arrow)" />
        <line x1="370" y1="160" x2="310" y2="258" stroke="var(--muted-foreground)" strokeWidth="1.5" markerEnd="url(#arrow)" />
        <line x1="430" y1="160" x2="500" y2="258" stroke="var(--muted-foreground)" strokeWidth="1.5" markerEnd="url(#arrow)" />
        <line x1="520" y1="340" x2="450" y2="378" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeDasharray="4 4" markerEnd="url(#arrow)" />
        <line x1="400" y1="160" x2="400" y2="378" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeDasharray="2 4" />
      </svg>
    </div>
  );
}
