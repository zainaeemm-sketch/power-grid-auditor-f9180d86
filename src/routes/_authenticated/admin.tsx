import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  isCurrentUserAdmin,
  listUserApprovals,
  approveUser,
  rejectUser,
  revokeUser,
  resendWelcomeEmail,
} from "@/server/admin.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, RotateCcw, AlertCircle, Mail } from "lucide-react";
import { toast } from "sonner";
import { AdminShell, type AdminSection } from "@/components/admin/AdminShell";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminSettings } from "@/components/admin/AdminSettings";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type Status = "pending" | "approved" | "rejected" | "all";

function AdminPage() {
  const navigate = useNavigate();
  const checkAdmin = useServerFn(isCurrentUserAdmin);
  const list = useServerFn(listUserApprovals);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [section, setSection] = useState<AdminSection>("dashboard");

  useEffect(() => {
    checkAdmin()
      .then((r) => {
        if (!r.isAdmin) {
          navigate({ to: "/" });
        } else {
          setAuthorized(true);
        }
      })
      .catch(() => navigate({ to: "/" }));
  }, [checkAdmin, navigate]);

  const { data: allData } = useQuery({
    queryKey: ["user_approvals", "all"],
    queryFn: () => list({ data: { status: "all" } }),
    enabled: !!authorized,
  });

  const counts = useMemo(() => {
    const rows = allData?.approvals ?? [];
    return {
      pending: rows.filter((r: any) => r.status === "pending").length,
      approved: rows.filter((r: any) => r.status === "approved").length,
      rejected: rows.filter((r: any) => r.status === "rejected").length,
    };
  }, [allData]);

  if (!authorized) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-muted-foreground">Verifying admin access…</div>
      </div>
    );
  }

  return (
    <AdminShell active={section} onChange={setSection} pendingCount={counts.pending}>
      {section === "dashboard" && (
        <AdminDashboard
          pending={counts.pending}
          approved={counts.approved}
          rejected={counts.rejected}
          onJump={() => setSection("users")}
        />
      )}

      {section === "users" && <UsersSection />}

      {section === "settings" && <AdminSettings />}
    </AdminShell>
  );
}

function UsersSection() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">User Approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Approve or reject new sign-ups. Approved users receive a welcome email.
        </p>
      </div>

      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="flex items-start gap-3 py-4">
          <AlertCircle className="mt-0.5 h-4 w-4 text-warning" />
          <div className="text-sm">
            <strong>Welcome emails</strong> are queued and will start delivering once a sender domain
            is verified in <em>Lovable Cloud → Emails</em>. Approval still works without it.
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        {(["pending", "approved", "rejected", "all"] as Status[]).map((s) => (
          <TabsContent key={s} value={s}>
            <ApprovalsTable status={s} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ApprovalsTable({ status }: { status: Status }) {
  const list = useServerFn(listUserApprovals);
  const approve = useServerFn(approveUser);
  const reject = useServerFn(rejectUser);
  const revoke = useServerFn(revokeUser);
  const resend = useServerFn(resendWelcomeEmail);
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const queryKey = useMemo(() => ["user_approvals", status], [status]);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => list({ data: { status } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["user_approvals"] });
  };

  const approveMut = useMutation({
    mutationFn: (vars: { user_id: string; notes?: string }) => approve({ data: vars }),
    onSuccess: () => {
      toast.success("User approved — welcome email queued");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to approve"),
  });

  const rejectMut = useMutation({
    mutationFn: (vars: { user_id: string; notes?: string }) => reject({ data: vars }),
    onSuccess: () => {
      toast.success("User rejected");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to reject"),
  });

  const revokeMut = useMutation({
    mutationFn: (vars: { user_id: string }) => revoke({ data: vars }),
    onSuccess: () => {
      toast.success("Access revoked");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to revoke"),
  });

  const resendMut = useMutation({
    mutationFn: (vars: { user_id: string }) => resend({ data: vars }),
    onSuccess: () => toast.success("Welcome email re-queued"),
    onError: (e: any) => toast.error(e?.message ?? "Failed to resend email"),
  });

  const rows = data?.approvals ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {status === "all" ? "All users" : `${status[0].toUpperCase()}${status.slice(1)} users`}
        </CardTitle>
        <CardDescription>{rows.length} record(s)</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No users to show.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reviewed</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.user_id}>
                  <TableCell className="font-medium">{r.email}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(r.requested_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.reviewed_at ? new Date(r.reviewed_at).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <Textarea
                      placeholder="Optional notes…"
                      className="min-h-[40px] text-xs"
                      value={notes[r.user_id] ?? r.notes ?? ""}
                      onChange={(e) => setNotes((p) => ({ ...p, [r.user_id]: e.target.value }))}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {r.status !== "approved" && (
                        <Button
                          size="sm"
                          variant="default"
                          disabled={approveMut.isPending}
                          onClick={() =>
                            approveMut.mutate({ user_id: r.user_id, notes: notes[r.user_id] })
                          }
                        >
                          <Check className="mr-1 h-3 w-3" /> Approve
                        </Button>
                      )}
                      {r.status !== "rejected" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={rejectMut.isPending}
                          onClick={() =>
                            rejectMut.mutate({ user_id: r.user_id, notes: notes[r.user_id] })
                          }
                        >
                          <X className="mr-1 h-3 w-3" /> Reject
                        </Button>
                      )}
                      {r.status === "approved" && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={resendMut.isPending}
                            onClick={() => resendMut.mutate({ user_id: r.user_id })}
                          >
                            <Mail className="mr-1 h-3 w-3" /> Resend email
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={revokeMut.isPending}
                            onClick={() => revokeMut.mutate({ user_id: r.user_id })}
                          >
                            <RotateCcw className="mr-1 h-3 w-3" /> Revoke
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    approved: "bg-primary/15 text-primary border-primary/30",
    pending: "bg-muted text-muted-foreground border-border",
    rejected: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return (
    <Badge variant="outline" className={variants[status] ?? ""}>
      {status}
    </Badge>
  );
}
