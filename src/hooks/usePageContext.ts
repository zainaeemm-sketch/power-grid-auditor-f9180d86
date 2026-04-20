import { useLocation, useParams } from "@tanstack/react-router";

export interface PageContext {
  route: string;
  runId?: string;
  batchId?: string;
  hint?: string;
}

/**
 * Derives a lightweight page context for the Ask AI assistant.
 * Pulls runId / batchId from route params when present.
 */
export function usePageContext(): PageContext {
  const location = useLocation();
  const params = useParams({ strict: false }) as Record<string, string | undefined>;

  const ctx: PageContext = {
    route: location.pathname,
  };

  if (params.runId) ctx.runId = params.runId;
  if (params.batchId) ctx.batchId = params.batchId;
  // Some routes use $id (e.g. ground-truth.$id)
  if (!ctx.runId && location.pathname.startsWith("/runs/") && params.id) ctx.runId = params.id;

  return ctx;
}

export function describePageContext(ctx: PageContext): string {
  const parts: string[] = [ctx.route];
  if (ctx.runId) parts.push(`run ${ctx.runId.slice(0, 8)}`);
  if (ctx.batchId) parts.push(`batch ${ctx.batchId.slice(0, 8)}`);
  return parts.join(" · ");
}
