import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, CheckCircle2, XCircle, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listRecentActivity } from "@/server/admin.functions";
import { Badge } from "@/components/ui/badge";

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

      <div className="grid gap-4 lg:grid-cols-2">
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

        <RecentActivityCard />
      </div>
    </div>
  );
}

function RecentActivityCard() {
  const list = useServerFn(listRecentActivity);
  const { data, isLoading } = useQuery({
    queryKey: ["admin_recent_activity"],
    queryFn: () => list(),
    refetchInterval: 30_000,
  });

  const items = data?.activity ?? [];

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" />
          Recent activity
        </CardTitle>
        <CardDescription>Last 10 approval decisions.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No activity yet. Approvals and rejections will appear here.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((it: any) => (
              <li
                key={it.user_id + it.reviewed_at}
                className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-muted/10 px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {it.status === "approved" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <span className="truncate font-medium">{it.email}</span>
                  <Badge
                    variant="outline"
                    className={
                      it.status === "approved"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-destructive/30 bg-destructive/10 text-destructive"
                    }
                  >
                    {it.status}
                  </Badge>
                </div>
                <span
                  className="shrink-0 text-xs text-muted-foreground"
                  title={new Date(it.reviewed_at).toLocaleString()}
                >
                  {formatRelative(it.reviewed_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}
