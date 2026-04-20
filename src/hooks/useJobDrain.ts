import { useEffect, useRef } from "react";
import { processJobBatch } from "@/server/queue/worker.functions";
import { supabase } from "@/integrations/supabase/client";

interface Options {
  enabled: boolean;
  intervalMs?: number;
  onTick?: (result: { processed: number; succeeded: number; failed: number }) => void;
}

/**
 * Periodically calls processJobBatch while `enabled` is true.
 * Backs off when queue is empty; aborts on unmount.
 */
export function useJobDrain({ enabled, intervalMs = 5000, onTick }: Options) {
  const aliveRef = useRef(true);
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    aliveRef.current = true;
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let currentInterval = intervalMs;

    const tick = async () => {
      if (!aliveRef.current) return;
      try {
        // Skip if the session is missing/expired — avoids unhandled 401 Response
        // from server-fn machinery that can blank the screen.
        const { data } = await supabase.auth.getSession();
        if (!data.session?.access_token) {
          currentInterval = Math.min(currentInterval * 2, 30_000);
        } else {
          const r = await processJobBatch({ data: { limit: 3 } });
          onTickRef.current?.(r);
          currentInterval = r.processed === 0
            ? Math.min(currentInterval * 1.5, 30_000)
            : intervalMs;
        }
      } catch (err) {
        console.warn("drain tick failed", err);
        currentInterval = Math.min(currentInterval * 2, 30_000);
      }
      if (aliveRef.current) timer = setTimeout(tick, currentInterval);
    };

    tick();

    return () => {
      aliveRef.current = false;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, intervalMs]);
}
