import { Button } from "@/components/ui/button";
import { Trash2, X } from "lucide-react";

interface Props {
  count: number;
  itemLabel: string; // singular, e.g. "run"
  onDelete: () => void;
  onClear: () => void;
}

/**
 * Sticky bottom-center bar shown when one or more rows are selected.
 */
export function BulkActionBar({ count, itemLabel, onDelete, onClear }: Props) {
  if (count === 0) return null;
  const label = count === 1 ? itemLabel : `${itemLabel}s`;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border/60 bg-card/95 px-4 py-2 shadow-lg backdrop-blur">
        <span className="text-sm font-medium">
          {count} {label} selected
        </span>
        <Button
          size="sm"
          variant="destructive"
          onClick={onDelete}
          className="h-8"
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Delete selected
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          className="h-8"
          title="Clear selection"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
