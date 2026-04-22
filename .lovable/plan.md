

## Pending-by-default signup — UX polish

Backend gating is already in place (DB trigger + `_authenticated` redirect). This is a small UX change on two files.

### Changes

**`src/routes/login.tsx`**
- After `signup()` succeeds, navigate to `/pending-approval` instead of `/`.
- Add helper text below the form when in signup mode: *"New accounts require admin approval before you can use GridArena."*
- Login flow unchanged (still goes to `/`).

**`src/routes/pending-approval.tsx`**
- Tighten the pending-state copy to: *"Your request is in the queue — an administrator has been notified. You'll be redirected automatically once approved."*

### Out of scope

- Admin panel (`CreateUserDialog` keeps its "Auto-approve" toggle, default ON).
- Email notifications (parked until `gridarena.eu` DNS is verified).
- DB triggers, RLS, realtime listener — all unchanged.

