import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withAuthHeaders } from "@/middleware/auth-headers";

function getServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Server is missing Supabase service-role configuration");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const getApprovalStatus = createServerFn({ method: "POST" })
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

export const isCurrentUserAdmin = createServerFn({ method: "POST" })
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

    let query = supabase
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

export const listRecentActivity = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data, error } = await supabase
      .from("user_approvals")
      .select("user_id, email, status, reviewed_at, reviewed_by, notes")
      .in("status", ["approved", "rejected"])
      .not("reviewed_at", "is", null)
      .order("reviewed_at", { ascending: false })
      .limit(10);

    if (error) throw new Error(error.message);
    return { activity: data ?? [] };
  });

async function enqueueWelcomeEmail(supabase: any, userId: string, email: string) {
  try {
    await supabase.from("job_queue").insert({
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

    const { data: row, error } = await supabase
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
    if (row) await enqueueWelcomeEmail(supabase, row.user_id, row.email);

    return { success: true };
  });

export const rejectUser = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: unknown) => approveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { error } = await supabase
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

    const { error } = await supabase
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

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("user_id, created_at")
      .eq("role", "admin")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (roles ?? []).map((r: any) => r.user_id);
    if (ids.length === 0) return { admins: [] };

    const { data: emails } = await supabase
      .from("user_approvals")
      .select("user_id, email")
      .in("user_id", ids);
    const emailMap = new Map((emails ?? []).map((e: any) => [e.user_id, e.email]));

    return {
      admins: (roles ?? []).map((r: any) => ({
        user_id: r.user_id,
        email: emailMap.get(r.user_id) ?? "(unknown)",
        granted_at: r.created_at,
      })),
    };
  });

const grantSchema = z.object({ email: z.string().email() });

export const grantAdminByEmail = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: unknown) => grantSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: row, error: lookupErr } = await supabase
      .from("user_approvals")
      .select("user_id")
      .eq("email", data.email)
      .maybeSingle();
    if (lookupErr) throw new Error(lookupErr.message);
    if (!row) throw new Error(`No user found with email ${data.email}`);

    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: row.user_id, role: "admin" });
    if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);

    return { success: true };
  });

const revokeAdminSchema = z.object({ user_id: z.string().uuid() });

export const revokeAdmin = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: unknown) => revokeAdminSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    if (data.user_id === userId) {
      throw new Error("You cannot revoke your own admin role");
    }

    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const resendWelcomeEmail = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: unknown) => revokeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: row, error } = await supabase
      .from("user_approvals")
      .select("user_id, email, status")
      .eq("user_id", data.user_id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("User not found");
    if (row.status !== "approved") {
      throw new Error("Only approved users can receive a welcome email");
    }

    await enqueueWelcomeEmail(supabase, row.user_id, row.email);
    return { success: true };
  });

const createUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  role: z.enum(["user", "admin"]).default("user"),
  auto_approve: z.boolean().default(true),
  send_welcome_email: z.boolean().default(true),
});

export const createUserManually = createServerFn({ method: "POST" })
  .middleware([withAuthHeaders, requireSupabaseAuth])
  .inputValidator((input: unknown) => createUserSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const admin = getServiceRoleClient();

    // Create the auth user (auto-confirmed)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });

    if (createErr || !created?.user) {
      const msg = createErr?.message ?? "Failed to create user";
      if (/already registered|already exists|duplicate/i.test(msg)) {
        throw new Error("A user with this email already exists");
      }
      throw new Error(msg);
    }

    const newUserId = created.user.id;
    const nowIso = new Date().toISOString();
    const status = data.auto_approve ? "approved" : "pending";

    // Upsert approval row (the on_auth_user_created trigger may have inserted a pending row)
    const { error: approvalErr } = await admin
      .from("user_approvals")
      .upsert(
        {
          user_id: newUserId,
          email: data.email,
          status,
          requested_at: nowIso,
          reviewed_at: data.auto_approve ? nowIso : null,
          reviewed_by: data.auto_approve ? userId : null,
          notes: "Created manually by admin",
        },
        { onConflict: "user_id" },
      );
    if (approvalErr) {
      // Roll back the auth user so we don't leave orphans
      await admin.auth.admin.deleteUser(newUserId).catch(() => {});
      throw new Error(approvalErr.message);
    }

    if (data.role === "admin") {
      const { error: roleErr } = await admin
        .from("user_roles")
        .insert({ user_id: newUserId, role: "admin" });
      if (roleErr && !/duplicate/i.test(roleErr.message)) {
        throw new Error(roleErr.message);
      }
    }

    if (data.send_welcome_email && data.auto_approve) {
      await enqueueWelcomeEmail(admin, newUserId, data.email);
    }

    return { user_id: newUserId, email: data.email, status };
  });
