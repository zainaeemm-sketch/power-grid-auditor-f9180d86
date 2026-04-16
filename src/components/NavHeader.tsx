import { Link } from "@tanstack/react-router";
import { Zap, FlaskConical, Plus, Layers, GitCompare, LayoutList } from "lucide-react";

const navLinks = [
  { to: "/", label: "Home", icon: Zap, exact: true },
  { to: "/runs", label: "Runs", icon: LayoutList },
  { to: "/new-run", label: "New Run", icon: Plus },
  { to: "/presets", label: "Presets", icon: FlaskConical },
  { to: "/batches", label: "Batches", icon: Layers },
  { to: "/compare", label: "Compare", icon: GitCompare },
] as const;

export function NavHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-primary">
          <Zap className="h-5 w-5" />
          <span>GridArena</span>
        </Link>
        <nav className="flex items-center gap-1">
          {navLinks.map(({ to, label, icon: Icon, exact }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: !!exact }}
              activeProps={{ className: "bg-primary/15 text-primary" }}
              inactiveProps={{ className: "text-muted-foreground hover:text-foreground hover:bg-accent" }}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
