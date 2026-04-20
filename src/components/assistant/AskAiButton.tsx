import { useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AskAiPanel } from "./AskAiPanel";
import { cn } from "@/lib/utils";

const HIDDEN_ROUTES = new Set(["/login", "/pending-approval"]);

export function AskAiButton() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) return null;
  if (HIDDEN_ROUTES.has(location.pathname)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask AI"
        className={cn(
          "group fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full",
          "bg-primary text-primary-foreground shadow-lg shadow-primary/30",
          "ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
          "transition-all duration-200 hover:scale-110 hover:shadow-primary/50",
        )}
      >
        <Sparkles className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12" />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
        </span>
      </button>
      <AskAiPanel open={open} onOpenChange={setOpen} />
    </>
  );
}
