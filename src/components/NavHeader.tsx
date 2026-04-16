import { Link } from "@tanstack/react-router";
import { Zap, FlaskConical, Plus, Layers, GitCompare, LayoutList, LogOut, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const navLinks = [
  { to: "/" as const, label: "Home", icon: Zap, exact: true },
  { to: "/runs" as const, label: "Runs", icon: LayoutList, exact: false },
  { to: "/new-run" as const, label: "New Run", icon: Plus, exact: false },
  { to: "/presets" as const, label: "Presets", icon: FlaskConical, exact: false },
  { to: "/batches" as const, label: "Batches", icon: Layers, exact: false },
  { to: "/compare" as const, label: "Compare", icon: GitCompare, exact: false },
];

export function NavHeader() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-primary">
          <Zap className="h-5 w-5" />
          <span>GridArena</span>
        </Link>
        <nav className="flex flex-1 items-center gap-1">
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
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <span className="text-xs text-muted-foreground">{user?.email}</span>
              <Button variant="ghost" size="sm" onClick={() => logout()}>
                <LogOut className="mr-1.5 h-3.5 w-3.5" />
                Sign Out
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">
                <LogIn className="mr-1.5 h-3.5 w-3.5" />
                Sign In
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
