import { createFileRoute, Outlet, useNavigate, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getApprovalStatus } from "@/server/admin.functions";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const fetchStatus = useServerFn(getApprovalStatus);
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    let active = true;
    setChecking(true);
    fetchStatus()
      .then((res) => {
        if (!active) return;
        if (res.isAdmin || res.status === "approved") {
          setAllowed(true);
          // Invalidate child route loaders so they re-run with auth headers.
          // SSR loaders return null because no auth header is attached;
          // this triggers the client refetch once the user is verified.
          router.invalidate();
        } else {
          navigate({ to: "/pending-approval" });
        }
      })
      .catch(() => {
        if (active) navigate({ to: "/pending-approval" });
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [isLoading, isAuthenticated, fetchStatus, navigate, router]);

  if (isLoading || checking) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated || !allowed) {
    return null;
  }

  return <Outlet />;
}
