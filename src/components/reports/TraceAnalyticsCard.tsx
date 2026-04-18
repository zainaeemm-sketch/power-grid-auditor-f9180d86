import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getBatchTraceAnalytics } from "@/server/trace.functions";
import type { BatchTraceAnalytics } from "@/types/trace";
import { ReportSection } from "@/components/reports/ReportSection";
import { ReportChart } from "@/components/reports/ReportChart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function TraceAnalyticsCard({ batchId }: { batchId: string }) {
  const fetchFn = useServerFn(getBatchTraceAnalytics);
  const [data, setData] = useState<BatchTraceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFn({ data: { batchId } })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [batchId, fetchFn]);

  if (loading || !data || data.total_traces === 0) {
    return (
      <ReportSection title="Decision Trace Analytics">
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading trace analytics…" : "No trace data available for runs in this batch."}
        </p>
      </ReportSection>
    );
  }

  const chartData = data.per_stage.map((s) => ({
    name: s.stage_type,
    failures: s.failures,
    avg_ms: s.avg_time_ms,
  }));

  return (
    <ReportSection title="Decision Trace Analytics">
      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-md border border-border/40 bg-background/40 p-3">
          <div className="text-xs text-muted-foreground">Total Traces</div>
          <div className="font-mono text-lg">{data.total_traces}</div>
        </div>
        <div className="rounded-md border border-border/40 bg-background/40 p-3">
          <div className="text-xs text-muted-foreground">Most Common Failure Stage</div>
          <div className="font-mono text-lg">{data.most_common_failure_stage ?? "—"}</div>
        </div>
        <div className="rounded-md border border-border/40 bg-background/40 p-3">
          <div className="text-xs text-muted-foreground">Stages Captured</div>
          <div className="font-mono text-lg">{data.per_stage.length}</div>
        </div>
      </div>
      <ReportChart title="Failure Frequency by Stage" filenameBase={`batch_${batchId.slice(0, 8)}_trace_failures`}>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af40" />
              <XAxis dataKey="name" fontSize={11} angle={-25} textAnchor="end" height={60} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="failures" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ReportChart>
      <ReportChart title="Average Execution Time per Stage (ms)" filenameBase={`batch_${batchId.slice(0, 8)}_trace_time`}>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af40" />
              <XAxis dataKey="name" fontSize={11} angle={-25} textAnchor="end" height={60} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="avg_ms" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ReportChart>
    </ReportSection>
  );
}
