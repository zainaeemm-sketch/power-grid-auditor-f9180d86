import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, CheckCircle2, XCircle } from "lucide-react";

interface Props {
  pending: number;
  approved: number;
  rejected: number;
  onJump: () => void;
}

export function AdminDashboard({ pending, approved, rejected, onJump }: Props) {
  const total = pending + approved + rejected;
  const stats = [
    { label: "Total users", value: total, icon: Users, accent: "text-foreground" },
    { label: "Pending", value: pending, icon: Clock, accent: "text-primary" },
    { label: "Approved", value: approved, icon: CheckCircle2, accent: "text-emerald-400" },
    { label: "Rejected", value: rejected, icon: XCircle, accent: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of user approvals and access requests.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, accent }) => (
          <Card key={label} className="border-border/60 bg-card/60">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {label}
                </div>
                <div className={`mt-1 text-2xl font-bold ${accent}`}>{value}</div>
              </div>
              <Icon className={`h-5 w-5 ${accent}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">At a glance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {pending > 0 ? (
            <button
              onClick={onJump}
              className="flex w-full items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-left transition hover:bg-primary/10"
            >
              <span>
                <strong className="text-primary">{pending}</strong>{" "}
                {pending === 1 ? "user is" : "users are"} waiting for approval.
              </span>
              <span className="text-xs text-primary">Review →</span>
            </button>
          ) : (
            <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-3 text-muted-foreground">
              No pending approvals. Nice and tidy.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
