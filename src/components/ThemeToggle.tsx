import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

const THEME_KEY = "gridarena-theme";

function getStoredTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem(THEME_KEY) as "dark" | "light") ?? "dark";
}

function applyTheme(theme: "dark" | "light") {
  if (typeof document === "undefined") return;
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
