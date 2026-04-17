import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, LogOut, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/pending-approval")({
  component: PendingApprovalPage,
});

function PendingApprovalPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;

    const fetchStatus = async () => {
      const { data } = await supabase
        .from("user_approvals")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      const s = (data?.status ?? "pending") as "pending" | "approved" | "rejected";
      setStatus(s);
      if (s === "approved") navigate({ to: "/" });
    };

    fetchStatus();

    const channel = supabase
      .channel(`approval-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_approvals",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newStatus = (payload.new as any)?.status;
          if (newStatus) {
            setStatus(newStatus);
            if (newStatus === "approved") navigate({ to: "/" });
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id, navigate]);

  const isRejected = status === "rejected";

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            {isRejected ? <ShieldAlert className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
          </div>
          <CardTitle>
            {isRejected ? "Account not approved" : "Awaiting approval"}
          </CardTitle>
          <CardDescription>
            {isRejected
              ? "Your account access has been declined. Please contact an administrator if you believe this is a mistake."
              : "Your account is pending administrator approval. You'll be redirected automatically once approved."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="text-muted-foreground">Signed in as</div>
            <div className="truncate font-medium">{user?.email}</div>
          </div>
          <Button variant="outline" className="w-full" onClick={() => logout()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
