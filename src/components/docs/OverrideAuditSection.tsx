import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  listCaseMetaOverrideAudit,
  type CaseMetaOverrideAuditRow,
} from "@/server/case-fix.functions";
import { normalizeServerFnError } from "@/lib/server-fn-errors";

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatValue(v: CaseMetaOverrideAuditRow["new_value"]): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

/**
 * Read-only audit trail for accept / revert actions on case-meta overrides.
 *
 * Server-side timestamps from `case_meta_override_audit.created_at` are the
 * source of truth — we never trust client clocks here. Each row also captures
 * who acted (RLS scopes the read to the current user, so "you" is always
 * correct in this view).
 *
 * `refreshKey` is bumped by the parent after every accept/revert so the panel
 * re-pulls without us having to plumb individual events.
 */
export function OverrideAuditSection({ refreshKey = 0 }: { refreshKey?: number }) {
  const [rows, setRows] = useState<CaseMetaOverrideAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listCaseMetaOverrideAudit({ data: { limit: 50 } })
      .then((r) => {
        if (!cancelled) setRows(Array.isArray(r) ? r : []);
      })
      .catch(async (e) => {
        if (cancelled) return;
        const err = await normalizeServerFnError(e, "Failed to load audit log");
        if (!err.silent) toast.error(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Hide entirely when there's nothing to show and we're done loading,
  // matching OverridesSection's "no clutter when empty" behavior.
  if (!loading && rows.length === 0) return null;

  return (
    <aside
      role="region"
      aria-label="Case-meta override audit trail"
      aria-busy={loading}
      className="not-prose my-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-100"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className="rounded bg-emerald-500/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-50">
          Audit
        </span>
        <span className="font-semibold">
          Override audit trail{loading ? "" : ` (${rows.length})`}
        </span>
        {loading && (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-100/70">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            Loading…
          </span>
        )}
        <span className="ml-auto text-[11px] text-emerald-100/60">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && !loading && (
        <ol className="mt-2 space-y-1">
          {rows.map((r) => {
            const isRevert = r.action === "revert";
            return (
              <li
                key={r.id}
                className="rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded border px-1 py-px text-[10px] font-semibold uppercase ${
                      isRevert
                        ? "border-red-400/50 bg-red-500/20 text-red-100"
                        : "border-emerald-400/60 bg-emerald-500/30 text-emerald-50"
                    }`}
                  >
                    {r.action}
                  </span>
                  <span className="font-mono text-emerald-200">{r.case_key}</span>
                  <span className="text-emerald-100/40">·</span>
                  <span className="font-mono">{r.field}</span>
                  {r.source && (
                    <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1 py-px text-[10px] uppercase text-emerald-100/70">
                      {r.source === "ai_suggested" ? "AI" : "manual"}
                    </span>
                  )}
                  <span className="ml-auto text-[11px] text-emerald-100/60">
                    by you · <time dateTime={r.created_at}>{formatTime(r.created_at)}</time>
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 pl-1 text-[11px] text-emerald-100/75">
                  <code className="max-w-[220px] truncate rounded bg-emerald-500/10 px-1 py-px font-mono">
                    {formatValue(r.previous_value)}
                  </code>
                  <span aria-hidden="true">→</span>
                  <code className="max-w-[220px] truncate rounded bg-emerald-500/10 px-1 py-px font-mono">
                    {formatValue(r.new_value)}
                  </code>
                  {r.ai_rationale && (
                    <span className="basis-full break-words text-emerald-100/60">
                      “{r.ai_rationale}”
                      {r.ai_model ? ` — ${r.ai_model}` : ""}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
