import { Outlet, Link, createRootRoute, HeadContent, Scripts, useLocation } from "@tanstack/react-router";
import { PageTransition } from "@/components/PageTransition";
import { NavHeader } from "@/components/NavHeader";
import { AuthProvider } from "@/hooks/useAuth";
import { PwaSplashScreen } from "@/components/PwaSplashScreen";
import { PwaInstallBanner } from "@/components/PwaInstallBanner";
import { OfflineFallback } from "@/components/OfflineFallback";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "GridArena — LLM Agent Research Platform" },
      { name: "description", content: "Evaluate and audit LLM agents on power-system tasks with GridArena." },
      { name: "theme-color", content: "#10b981" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { property: "og:title", content: "GridArena — LLM Agent Research Platform" },
      { name: "twitter:title", content: "GridArena — LLM Agent Research Platform" },
      { property: "og:description", content: "Evaluate and audit LLM agents on power-system tasks with GridArena." },
      { name: "twitter:description", content: "Evaluate and audit LLM agents on power-system tasks with GridArena." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/ebf15436-bd83-4dcf-96af-1c31107e7671" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/ebf15436-bd83-4dcf-96af-1c31107e7671" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/icons/icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <PwaSplashScreen />
      <PwaInstallBanner />
      <OfflineFallback />
      <div className="min-h-screen bg-background text-foreground">
        <NavHeader />
        <PageTransition>
          <Outlet />
        </PageTransition>
      </div>
    </AuthProvider>
  );
}
