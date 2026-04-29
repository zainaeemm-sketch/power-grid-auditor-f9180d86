import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  bulkRevertCaseMetaOverrides,
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
  // True while the bulk action is in flight.
  const [bulkPending, setBulkPending] = useState(false);
  // Optimistically-removed override ids. Hidden from the rendered list
  // immediately on click; restored if the server action fails.
  const [optimisticallyRemoved, setOptimisticallyRemoved] = useState<Set<string>>(
    () => new Set(),
  );
  // Per-row selection for bulk actions.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  // Drop ids from the optimistic-remove set once the parent confirms they're
  // gone from the canonical `overrides` list (avoids stale entries when the
  // server-side revert succeeds and the parent refetches). Also prune
  // selection of ids that are no longer present.
  const presentIds = overrides.map((o) => o.id).join("|");
  useEffect(() => {
    const present = new Set(overrides.map((o) => o.id));
    setOptimisticallyRemoved((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set(prev);
      for (const id of prev) {
        if (!present.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Set(prev);
      for (const id of prev) {
        if (!present.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // We intentionally key the effect on the joined id list so it re-runs
    // whenever the parent swaps in a new overrides snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentIds]);

  const visibleOverrides = useMemo(
    () => overrides.filter((o) => !optimisticallyRemoved.has(o.id)),
    [overrides, optimisticallyRemoved],
  );

  // Loading skeleton — only shown the first time we load (no rows yet) so
  // that subsequent refreshes don't make the visible list flicker.
  if (loading && visibleOverrides.length === 0 && overrides.length === 0) {
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

  if (visibleOverrides.length === 0) return null;

  const visibleIds = visibleOverrides.map((o) => o.id);
  const selectedVisibleIds = visibleIds.filter((id) => selectedIds.has(id));
  const allSelected = visibleIds.length > 0 && selectedVisibleIds.length === visibleIds.length;
  const someSelected = selectedVisibleIds.length > 0 && !allSelected;

  function toggleId(id: string, on: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(on: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function revert(id: string) {
    setPendingId(id);
    // Optimistically hide the row immediately.
    setOptimisticallyRemoved((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    try {
      await revertCaseMetaOverride({ data: { id } });
      toast.success("Override reverted");
      onChanged();
    } catch (e) {
      // Roll back: re-show the row so the user can retry.
      setOptimisticallyRemoved((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.error(e instanceof Error ? e.message : "Failed to revert override");
    } finally {
      setPendingId(null);
    }
  }

  async function bulkRevert() {
    const ids = selectedVisibleIds;
    if (ids.length === 0 || bulkPending) return;
    setBulkPending(true);
    // Optimistically hide every selected row.
    setOptimisticallyRemoved((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
    try {
      const result = await bulkRevertCaseMetaOverrides({ data: { ids } });
      const reverted = result?.reverted_ids?.length ?? ids.length;
      const skipped = result?.skipped_ids?.length ?? 0;
      // Rollback any ids the server reported as skipped (e.g. already gone).
      if (skipped > 0 && Array.isArray(result?.skipped_ids)) {
        setOptimisticallyRemoved((prev) => {
          const next = new Set(prev);
          for (const id of result.skipped_ids) next.delete(id);
          return next;
        });
      }
      // Drop reverted ids from the selection so the toolbar resets cleanly.
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      if (reverted > 0) {
        toast.success(
          skipped > 0
            ? `Reverted ${reverted} override${reverted === 1 ? "" : "s"} (${skipped} skipped)`
            : `Reverted ${reverted} override${reverted === 1 ? "" : "s"}`,
        );
      } else {
        toast.error("No overrides were reverted");
      }
      onChanged();
    } catch (e) {
      // Full rollback: re-show every row we tried to remove.
      setOptimisticallyRemoved((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      toast.error(e instanceof Error ? e.message : "Failed to revert selected overrides");
    } finally {
      setBulkPending(false);
    }
  }

  const busy = loading || pendingId !== null || bulkPending;

  return (
    <aside
      role="region"
      aria-label="Active case-meta overrides"
      aria-busy={busy}
      className="not-prose my-3 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-100"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded bg-emerald-500/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-50">
          Overrides
        </span>
        <span className="font-semibold">
          Active case-meta overrides ({visibleOverrides.length})
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

        <div className="ml-auto flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-[11px] text-emerald-100/80">
            <input
              type="checkbox"
              aria-label="Select all overrides"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected;
              }}
              onChange={(e) => toggleAll(e.target.checked)}
              disabled={bulkPending}
              className="h-3.5 w-3.5 cursor-pointer accent-emerald-400"
            />
            <span>
              {selectedVisibleIds.length > 0
                ? `${selectedVisibleIds.length} selected`
                : "Select all"}
            </span>
          </label>
          <button
            type="button"
            onClick={bulkRevert}
            disabled={selectedVisibleIds.length === 0 || bulkPending}
            aria-busy={bulkPending}
            className="inline-flex items-center gap-1 rounded border border-red-400/50 bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-100 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {bulkPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
            {bulkPending
              ? "Reverting…"
              : `Revert selected${
                  selectedVisibleIds.length > 0 ? ` (${selectedVisibleIds.length})` : ""
                }`}
          </button>
        </div>
      </div>
      <ul className="space-y-1">
        {visibleOverrides.map((o) => {
          const isReverting = pendingId === o.id;
          const isSelected = selectedIds.has(o.id);
          return (
            <li
              key={o.id}
              className="flex flex-wrap items-center gap-2 rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1"
            >
              <input
                type="checkbox"
                aria-label={`Select override ${o.case_key} ${o.field}`}
                checked={isSelected}
                onChange={(e) => toggleId(o.id, e.target.checked)}
                disabled={bulkPending || isReverting}
                className="h-3.5 w-3.5 cursor-pointer accent-emerald-400"
              />
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
                disabled={isReverting || bulkPending}
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
