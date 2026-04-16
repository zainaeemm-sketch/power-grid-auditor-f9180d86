import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Palette } from "lucide-react";

const ACCENT_KEY = "gridarena-accent";

const accents = [
  { id: "emerald", label: "Emerald", color: "oklch(0.696 0.17 162.48)" },
  { id: "blue", label: "Blue", color: "oklch(0.62 0.20 255)" },
  { id: "purple", label: "Purple", color: "oklch(0.627 0.265 303.9)" },
  { id: "amber", label: "Amber", color: "oklch(0.769 0.188 70.08)" },
  { id: "rose", label: "Rose", color: "oklch(0.645 0.246 16.439)" },
] as const;

function getStoredAccent(): string {
  if (typeof window === "undefined") return "emerald";
  return localStorage.getItem(ACCENT_KEY) ?? "emerald";
}

function applyAccent(id: string) {
  if (typeof document === "undefined") return;
  if (id === "emerald") {
    document.documentElement.removeAttribute("data-accent");
  } else {
    document.documentElement.setAttribute("data-accent", id);
  }
}

export function AccentSwitcher() {
  const [active, setActive] = useState(getStoredAccent);

  useEffect(() => {
    applyAccent(active);
  }, [active]);

  const handleSelect = (id: string) => {
    setActive(id);
    localStorage.setItem(ACCENT_KEY, id);
    applyAccent(id);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Accent color">
          <Palette className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-3" align="end">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Accent Color</p>
        <div className="flex gap-2">
          {accents.map((a) => (
            <button
              key={a.id}
              title={a.label}
              onClick={() => handleSelect(a.id)}
              className="relative flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110"
              style={{ backgroundColor: a.color }}
            >
              {active === a.id && (
                <span className="absolute inset-0 rounded-full ring-2 ring-foreground ring-offset-2 ring-offset-background" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
