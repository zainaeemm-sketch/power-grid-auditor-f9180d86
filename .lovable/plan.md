

# Add Retry Button for Failed Runs in Batch Execution Progress Panel

## What changes

The execution progress panel currently shows failed runs with an error icon and message, but offers no way to retry individual failures. This adds a small "Retry" button next to each failed run result.

## Plan

### 1. Add `RotateCcw` icon import
Add `RotateCcw` to the existing lucide-react import list.

### 2. Add retry handler function
Create a `handleRetryRun` callback that:
- Takes a `runId` string
- Calls `executeRunLlm` for that single run
- Updates the corresponding entry in `executionProgress.results` with the new outcome
- Shows a toast on success/failure
- Calls `router.invalidate()` to refresh data

### 3. Update the progress panel UI
- Show the progress panel when `executionProgress` exists (even after batch execution finishes — currently hidden when `executing` is false)
- For each failed result (`!r.success`), render a small ghost "Retry" button with a `RotateCcw` icon
- Track which run is currently retrying via a `retryingRunId` state to show a spinner on the retry button
- Keep the panel visible after execution completes so users can retry failures

### 4. Add `retryingRunId` state
A simple `useState<string | null>(null)` to track which individual run is being retried, disabling that button and showing a spinner.

### Files affected
| File | Change |
|---|---|
| `src/routes/_authenticated/batches.$batchId.tsx` | Add retry state, handler, update progress panel visibility and result rows |

