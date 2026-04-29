import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  suggestCaseMetaFix,
  acceptCaseMetaFix,
  type CaseFixSuggestion,
  type JsonValue,
} from "@/server/case-fix.functions";

export type SuggestTarget = {
  caseKey: string;
  field: string;
  severity: "error" | "warning";
  message: string;
  currentValue: JsonValue | undefined;
};

type RowState = {
  target: SuggestTarget;
  status: "idle" | "loading" | "ready" | "error" | "applied";
  suggestion?: CaseFixSuggestion;
  editedValue?: string; // raw text the user can edit before accept
  error?: string;
  /** True while an Accept call is in flight. Independent of `status` so the
   *  user still sees their edits while we save. */
  accepting?: boolean;
};

function valueToText(value: JsonValue | undefined): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function textToJsonValue(text: string): JsonValue {
  const trimmed = text.trim();
  if (trimmed === "") return "";
  // Try JSON first (numbers, arrays, booleans, null, objects)
  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch {
    return trimmed;
  }
}

export function SuggestionReviewDrawer({
  targets,
  currentMetaByCase,
  onClose,
  onApplied,
}: {
  targets: SuggestTarget[];
  currentMetaByCase: Record<string, Record<string, JsonValue>>;
  onClose: () => void;
  onApplied: () => void; // called after at least one accept so caller can refetch
}) {
  const [rows, setRows] = useState<RowState[]>(() =>
    targets.map((t) => ({ target: t, status: "idle" })),
  );
  const [busy, setBusy] = useState(false);

  const updateRow = (idx: number, patch: Partial<RowState>) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  async function suggestOne(idx: number) {
    const row = rows[idx];
    if (!row) return;
    updateRow(idx, { status: "loading", error: undefined });
    try {
      const siblingMeta: Record<string, Record<string, JsonValue>> = {};
      for (const [k, v] of Object.entries(currentMetaByCase)) {
        if (k !== row.target.caseKey) siblingMeta[k] = v;
      }
      const result = await suggestCaseMetaFix({
        data: {
          caseKey: row.target.caseKey,
          field: row.target.field,
          severity: row.target.severity,
          message: row.target.message,
          currentMeta: currentMetaByCase[row.target.caseKey] ?? null,
          siblingMeta,
        },
      });
      updateRow(idx, {
        status: "ready",
        suggestion: result,
        editedValue: valueToText(result.value),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to get suggestion";
      updateRow(idx, { status: "error", error: msg });
      toast.error(msg);
    }
  }

  async function suggestAll() {
    setBusy(true);
    try {
      // Sequential to respect rate limit and keep UI responsive.
      for (let i = 0; i < rows.length; i++) {
        if (rows[i]?.status === "ready" || rows[i]?.status === "applied") continue;
        await suggestOne(i);
      }
    } finally {
      setBusy(false);
    }
  }

  async function acceptOne(idx: number) {
    const row = rows[idx];
    if (!row || !row.suggestion) return;
    const value = textToJsonValue(row.editedValue ?? "");
    updateRow(idx, { accepting: true });
    try {
      await acceptCaseMetaFix({
        data: {
          caseKey: row.target.caseKey,
          field: row.target.field,
          value,
          source: "ai_suggested",
          rationale: row.suggestion.rationale,
          model: row.suggestion.model,
        },
      });
      updateRow(idx, { status: "applied", accepting: false });
      toast.success(`Override saved for ${row.target.caseKey}.${row.target.field}`);
      onApplied();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save override";
      toast.error(msg);
      updateRow(idx, { accepting: false });
    }
  }

  function reject(idx: number) {
    updateRow(idx, { status: "idle", suggestion: undefined, editedValue: undefined });
  }

  const pendingCount = rows.filter((r) => r.status !== "applied").length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI bulk-fix suggestions"
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/70"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-emerald-500/40 bg-slate-900 text-xs text-emerald-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-emerald-500/30 px-4 py-2.5">
          <div>
            <div className="text-sm font-semibold">AI bulk-fix suggestions</div>
            <div className="text-[11px] text-emerald-100/70">
              {rows.length} field{rows.length === 1 ? "" : "s"} · {pendingCount} pending
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={suggestAll}
              disabled={busy || pendingCount === 0}
              className="rounded border border-emerald-400/50 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Suggesting…" : `Suggest all (${pendingCount})`}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close drawer"
              className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] hover:bg-emerald-500/20"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-4 py-3">
          <ul className="space-y-3">
            {rows.map((row, idx) => (
              <li
                key={`${row.target.caseKey}.${row.target.field}.${idx}`}
                className="rounded border border-emerald-500/20 bg-emerald-500/5 p-3"
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-emerald-200">{row.target.caseKey}</span>
                  <span className="text-emerald-100/40">·</span>
                  <span className="font-mono text-emerald-100">{row.target.field}</span>
                  <span
                    className={`ml-1 rounded border px-1 py-px text-[10px] font-semibold uppercase ${
                      row.target.severity === "error"
                        ? "border-red-400/50 bg-red-500/20 text-red-100"
                        : "border-amber-300/50 bg-amber-400/20 text-amber-100"
                    }`}
                  >
                    {row.target.severity}
                  </span>
                  {row.status === "applied" && (
                    <span className="ml-auto rounded border border-emerald-400/60 bg-emerald-500/30 px-1.5 py-px text-[10px] font-semibold text-emerald-50">
                      Applied
                    </span>
                  )}
                </div>

                {row.target.message && (
                  <div className="mb-1.5 break-words font-mono text-[11px] text-emerald-100/65">
                    {row.target.message}
                  </div>
                )}

                <div className="mb-1.5 text-[11px] text-emerald-100/70">
                  Current value:{" "}
                  <code className="rounded bg-emerald-500/10 px-1 py-px font-mono text-emerald-100/85">
                    {row.target.currentValue === undefined
                      ? "(missing)"
                      : valueToText(row.target.currentValue)}
                  </code>
                </div>

                {row.status === "idle" || row.status === "error" ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => suggestOne(idx)}
                      className="rounded border border-emerald-400/50 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold hover:bg-emerald-500/25"
                    >
                      Suggest fix
                    </button>
                    {row.status === "error" && row.error && (
                      <span className="text-[11px] text-red-300">{row.error}</span>
                    )}
                  </div>
                ) : null}

                {row.status === "loading" && (
                  <div className="text-[11px] italic text-emerald-100/60">Asking OpenAI…</div>
                )}

                {(row.status === "ready" || row.status === "applied") && row.suggestion && (
                  <div className="mt-1 space-y-2">
                    <div className="text-[11px] text-emerald-100/80">
                      <span className="font-semibold">Rationale:</span> {row.suggestion.rationale}{" "}
                      <span className="ml-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1 py-px text-[10px] uppercase text-emerald-100/80">
                        {row.suggestion.confidence}
                      </span>
                    </div>
                    <label className="block">
                      <span className="mb-0.5 block text-[10px] uppercase tracking-wider text-emerald-100/60">
                        Proposed value (editable)
                      </span>
                      <textarea
                        value={row.editedValue ?? ""}
                        onChange={(e) => updateRow(idx, { editedValue: e.target.value })}
                        rows={Math.min(8, Math.max(2, (row.editedValue ?? "").split("\n").length))}
                        className="w-full rounded border border-emerald-500/30 bg-slate-950/60 p-1.5 font-mono text-[11px] text-emerald-50 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-300"
                        disabled={row.status === "applied"}
                      />
                    </label>
                    {row.status !== "applied" && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => acceptOne(idx)}
                          className="rounded border border-emerald-400/60 bg-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold hover:bg-emerald-500/40"
                        >
                          Accept & save
                        </button>
                        <button
                          type="button"
                          onClick={() => reject(idx)}
                          className="rounded border border-emerald-500/30 bg-emerald-500/5 px-2 py-0.5 text-[11px] hover:bg-emerald-500/15"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => suggestOne(idx)}
                          className="rounded border border-emerald-500/30 bg-emerald-500/5 px-2 py-0.5 text-[11px] hover:bg-emerald-500/15"
                        >
                          Re-roll
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        <footer className="border-t border-emerald-500/30 px-4 py-2 text-[11px] text-emerald-100/60">
          Suggestions never auto-apply. Each Accept saves an override scoped to your account.
        </footer>
      </div>
    </div>
  );
}
