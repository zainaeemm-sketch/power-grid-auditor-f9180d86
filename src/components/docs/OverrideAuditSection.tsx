import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, Loader2, LogIn, ScrollText } from "lucide-react";
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
 * UI status for the audit panel.
 *
 * Modeled as a discriminated union so the render logic exhaustively handles
 * every state — no implicit "loading vs empty" overlap, no falsy-string traps.
 *   - loading           → first fetch in flight, nothing to show yet
 *   - unauthenticated   → visitor isn't signed in; show CTA, not an empty list
 *   - error             → real failure (db_error, config_missing, network)
 *   - loaded            → fetch completed; `rows` may legitimately be empty
 */
type AuditState =
  | { status: "loading" }
  | { status: "unauthenticated"; message: string }
  | { status: "error"; message: string }
  | { status: "loaded"; rows: CaseMetaOverrideAuditRow[] };

/**
 * Read-only audit trail for accept / revert actions on case-meta overrides.
 *
 * Server-side timestamps from `case_meta_override_audit.created_at` are the
 * source of truth — we never trust client clocks here. RLS scopes the read
 * to the current user, so "you" is always correct in this view.
 *
 * `refreshKey` is bumped by the parent after every accept/revert so the panel
 * re-pulls without us having to plumb individual events.
 */
export function OverrideAuditSection({ refreshKey = 0 }: { refreshKey?: number }) {
  const [state, setState] = useState<AuditState>({ status: "loading" });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    listCaseMetaOverrideAudit({ data: { limit: 50 } })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setState({ status: "loaded", rows: result.rows });
          return;
        }
        if (result.error === "unauthenticated") {
          setState({ status: "unauthenticated", message: result.message });
          return;
        }
        setState({ status: "error", message: result.message });
        toast.error(result.message);
      })
      .catch(async (e) => {
        if (cancelled) return;
        // Last-resort net: the server fn now returns an envelope, but a
        // genuine network failure can still throw. Normalize so we never
        // surface "[object Response]".
        const err = await normalizeServerFnError(e, "Failed to load audit log");
        setState({ status: "error", message: err.message });
        if (!err.silent) toast.error(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <aside
      role="region"
      aria-label="Case-meta override audit trail"
      aria-busy={state.status === "loading"}
      className="not-prose my-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-100"
    >
      {/* Header — always visible so the section's purpose is discoverable
          even when there's nothing to show yet. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-emerald-500/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-50">
          Audit
        </span>
        <span className="font-semibold">
          Override audit trail
          {state.status === "loaded" ? ` (${state.rows.length})` : ""}
        </span>

        {state.status === "loading" && (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-100/70">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            Loading…
          </span>
        )}

        {/* Show/hide is only meaningful when we actually have rows. */}
        {state.status === "loaded" && state.rows.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="ml-auto rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-100/80 hover:bg-emerald-500/20"
          >
            {open ? "Hide" : "Show"}
          </button>
        )}
      </div>

      {/* Loading skeleton — three faint placeholder rows so the panel
          doesn't visibly jump in height when data arrives. */}
      {state.status === "loading" && (
        <ul className="mt-2 space-y-1" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="h-7 animate-pulse rounded border border-emerald-500/20 bg-emerald-500/5"
            />
          ))}
        </ul>
      )}

      {/* Anonymous visitors: explain why the panel is empty and link to login. */}
      {state.status === "unauthenticated" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-2 text-emerald-100/80">
          <LogIn className="h-3.5 w-3.5 text-emerald-200" aria-hidden="true" />
          <span>{state.message || "Sign in to view audit logs."}</span>
          <Link
            to="/login"
            className="ml-auto rounded border border-emerald-400/50 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-50 hover:bg-emerald-500/25"
          >
            Sign in
          </Link>
        </div>
      )}

      {/* Real errors — surface the message inline so it survives navigation
          (toasts are transient). */}
      {state.status === "error" && (
        <div
          role="alert"
          className="mt-2 flex flex-wrap items-center gap-2 rounded border border-red-400/40 bg-red-500/10 px-2 py-2 text-red-100"
        >
          <AlertTriangle className="h-3.5 w-3.5 text-red-300" aria-hidden="true" />
          <span className="break-words">{state.message}</span>
        </div>
      )}

      {/* Loaded but empty: positive empty state, not a hidden panel. Keeps
          the audit feature discoverable for signed-in users with a clean
          history. */}
      {state.status === "loaded" && state.rows.length === 0 && (
        <div className="mt-2 flex items-center gap-2 rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-2 text-emerald-100/70">
          <ScrollText className="h-3.5 w-3.5 text-emerald-200" aria-hidden="true" />
          <span>
            No audit entries yet. Accepts and reverts will be recorded here
            with their server-side timestamp.
          </span>
        </div>
      )}

      {/* Loaded with data: collapsible list. */}
      {state.status === "loaded" && state.rows.length > 0 && open && (
        <ol className="mt-2 space-y-1">
          {state.rows.map((r) => {
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
                    by you ·{" "}
                    <time dateTime={r.created_at}>{formatTime(r.created_at)}</time>
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
                      "{r.ai_rationale}"
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
