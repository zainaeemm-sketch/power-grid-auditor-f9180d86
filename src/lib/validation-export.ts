import { downloadCsv } from "./csv-export";

export interface ValidationRow {
  test_name: string;
  test_type: string;
  status: string;
  execution_time_ms: number;
  expected_output: unknown;
  actual_output: unknown;
  failure_reason: string | null;
  debug_hint: string | null;
  system_version: string | null;
  parser_version: string | null;
  evaluation_logic_version: string | null;
  created_at: string;
}

export function exportValidationJson(rows: ValidationRow[]) {
  const blob = new Blob([JSON.stringify({ generated_at: new Date().toISOString(), rows }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.href = url;
  a.download = `validation_report_${ts}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportValidationCsv(rows: ValidationRow[]) {
  const headers = [
    "test_name", "test_type", "status", "execution_time_ms",
    "failure_reason", "debug_hint",
    "expected_output", "actual_output",
    "system_version", "parser_version", "evaluation_logic_version", "created_at",
  ];
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const body = rows.map((r) => [
    r.test_name, r.test_type, r.status, String(r.execution_time_ms),
    r.failure_reason ?? "", r.debug_hint ?? "",
    JSON.stringify(r.expected_output ?? null),
    JSON.stringify(r.actual_output ?? null),
    r.system_version ?? "", r.parser_version ?? "", r.evaluation_logic_version ?? "",
    r.created_at,
  ].map(esc).join(","));
  const csv = [headers.join(","), ...body].join("\n");
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  downloadCsv(csv, `validation_report_${ts}.csv`);
}
