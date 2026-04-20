import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { PerturbationEngine } from "@/lib/simulation-skip";

const ENGINE_META: Record<PerturbationEngine, { label: string; className: string; description: string }> = {
  "pandapower-external": {
    label: "pandapower",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    description: "Computed by the external pandapower service using a full AC power flow simulation.",
  },
  "dc-powerflow": {
    label: "DC PF",
    className: "border-sky-500/40 bg-sky-500/10 text-sky-300",
    description: "Computed by the in-worker DC power flow approximation (built-in cases: ieee9/14/30).",
  },
  skipped: {
    label: "skipped",
    className: "text-muted-foreground",
    description: "No simulator was available for this case, so no result was produced.",
  },
  unknown: {
    label: "unknown",
    className: "text-muted-foreground",
    description: "This row predates the engine-tracking column, so the simulation tier could not be determined.",
  },
};

export function EngineBadge({ engine }: { engine: PerturbationEngine }) {
  const { label, className, description } = ENGINE_META[engine];
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`cursor-help text-[10px] ${className}`}>
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
