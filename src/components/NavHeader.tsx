import { Link } from "@tanstack/react-router";
import { Zap, FlaskConical, Plus, Layers, GitCompare, LayoutList, LogOut, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { AccentSwitcher } from "@/components/AccentSwitcher";

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
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/60 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link to="/" className="group/logo flex items-center gap-2 font-bold text-lg">
          <span className="relative flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary transition-transform duration-300 group-hover/logo:scale-125 group-hover/logo:rotate-12" />
            <span className="absolute inset-0 rounded-full bg-primary/0 transition-all duration-300 group-hover/logo:bg-primary/10 group-hover/logo:scale-[2] group-hover/logo:animate-ping" />
          </span>
          <span className="text-foreground transition-colors duration-300 group-hover/logo:text-primary">Grid</span>
          <span className="-ml-1.5 gradient-text">Arena</span>
        </Link>
        <nav className="flex flex-1 items-center gap-1">
          {navLinks.map(({ to, label, icon: Icon, exact }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: !!exact }}
              activeProps={{ className: "text-primary [&_.nav-underline]:scale-x-100" }}
              inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
              className="group relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 hover:-translate-y-px"
            >
              <Icon className="h-4 w-4" />
              {label}
              <span className="nav-underline absolute -bottom-[1px] left-3 right-3 h-0.5 scale-x-0 rounded-full bg-gradient-to-r from-primary to-[oklch(0.72_0.14_200)] transition-transform duration-300 group-hover:scale-x-100" />
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <span className="text-xs text-muted-foreground">{user?.email}</span>
              <Button variant="ghost" size="sm" onClick={() => logout()} className="text-muted-foreground hover:text-foreground">
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
