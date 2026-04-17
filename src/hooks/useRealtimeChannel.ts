import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type RealtimeStatus = "connecting" | "live" | "disconnected";

export interface UseRealtimeChannelOptions {
  /** Stable channel name prefix; a timestamp suffix is appended on each (re)connect to avoid collisions. */
  channelName: string;
  /** Called once on each fresh channel so callers can attach `.on(...)` listeners. Must be stable (memoize with useCallback). */
  setup: (channel: RealtimeChannel) => RealtimeChannel;
  /** Disable the subscription entirely. */
  enabled?: boolean;
  /** Max backoff delay in ms. Defaults to 30s. */
  maxDelayMs?: number;
}

export interface UseRealtimeChannelResult {
  status: RealtimeStatus;
  reconnectAttempt: number;
  /** Manually reconnect now, bypassing the backoff timer. */
  reconnectNow: () => void;
}

/**
 * Subscribes to a Supabase Realtime channel with automatic exponential-backoff
 * reconnection (1s → 2s → 4s … capped, with jitter) and a manual `reconnectNow`.
 *
 * IMPORTANT: pass a memoized `setup` callback (useCallback) — otherwise the
 * channel will tear down and reconnect on every render.
 */
export function useRealtimeChannel({
  channelName,
  setup,
  enabled = true,
  maxDelayMs = 30000,
}: UseRealtimeChannelOptions): UseRealtimeChannelResult {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectNowRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled) {
      setStatus("disconnected");
      return;
    }

    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    const scheduleReconnect = () => {
      if (cancelled || reconnectTimerRef.current) return;
      const attempt = reconnectAttemptRef.current + 1;
      reconnectAttemptRef.current = attempt;
      setReconnectAttempt(attempt);
      const base = Math.min(1000 * 2 ** (attempt - 1), maxDelayMs);
      const delay = base + Math.random() * 500;
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        if (channel) supabase.removeChannel(channel);
        connect();
      }, delay);
    };

    const connect = () => {
      if (cancelled) return;
      setStatus("connecting");
      const base = supabase.channel(`${channelName}_${Date.now()}`);
      channel = setup(base).subscribe((s) => {
        if (cancelled) return;
        if (s === "SUBSCRIBED") {
          setStatus("live");
          reconnectAttemptRef.current = 0;
          setReconnectAttempt(0);
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
          setStatus("disconnected");
          scheduleReconnect();
        } else {
          setStatus("connecting");
        }
      });
    };

    reconnectNowRef.current = () => {
      if (cancelled) return;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      reconnectAttemptRef.current = 0;
      setReconnectAttempt(0);
      if (channel) supabase.removeChannel(channel);
      connect();
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (channel) supabase.removeChannel(channel);
    };
  }, [channelName, setup, enabled, maxDelayMs]);

  const reconnectNow = useCallback(() => reconnectNowRef.current(), []);

  return { status, reconnectAttempt, reconnectNow };
}
