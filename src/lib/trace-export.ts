import type { DecisionTrace } from "@/types/trace";

function csvField(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportTraceCsv(runId: string, traces: DecisionTrace[]): void {
  const headers = [
    "sequence",
    "stage_name",
    "stage_type",
    "status",
    "execution_time_ms",
    "failure_reason",
    "tool_name",
    "input_summary",
    "output_summary",
  ];
  const rows = traces.map((t) =>
    [
      t.sequence,
      t.stage_name,
      t.stage_type,
      t.status,
      t.execution_time_ms,
      t.failure_reason,
      t.tool_name,
      t.input_summary,
      t.output_summary,
    ]
      .map(csvField)
      .join(","),
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `trace_run_${runId}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
