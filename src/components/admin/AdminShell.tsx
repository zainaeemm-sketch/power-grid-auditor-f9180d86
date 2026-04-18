import { ReactNode, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Bell,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export type AdminSection = "dashboard" | "users";

interface AdminShellProps {
  active: AdminSection;
  onChange: (s: AdminSection) => void;
  pendingCount?: number;
  children: ReactNode;
}

const items: { id: AdminSection; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
];

export function AdminShell({ active, onChange, pendingCount = 0, children }: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] w-full bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "sticky top-14 flex h-[calc(100vh-3.5rem)] flex-col border-r border-border/60 bg-card/40 backdrop-blur transition-[width] duration-200",
          collapsed ? "w-14" : "w-56",
        )}
      >
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-wide">Admin</span>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="ml-auto rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-2">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            const showBadge = item.id === "users" && pendingCount > 0;
            return (
              <button
                key={item.id}
                onClick={() => onChange(item.id)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
                {showBadge && (
                  <span
                    className={cn(
                      "rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground",
                      collapsed && "ml-0",
                    )}
                  >
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border/60 p-3 text-[11px] text-muted-foreground">
          {!collapsed ? (
            <Link to="/" className="hover:text-foreground">← Back to app</Link>
          ) : (
            <Link to="/" className="block text-center hover:text-foreground" title="Back to app">←</Link>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <div className="sticky top-14 z-10 flex h-12 items-center gap-3 border-b border-border/60 bg-background/80 px-6 backdrop-blur">
          <h2 className="text-sm font-semibold capitalize text-foreground/90">
            {items.find((i) => i.id === active)?.label}
          </h2>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search…"
                className="h-8 w-56 pl-7 text-xs"
              />
            </div>
            <button
              className="relative rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {pendingCount > 0 && (
                <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
              )}
            </button>
          </div>
        </div>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
