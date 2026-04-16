import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig = {
  queued: { label: "Queued", className: "bg-[oklch(0.769_0.188_70.08)]/15 text-[oklch(0.769_0.188_70.08)] border-[oklch(0.769_0.188_70.08)]/30", dot: false },
  running: { label: "Running", className: "bg-[oklch(0.488_0.243_264.376)]/15 text-[oklch(0.6_0.2_264)] border-[oklch(0.488_0.243_264.376)]/30", dot: true },
  completed: { label: "Completed", className: "bg-primary/15 text-primary border-primary/30", dot: false },
} as const;

export function StatusBadge({ status }: { status: keyof typeof statusConfig }) {
  const config = statusConfig[status] ?? statusConfig.queued;
  return (
    <Badge variant="outline" className={cn("text-xs font-semibold gap-1.5", config.className)}>
      {config.dot && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
        </span>
      )}
      {config.label}
    </Badge>
  );
}
