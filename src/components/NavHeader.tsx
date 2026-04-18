import { Link } from "@tanstack/react-router";
import { Zap, FlaskConical, Plus, Layers, GitCompare, LayoutList, LogOut, LogIn, User as UserIcon, Activity, ShieldCheck, Gauge, BookOpen, Info, Target, UserCog } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { isCurrentUserAdmin } from "@/server/admin.functions";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { AccentSwitcher } from "@/components/AccentSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HealthBadge } from "@/components/HealthBadge";
import { AdminPendingNotifier } from "@/components/AdminPendingNotifier";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navLinks = [
  { to: "/" as const, label: "Home", icon: Zap, exact: true },
  { to: "/runs" as const, label: "Runs", icon: LayoutList, exact: false },
  { to: "/new-run" as const, label: "New Run", icon: Plus, exact: false },
  { to: "/presets" as const, label: "Presets", icon: FlaskConical, exact: false },
  { to: "/batches" as const, label: "Batches", icon: Layers, exact: false },
  { to: "/compare" as const, label: "Compare", icon: GitCompare, exact: false },
  { to: "/validation" as const, label: "Validation", icon: ShieldCheck, exact: false },
  { to: "/ground-truth" as const, label: "Ground Truth", icon: Target, exact: false },
  { to: "/system-status" as const, label: "System", icon: Gauge, exact: false },
];

const publicLinks = [
  { to: "/docs" as const, label: "Docs", icon: BookOpen, exact: false },
  { to: "/about" as const, label: "About", icon: Info, exact: false },
];

export function NavHeader() {
  const { isAuthenticated, user, logout } = useAuth();
  const checkAdmin = useServerFn(isCurrentUserAdmin);
  const { data: adminData } = useQuery({
    queryKey: ["isAdmin", user?.id],
    queryFn: () => checkAdmin(),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const isAdmin = !!adminData?.isAdmin;

  const allLinks = isAuthenticated
    ? [...navLinks, ...(isAdmin ? [{ to: "/admin" as const, label: "Admin", icon: UserCog, exact: false }] : []), ...publicLinks]
    : publicLinks;

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
          {allLinks.map(({ to, label, icon: Icon, exact }) => (
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
              <span className="nav-underline absolute -bottom-[1px] left-3 right-3 h-0.5 scale-x-0 rounded-full bg-primary transition-transform duration-300 group-hover:scale-x-100" />
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AccentSwitcher />
          {isAuthenticated ? (
            <>
              {isAdmin && <AdminPendingNotifier />}
              <HealthBadge />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <UserIcon className="h-3.5 w-3.5" />
                    </span>
                    <span className="hidden max-w-[140px] truncate sm:inline">{user?.email}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex flex-col gap-0.5">
                    <span className="text-xs font-normal text-muted-foreground">Signed in as</span>
                    <span className="truncate text-sm">{user?.email}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/health">
                      <Activity className="mr-2 h-4 w-4" />
                      System Health
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logout()} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
