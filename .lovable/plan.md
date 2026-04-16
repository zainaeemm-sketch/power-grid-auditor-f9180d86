

# Real-Time Status Updates During Batch Execution

## What this does

Instead of only seeing progress from the client-side execution loop, the batch details page will subscribe to real-time database changes on the `runs` table. When a run's status changes (e.g. queued → running → completed), the UI updates automatically — even if another tab or user triggers the execution.

## Plan

### 1. Enable Realtime on `runs` table
Add a database migration:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.runs;
```

### 2. Add Supabase Realtime subscription to batch details page
In `src/routes/_authenticated/batches.$batchId.tsx`:

- Import `supabase` from `@/integrations/supabase/client` and add `useEffect`
- Extract the list of `runIds` from the loaded batch runs
- Subscribe to `postgres_changes` on the `runs` table filtered by the batch's run IDs
- On each `UPDATE` event, call `router.invalidate()` to refresh loader data (which re-fetches batch details including updated statuses and evaluations)
- Clean up the subscription channel on unmount

The subscription hook will look roughly like:

```tsx
useEffect(() => {
  if (runIds.length === 0) return;
  const channel = supabase
    .channel(`batch-${batch.id}-runs`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'runs' },
      (payload) => {
        if (runIds.includes(payload.new.id)) {
          router.invalidate();
        }
      }
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [batch.id, runIds, router]);
```

### 3. Debounce invalidation
Add a simple debounce (300ms) to avoid rapid consecutive reloads when multiple runs update in quick succession during batch execution.

### Files changed
| File | Change |
|---|---|
| Migration SQL | `ALTER PUBLICATION supabase_realtime ADD TABLE public.runs` |
| `src/routes/_authenticated/batches.$batchId.tsx` | Add realtime subscription with debounced `router.invalidate()` |

