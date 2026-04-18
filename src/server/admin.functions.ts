import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { withAuthHeaders } from "@/middleware/auth-headers";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const getApprovalStatus = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roleData ?? []).some((r: any) => r.role === "admin");

    if (isAdmin) {
      return { status: "approved" as const, isAdmin: true };
    }

    const { data, error } = await supabase
      .from("user_approvals")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return {
      status: (data?.status ?? "pending") as "pending" | "approved" | "rejected",
      isAdmin: false,
    };
  });

export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (error) throw new Error(error.message);
    return { isAdmin: !!data };
  });

const listSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "all"]).default("pending"),
});

export const listUserApprovals = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: unknown) => listSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    let query = supabaseAdmin
      .from("user_approvals")
      .select("*")
      .order("requested_at", { ascending: false });

    if (data.status !== "all") {
      query = query.eq("status", data.status);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { approvals: rows ?? [] };
  });

async function enqueueWelcomeEmail(userId: string, email: string) {
  try {
    // Fire-and-forget welcome email job. Will be picked up if email queue exists.
    await supabaseAdmin.from("job_queue").insert({
      user_id: userId,
      job_type: "send_welcome_email",
      payload: { email, user_id: userId },
      priority: 5,
    });
  } catch (err) {
    console.error("Failed to enqueue welcome email", err);
  }
}

const approveSchema = z.object({
  user_id: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});

export const approveUser = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: unknown) => approveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: row, error } = await supabaseAdmin
      .from("user_approvals")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
        notes: data.notes ?? null,
      })
      .eq("user_id", data.user_id)
      .select("user_id, email")
      .single();

    if (error) throw new Error(error.message);
    if (row) await enqueueWelcomeEmail(row.user_id, row.email);

    return { success: true };
  });

export const rejectUser = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: unknown) => approveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { error } = await supabaseAdmin
      .from("user_approvals")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
        notes: data.notes ?? null,
      })
      .eq("user_id", data.user_id);

    if (error) throw new Error(error.message);
    return { success: true };
  });

const revokeSchema = z.object({ user_id: z.string().uuid() });

export const revokeUser = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: unknown) => revokeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { error } = await supabaseAdmin
      .from("user_approvals")
      .update({
        status: "pending",
        reviewed_at: null,
        reviewed_by: null,
      })
      .eq("user_id", data.user_id);

    if (error) throw new Error(error.message);
    return { success: true };
  });
