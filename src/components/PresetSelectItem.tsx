import { SelectItem, SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Zap } from "lucide-react";

interface Props {
  id: string;
  name: string;
}

export function PresetSelectItem({ id, name }: Props) {
  const isStressed = name.startsWith("[Stressed] ");
  const displayName = isStressed ? name.replace("[Stressed] ", "") : name;

  return (
    <SelectItem value={id}>
      <span className="flex items-center gap-2">
        {isStressed && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex cursor-help items-center gap-1 rounded border border-amber-400/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Zap className="h-3 w-3" />
                  Stressed
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                Built-in scenario designed to produce non-zero baseline violations,
                so counterfactual and optimality-gap metrics show real signal.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <span>{displayName}</span>
      </span>
    </SelectItem>
  );
}
