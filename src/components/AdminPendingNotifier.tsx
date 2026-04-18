import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to new pending user_approvals rows (admins only) and surfaces an
 * in-app toast linking to the admin panel.
 */
export function AdminPendingNotifier() {
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const channel = supabase
      .channel("admin-pending-approvals")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_approvals",
        },
        (payload) => {
          const row = payload.new as { user_id?: string; email?: string; status?: string };
          if (!row?.user_id || row.status !== "pending") return;
          if (seenRef.current.has(row.user_id)) return;
          seenRef.current.add(row.user_id);
          toast("New signup awaiting approval", {
            description: row.email ?? "A new user is pending review.",
            action: {
              label: "Review",
              onClick: () => {
                window.location.href = "/admin";
              },
            },
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
