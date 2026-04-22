

## Manually add a user from the Admin panel

Add a "Create user" action on the admin Users page so you can provision an account directly with email + password, skipping the public signup → approval flow.

### What you'll see

On the **Users** section of `/admin`, a new **"+ Add user"** button next to the status tabs. Clicking it opens a dialog:

- **Email** (required)
- **Password** (required, min 8 chars, with show/hide toggle and a "Generate strong password" button)
- **Role**: User · Admin (radio)
- **Auto-approve** (checkbox, default ON — since you're creating them, no review needed)
- **Send welcome email** (checkbox, default ON — uses the existing welcome-email job)

Buttons: **Cancel** · **Create user**.

On success: toast *"User created — {email}"*, the new row appears immediately in the Users list (Approved or Pending depending on the toggle), dialog closes.

### Behaviour

- The email is **auto-confirmed** (no verification link needed — you set the password, you vouch for it).
- If "Auto-approve" is on → `user_approvals.status = approved`, `reviewed_by = you`, `reviewed_at = now()`.
- If "Admin" role is selected → row inserted into `user_roles` with role `admin`.
- If "Send welcome email" is on AND the user is approved → existing `send_welcome_email` job is enqueued (will start sending once the email infrastructure from the previous plan ships; harmless no-op until then).
- Duplicate email → friendly inline error *"A user with this email already exists"*, no partial state created.

### Files / changes

**New server function** — `src/server/admin.functions.ts` (append `createUserManually`):
- Admin-only (`assertAdmin`).
- Uses a Supabase **service-role** client (created inline with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from env) to call `auth.admin.createUser({ email, password, email_confirm: true })`.
- Then inserts/updates `user_approvals` (approved or pending), optionally inserts `user_roles` admin row, optionally enqueues the welcome job.
- Zod input validation: email format, password ≥ 8 chars, role enum, two booleans.
- Returns `{ user_id, email, status }`.

**New component** — `src/components/admin/CreateUserDialog.tsx`:
- shadcn Dialog with Form (react-hook-form + zod), password visibility toggle, generator (16-char `crypto.getRandomValues` mix).
- Calls `createUserManually` via `useServerFn` + `useMutation`, invalidates `["user_approvals", "all"]` on success.

**Edit** — `src/routes/_authenticated/admin.tsx`:
- Render `<CreateUserDialog />` trigger button in the Users section header (next to the status tabs).
- No other layout changes.

### Security

- Service-role key stays server-side only (already in secrets, never exposed to client).
- All branches of the handler re-check `assertAdmin` before any write.
- Password is never logged or echoed back in the response.
- Same RLS policies apply afterward — the manually-created user behaves identically to a signup-flow user.

### Out of scope

- Bulk CSV import of users (can be added later as a follow-up).
- Editing existing users' email/password (separate flow).
- Sending the password to the user by email (you share it out-of-band; safer than emailing plaintext).

