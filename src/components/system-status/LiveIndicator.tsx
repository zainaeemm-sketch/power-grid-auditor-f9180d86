export type LiveStatus = "connecting" | "live" | "disconnected";

export function LiveIndicator({
  status,
  reconnectAttempt = 0,
}: {
  status: LiveStatus;
  reconnectAttempt?: number;
}) {
  const isLive = status === "live";
  const isDown = status === "disconnected";
  const dotColor = isLive ? "bg-emerald-500" : isDown ? "bg-destructive" : "bg-amber-500";
  const baseLabel = isLive ? "Live" : isDown ? "Disconnected" : "Connecting";
  const label = !isLive && reconnectAttempt > 0 ? `${baseLabel} (retry ${reconnectAttempt})` : baseLabel;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground"
      title={`Realtime channel: ${baseLabel}${reconnectAttempt > 0 ? ` — reconnect attempt ${reconnectAttempt}` : ""}`}
    >
      <span className="relative flex h-2 w-2">
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotColor}`} />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`} />
      </span>
      {label}
    </span>
  );
}
