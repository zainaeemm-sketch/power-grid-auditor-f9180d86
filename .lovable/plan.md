
The user wants the `/docs` and `/about` content refreshed to reflect recent additions: edit/delete actions, soft-delete with undo, and bulk multi-select.

Plan:

**1. Update `src/routes/docs.usage.tsx`** — add a new "7. Manage and clean up" section after "Compare and export" describing:
- Per-row Edit and Delete on Runs, Presets, Batches, Ground Truth, Validation
- 5-second soft-delete with Undo toast
- Bulk multi-select with checkboxes + sticky action bar on Runs/Presets/Batches

**2. Update `src/routes/docs.workflow.tsx`** — add a brief "Curating your dashboards" callout near the end mentioning edit/delete/bulk so the workflow doc references it.

**3. Update `src/routes/about.tsx`** — extend the "Purpose" or add a short "What's new" / capabilities bullet list mentioning dashboard management (edit, soft-delete with undo, bulk delete) so the About page reflects current feature set.

No new routes, no schema changes, no new components — pure copy updates to three existing route files.
