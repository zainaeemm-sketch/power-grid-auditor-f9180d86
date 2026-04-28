import { useMemo, useState } from "react";
import type { PowerSystemCase } from "@/server/simulation/types";

/**
 * Deterministic force-directed layout for a small power-system case.
 * Pure function of `c` — no randomness, so re-renders are stable.
 */
function computeLayout(c: PowerSystemCase, width: number, height: number) {
  const n = c.buses.length;
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.4;

  // Seed: evenly spaced on a circle (deterministic).
  const pos = c.buses.map((_, i) => ({
    x: cx + r * Math.cos((2 * Math.PI * i) / n - Math.PI / 2),
    y: cy + r * Math.sin((2 * Math.PI * i) / n - Math.PI / 2),
  }));

  // Adjacency for spring forces.
  const edges = c.branches.map((b) => [b.from_bus, b.to_bus] as const);

  const iterations = 250;
  const k = Math.sqrt((width * height) / Math.max(n, 1)) * 0.6; // ideal length
  let temp = Math.min(width, height) * 0.1;
  const cooling = 0.96;
  const padding = 30;

  for (let it = 0; it < iterations; it++) {
    const disp = pos.map(() => ({ x: 0, y: 0 }));

    // Repulsion between every pair.
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const d2 = dx * dx + dy * dy + 0.01;
        const d = Math.sqrt(d2);
        const force = (k * k) / d;
        const fx = (dx / d) * force;
        const fy = (dy / d) * force;
        disp[i].x += fx;
        disp[i].y += fy;
        disp[j].x -= fx;
        disp[j].y -= fy;
      }
    }

    // Attraction along edges.
    for (const [a, b] of edges) {
      const dx = pos[a].x - pos[b].x;
      const dy = pos[a].y - pos[b].y;
      const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
      const force = (d * d) / k;
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;
      disp[a].x -= fx;
      disp[a].y -= fy;
      disp[b].x += fx;
      disp[b].y += fy;
    }

    // Apply with temperature cap, clamp to canvas.
    for (let i = 0; i < n; i++) {
      const d = Math.sqrt(disp[i].x * disp[i].x + disp[i].y * disp[i].y) + 0.01;
      const cap = Math.min(d, temp);
      pos[i].x += (disp[i].x / d) * cap;
      pos[i].y += (disp[i].y / d) * cap;
      pos[i].x = Math.max(padding, Math.min(width - padding, pos[i].x));
      pos[i].y = Math.max(padding, Math.min(height - padding, pos[i].y));
    }
    temp *= cooling;
  }

  return pos;
}

export function TopologyDiagram({ c }: { c: PowerSystemCase }) {
  const width = 640;
  const height = 380;

  const positions = useMemo(() => computeLayout(c, width, height), [c]);

  const genBuses = useMemo(() => new Set(c.generators.map((g) => g.bus)), [c]);
  const maxLoad = useMemo(
    () => Math.max(1, ...c.buses.map((b) => b.pd_mw)),
    [c],
  );

  const [hoveredBus, setHoveredBus] = useState<number | null>(null);
  const [hoveredBranch, setHoveredBranch] = useState<number | null>(null);

  // Branches incident to the hovered bus (for highlight).
  const incident = useMemo(() => {
    if (hoveredBus === null) return new Set<number>();
    return new Set(
      c.branches
        .filter((b) => b.from_bus === hoveredBus || b.to_bus === hoveredBus)
        .map((b) => b.index),
    );
  }, [hoveredBus, c]);

  function busColor(type: "slack" | "pv" | "pq"): string {
    if (type === "slack") return "hsl(var(--primary))"; // emerald
    if (type === "pv") return "hsl(217 91% 60%)"; // blue
    return "hsl(215 16% 65%)"; // muted slate for PQ
  }

  const hoveredBusData =
    hoveredBus !== null ? c.buses.find((b) => b.index === hoveredBus) : null;
  const hoveredBranchData =
    hoveredBranch !== null
      ? c.branches.find((b) => b.index === hoveredBranch)
      : null;

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3">
          <LegendDot color="hsl(var(--primary))" label="Slack" />
          <LegendDot color="hsl(217 91% 60%)" label="PV" />
          <LegendDot color="hsl(215 16% 65%)" label="PQ" />
          <span className="ml-2 inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full ring-2 ring-amber-400/70" />
            <span>has generator</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-foreground/60" />
            <span>● size = load (MW)</span>
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase">{c.name}</span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="block h-auto w-full select-none"
          role="img"
          aria-label={`Topology diagram for ${c.name}`}
        >
          {/* branches */}
          <g>
            {c.branches.map((b) => {
              const a = positions[b.from_bus];
              const z = positions[b.to_bus];
              if (!a || !z) return null;
              const isHover = hoveredBranch === b.index;
              const isIncident = incident.has(b.index);
              const stroke = isHover
                ? "hsl(var(--primary))"
                : isIncident
                  ? "hsl(var(--primary) / 0.7)"
                  : "hsl(var(--border))";
              const sw = isHover || isIncident ? 2.2 : 1.2;
              return (
                <line
                  key={b.index}
                  x1={a.x}
                  y1={a.y}
                  x2={z.x}
                  y2={z.y}
                  stroke={stroke}
                  strokeWidth={sw}
                  strokeLinecap="round"
                  className="cursor-pointer transition-[stroke,stroke-width]"
                  onMouseEnter={() => setHoveredBranch(b.index)}
                  onMouseLeave={() => setHoveredBranch(null)}
                />
              );
            })}
          </g>

          {/* buses */}
          <g>
            {c.buses.map((b) => {
              const p = positions[b.index];
              if (!p) return null;
              const r = 6 + 8 * Math.sqrt(b.pd_mw / maxLoad);
              const hasGen = genBuses.has(b.index);
              const isHover = hoveredBus === b.index;
              return (
                <g
                  key={b.index}
                  onMouseEnter={() => setHoveredBus(b.index)}
                  onMouseLeave={() => setHoveredBus(null)}
                  className="cursor-pointer"
                >
                  {hasGen && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={r + 4}
                      fill="none"
                      stroke="rgb(251 191 36 / 0.85)"
                      strokeWidth={1.5}
                    />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r}
                    fill={busColor(b.type)}
                    stroke={isHover ? "hsl(var(--foreground))" : "hsl(var(--background))"}
                    strokeWidth={isHover ? 2 : 1.5}
                  />
                  <text
                    x={p.x}
                    y={p.y - r - 4}
                    textAnchor="middle"
                    className="pointer-events-none fill-foreground text-[10px] font-semibold"
                  >
                    {b.index}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* tooltip */}
        {(hoveredBusData || hoveredBranchData) && (
          <div className="pointer-events-none absolute left-2 top-2 rounded-md border border-border bg-popover/95 px-2.5 py-1.5 text-[11px] text-popover-foreground shadow-sm backdrop-blur">
            {hoveredBusData && (
              <div className="space-y-0.5">
                <div className="font-semibold">Bus {hoveredBusData.index}</div>
                <div className="text-muted-foreground">
                  Type: <span className="text-foreground uppercase">{hoveredBusData.type}</span>
                </div>
                <div className="text-muted-foreground">
                  Load: <span className="text-foreground">{hoveredBusData.pd_mw} MW</span>
                </div>
                {genBuses.has(hoveredBusData.index) && (
                  <div className="text-amber-400">has generator</div>
                )}
              </div>
            )}
            {!hoveredBusData && hoveredBranchData && (
              <div className="space-y-0.5">
                <div className="font-semibold">Branch {hoveredBranchData.index}</div>
                <div className="text-muted-foreground">
                  {hoveredBranchData.from_bus} → {hoveredBranchData.to_bus}
                </div>
                <div className="text-muted-foreground">
                  x = <span className="text-foreground">{hoveredBranchData.x_pu} pu</span>
                </div>
                <div className="text-muted-foreground">
                  Rating: <span className="text-foreground">{hoveredBranchData.rate_mw} MW</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </span>
  );
}
