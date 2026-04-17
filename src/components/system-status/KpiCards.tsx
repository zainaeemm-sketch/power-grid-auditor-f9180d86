import { Card, CardContent } from "@/components/ui/card";

export interface JobStats {
  active?: number;
  queued?: number;
  completed_24h?: number;
  failed_24h?: number;
  avg_execution_ms?: number;
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${accent ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

export function KpiCards({ stats }: { stats?: JobStats }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
      <KpiCard label="Active" value={stats?.active ?? 0} accent="text-primary" />
      <KpiCard label="Queued" value={stats?.queued ?? 0} />
      <KpiCard label="Completed (24h)" value={stats?.completed_24h ?? 0} accent="text-emerald-500" />
      <KpiCard label="Failed (24h)" value={stats?.failed_24h ?? 0} accent="text-destructive" />
      <KpiCard label="Avg time (ms)" value={stats?.avg_execution_ms ?? 0} />
    </div>
  );
}
