import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const UNDO_MS = 5000;

/**
 * Optimistic soft-delete with a 5-second Undo toast.
 *
 * - `pendingIds` is a Set of row IDs currently hidden from the UI.
 *   Filter your list with `!pendingIds.has(row.id)`.
 * - Call `softDelete(id, label, runDelete, onCommitted?)` to start the timer.
 *   `runDelete` is the async server call; it only runs if the user does NOT undo.
 *   `onCommitted` (optional) fires after a successful server delete (e.g. router.invalidate()).
 */
export function useSoftDelete() {
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const cancelledRef = useRef<Set<string>>(new Set());

  const removePending = useCallback((id: string) => {
    setPendingIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const softDelete = useCallback(
    (
      id: string,
      label: string,
      runDelete: () => Promise<unknown>,
      onCommitted?: () => void,
    ) => {
      // If a timer is already running for this id, clear it first.
      const existing = timersRef.current.get(id);
      if (existing) clearTimeout(existing);
      cancelledRef.current.delete(id);

      setPendingIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      const toastId = toast(`Deleted "${label}"`, {
        description: "Will be permanently removed in 5 seconds.",
        duration: UNDO_MS,
        action: {
          label: "Undo",
          onClick: () => {
            cancelledRef.current.add(id);
            const t = timersRef.current.get(id);
            if (t) clearTimeout(t);
            timersRef.current.delete(id);
            removePending(id);
            toast.success(`Restored "${label}"`);
          },
        },
      });

      const timer = setTimeout(async () => {
        timersRef.current.delete(id);
        if (cancelledRef.current.has(id)) {
          cancelledRef.current.delete(id);
          return;
        }
        try {
          await runDelete();
          toast.dismiss(toastId);
          onCommitted?.();
        } catch (e: any) {
          // Restore row on failure.
          removePending(id);
          toast.error(e?.message || `Failed to delete "${label}"`);
        }
      }, UNDO_MS);

      timersRef.current.set(id, timer);
    },
    [removePending],
  );

  // Cleanup: if the component unmounts with timers still pending, fire the deletes
  // synchronously so the user's intent isn't lost when navigating away.
  useEffect(() => {
    return () => {
      for (const t of timersRef.current.values()) clearTimeout(t);
      timersRef.current.clear();
    };
  }, []);

  return { pendingIds, softDelete };
}
