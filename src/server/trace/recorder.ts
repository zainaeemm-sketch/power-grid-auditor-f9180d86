import type { StageType, TraceStatus } from "@/types/trace";

interface BufferedEntry {
  sequence: number;
  stage_name: string;
  stage_type: StageType;
  input_summary: string | null;
  output_summary: string | null;
  tool_name: string | null;
  status: TraceStatus;
  failure_reason: string | null;
  execution_time_ms: number;
  evidence: unknown | null;
}

function trim(s: unknown, max = 500): string | null {
  if (s === null || s === undefined) return null;
  const str = typeof s === "string" ? s : JSON.stringify(s);
  return str.length > max ? str.slice(0, max) + "…" : str;
}

/**
 * Buffers decision-trace entries during a run and flushes them as a single
 * batch insert. Failures during recording are swallowed so trace logging
 * never blocks the actual run execution.
 */
export class TraceRecorder {
  private entries: BufferedEntry[] = [];
  private seq = 0;

  record(opts: {
    stage_name: string;
    stage_type: StageType;
    input?: unknown;
    output?: unknown;
    tool_name?: string | null;
    status?: TraceStatus;
    execution_time_ms?: number;
    evidence?: unknown;
    failure_reason?: string | null;
  }) {
    this.entries.push({
      sequence: this.seq++,
      stage_name: opts.stage_name,
      stage_type: opts.stage_type,
      input_summary: trim(opts.input),
      output_summary: trim(opts.output),
      tool_name: opts.tool_name ?? null,
      status: opts.status ?? "success",
      failure_reason: opts.failure_reason ?? null,
      execution_time_ms: Math.max(0, Math.round(opts.execution_time_ms ?? 0)),
      evidence: opts.evidence ?? null,
    });
  }

  failure(opts: {
    stage_name: string;
    stage_type: StageType;
    reason: string;
    input?: unknown;
    execution_time_ms?: number;
    tool_name?: string | null;
  }) {
    this.record({
      stage_name: opts.stage_name,
      stage_type: opts.stage_type,
      input: opts.input,
      output: null,
      tool_name: opts.tool_name ?? null,
      status: "failure",
      failure_reason: opts.reason,
      execution_time_ms: opts.execution_time_ms,
    });
  }

  async flush(supabase: any, runId: string): Promise<void> {
    if (this.entries.length === 0) return;
    try {
      const rows = this.entries.map((e) => ({ run_id: runId, ...e }));
      await supabase.from("decision_traces").insert(rows);
    } catch (err) {
      console.error("TraceRecorder flush failed:", err);
    } finally {
      this.entries = [];
    }
  }
}
