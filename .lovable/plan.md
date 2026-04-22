

## Transactional approval emails from `info@gridarena.eu`

WordPress-style automatic emails for the signup → approval lifecycle, sent from your own domain.

### The three emails

1. **"Signup received"** → sent to the new user the moment they sign up. *"Thanks for signing up to GridArena. An admin will review your request shortly."*
2. **"Account approved — welcome"** → sent to the user when an admin approves them. Includes a sign-in link.
3. **"Account not approved"** *(optional, off by default)* → sent on rejection. Polite, includes admin notes if provided.

All three sent from **`GridArena <info@gridarena.eu>`** with `reply-to: info@gridarena.eu`.

### What's already there vs. what's missing

| Piece | Status |
|---|---|
| `user_approvals` row created on signup (DB trigger) | works |
| Admin approve/reject UI | works |
| `send_welcome_email` job enqueued on approve | enqueued but **never processed** (no handler) |
| Signup-received email | **missing entirely** |
| Email domain `gridarena.eu` verified for sending | **not set up** |
| Email-sending infrastructure (queue worker, templates) | **not set up** |

### How it will work (WordPress-like flow)

```text
User signs up
  └─ DB trigger creates user_approvals row (pending)
  └─ DB trigger enqueues "send_signup_received_email" job   [NEW]
        └─ Worker sends "We got your request" email           [NEW]

Admin clicks Approve
  └─ user_approvals.status = approved
  └─ existing code enqueues "send_welcome_email" job
        └─ Worker sends "Welcome, you're in" email            [NEW handler]

Admin clicks Reject (with notes)
  └─ user_approvals.status = rejected
  └─ enqueues "send_rejection_email" job (optional toggle)   [NEW]
        └─ Worker sends polite rejection email                 [NEW]
```

The job queue + cron drain you already have is reused — we just add handlers for the email job types.

### Sender setup — `info@gridarena.eu`

Email domain setup in Lovable Cloud requires **workspace admin/owner** permissions. You (or your workspace owner) need to:

1. Open the Email setup dialog (I'll surface it during implementation).
2. Enter `gridarena.eu` as the sending domain.
3. Add the DNS records Lovable shows you (SPF, DKIM, DMARC) at your DNS provider.
4. Wait for DNS verification (usually minutes, can take up to a few hours).

Once verified, all three emails will send from `info@gridarena.eu` automatically. Until DNS is verified, the system will fall back to a sandbox sender so you can test end-to-end without waiting.

### Files / changes

**Database (migration)**
- New trigger on `user_approvals` INSERT → enqueues `send_signup_received_email` job for new pending rows.
- Optional: trigger on UPDATE to `rejected` → enqueues `send_rejection_email` (toggleable per approval).

**Email templates** (React Email, branded GridArena dark/emerald to match the app)
- `supabase/functions/_shared/email-templates/signup-received.tsx`
- `supabase/functions/_shared/email-templates/welcome.tsx`
- `supabase/functions/_shared/email-templates/rejection.tsx`

Each includes: GridArena header, the message, a CTA button (sign-in link for welcome, "Contact us" for the others), and a footer with `info@gridarena.eu` reply-to.

**Worker handlers** — extend `src/routes/hooks/process-jobs.ts` and `src/server/queue/worker.functions.ts` to handle the three new `job_type`s by rendering the template and sending via the configured email provider.

**Admin UI** (`src/routes/_authenticated/admin.tsx`)
- Add a small "Send rejection email" toggle next to the Reject button (default off, remembers last choice).
- The existing "Resend email" button keeps working (re-queues the welcome email).

**Settings panel** (small addition to `src/components/admin/AdminSettings.tsx`)
- Read-only status: "Sender domain: `gridarena.eu` — Verified ✅ / Pending ⏳ / Not configured ❌"
- Link to re-open the domain setup dialog if not configured.

### Permissions note

Because email domain setup requires workspace admin/owner rights, when implementation starts I'll either:
- Trigger the email setup dialog for you to complete (if you have those rights), then continue automatically; **or**
- If you don't have those rights, build everything except the domain step, and leave clear instructions for your workspace admin to finish the `gridarena.eu` verification — once they do, emails start flowing with no further code changes.

### Out of scope

- Marketing / newsletter emails — this plan is strictly the three lifecycle emails.
- Per-user email preferences (unsubscribe). Transactional approval emails normally don't have unsubscribe; they're tied to account state.
- Re-styling existing Supabase auth emails (signup confirmation, password reset). Can be added in a follow-up using the same domain.

