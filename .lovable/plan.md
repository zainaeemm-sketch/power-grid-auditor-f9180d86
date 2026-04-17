

User confirmed email `zain.naeem@unipa.it` — likely the bootstrap admin. Proceeding with the previously-proposed plan, defaulting open questions:

- **Email**: Use Lovable Cloud's built-in email infrastructure (transactional email scaffold).
- **Existing users**: Auto-approve all existing users (incl. `zain.naeem@unipa.it`), and ensure this email gets the `admin` role so they can access the admin panel.
- **Sender domain**: Email-domain setup requires workspace admin permissions and may need DNS verification. Approval flow will work immediately; welcome email goes through the queue and will start delivering once a verified sender domain is configured (Lovable Cloud → Emails).

## Plan: Admin Approval Flow + Welcome Email

### 1. Migration

```text
user_approvals
├─ user_id uuid pk → auth.users(id) ON DELETE CASCADE
├─ status text default 'pending'   -- pending | approved | rejected
├─ email text not null
├─ requested_at timestamptz default now()
├─ reviewed_at timestamptz
├─ reviewed_by uuid
├─ notes text
```

- Trigger `on_auth_user_created` (AFTER INSERT on `auth.users`) → insert pending row.
- RLS: user can SELECT own row; admin can SELECT/UPDATE all.
- SECURITY DEFINER fn `is_user_approved(uid)` returns true if approved OR admin.
- Backfill: all existing `auth.users` → `approved`.
- Bootstrap admin: insert `user_roles(user_id, 'admin')` for the user whose email = `zain.naeem@unipa.it`.

### 2. Auth gating

- Server fn `getApprovalStatus()` → `{status, isAdmin}`.
- New public route `/pending-approval` (auth-required, NOT under `_authenticated`): shows status + sign-out + realtime listener on `user_approvals` for own row → redirects to `/` once approved.
- `_authenticated.tsx`: after auth check, fetch approval status; if pending/rejected and not admin → redirect `/pending-approval`.

### 3. Admin panel (`src/routes/_authenticated/admin.tsx`)

- `beforeLoad` checks admin role; non-admins → `/`.
- Tabs: Pending · Approved · Rejected · All.
- Table: Email · Requested · Status · Reviewed by · Actions (Approve / Reject / Revoke) + notes textarea.
- New nav link "Admin" (ShieldCheck icon) in `NavHeader.tsx`, visible only when `isAdmin`.

Server fns (`src/server/admin.functions.ts`, all guarded by `has_role`):
- `listUserApprovals({ status? })`
- `approveUser({ user_id, notes? })` → updates row, enqueues welcome email
- `rejectUser({ user_id, notes? })`
- `revokeUser({ user_id })`

### 4. Welcome email

- Run email infrastructure setup (transactional scaffold) using Lovable Cloud's built-in queue.
- Create transactional template `welcome.tsx` (React Email) — GridArena branding, link to `/`.
- `approveUser` enqueues the welcome email; failures are logged in `job_logs` but don't block approval.
- If sender domain isn't yet verified, surface a notice in the admin panel: "Welcome emails are queued and will send once your sender domain is verified."

### 5. Files

```text
supabase/migrations/<ts>_user_approvals.sql
src/server/admin.functions.ts
src/routes/_authenticated/admin.tsx
src/routes/pending-approval.tsx
src/routes/_authenticated.tsx               (add gate)
src/components/NavHeader.tsx                (admin link)
supabase/functions/_shared/email-templates/welcome.tsx
+ transactional email edge function (scaffolded)
```

### 6. Defaults applied

- Existing users auto-approved; `zain.naeem@unipa.it` granted admin role.
- Welcome email is fire-and-forget; approval succeeds even if email fails.
- Rejected users see "Account not approved" + sign-out only.

