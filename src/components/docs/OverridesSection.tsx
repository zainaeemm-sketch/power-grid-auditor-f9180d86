import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  revertCaseMetaOverride,
  type CaseMetaOverrideRow,
} from "@/server/case-fix.functions";

export function OverridesSection({
  overrides,
  onChanged,
  loading = false,
}: {
  overrides: CaseMetaOverrideRow[];
  onChanged: () => void;
  /** True while the parent is (re)loading the overrides list. */
  loading?: boolean;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Loading skeleton — only shown the first time we load (no rows yet) so
  // that subsequent refreshes don't make the visible list flicker.
  if (loading && overrides.length === 0) {
    return (
      <aside
        role="status"
        aria-live="polite"
        aria-label="Loading case-meta overrides"
        className="not-prose my-3 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-100/80"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        <span>Loading overrides…</span>
      </aside>
    );
  }

  if (overrides.length === 0) return null;

  async function revert(id: string) {
    setPendingId(id);
    try {
      await revertCaseMetaOverride({ data: { id } });
      toast.success("Override reverted");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to revert override");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <aside
      role="region"
      aria-label="Active case-meta overrides"
      aria-busy={loading || pendingId !== null}
      className="not-prose my-3 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-100"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-emerald-500/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-50">
          Overrides
        </span>
        <span className="font-semibold">
          Active case-meta overrides ({overrides.length})
        </span>
        {loading && (
          <span
            className="ml-2 inline-flex items-center gap-1 text-[11px] text-emerald-100/70"
            aria-live="polite"
          >
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            Refreshing…
          </span>
        )}
      </div>
      <ul className="space-y-1">
        {overrides.map((o) => {
          const isReverting = pendingId === o.id;
          return (
            <li
              key={o.id}
              className="flex flex-wrap items-center gap-2 rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1"
            >
              <span className="font-mono text-emerald-200">{o.case_key}</span>
              <span className="text-emerald-100/40">·</span>
              <span className="font-mono">{o.field}</span>
              <span className="text-emerald-100/40">=</span>
              <code className="max-w-[280px] truncate rounded bg-emerald-500/10 px-1 py-px font-mono text-emerald-100/85">
                {typeof o.value === "string" ? o.value : JSON.stringify(o.value)}
              </code>
              <span className="ml-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1 py-px text-[10px] uppercase text-emerald-100/70">
                {o.source === "ai_suggested" ? "AI" : "manual"}
              </span>
              {o.ai_rationale && (
                <span className="basis-full break-words pl-1 text-[11px] text-emerald-100/70">
                  {o.ai_rationale}
                </span>
              )}
              <button
                type="button"
                onClick={() => revert(o.id)}
                disabled={isReverting}
                aria-busy={isReverting}
                className="ml-auto inline-flex items-center gap-1 rounded border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-100 hover:bg-red-500/20 disabled:opacity-40"
              >
                {isReverting && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                {isReverting ? "Reverting…" : "Revert"}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
