import { useLocation, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { getRunDetails } from "@/server/runs.functions";

export interface PageContext {
  route: string;
  runId?: string;
  batchId?: string;
  hint?: string;
  runSummary?: string;
}

function deriveBase(): { route: string; runId?: string; batchId?: string } {
  const location = useLocation();
  const params = useParams({ strict: false }) as Record<string, string | undefined>;

  const ctx: { route: string; runId?: string; batchId?: string } = {
    route: location.pathname,
  };
  if (params.runId) ctx.runId = params.runId;
  if (params.batchId) ctx.batchId = params.batchId;
  if (!ctx.runId && location.pathname.startsWith("/runs/") && params.id) ctx.runId = params.id;
  return ctx;
}

function buildRunSummary(details: any): string {
  if (!details?.run) return "";
  const { run, metadata, parseResult, evaluation } = details;
  const lines: string[] = [];
  lines.push(`Run "${run.title}" · status=${run.status} · case=${run.case_name} · agent=${run.agent} · task=${run.task}`);
  if (run.research_question) lines.push(`Research question: ${String(run.research_question).slice(0, 240)}`);

  if (metadata) {
    const m: string[] = [];
    if (metadata.provider_name) m.push(`provider=${metadata.provider_name}`);
    if (metadata.model_name) m.push(`model=${metadata.model_name}${metadata.model_version ? `@${metadata.model_version}` : ""}`);
    if (metadata.temperature != null) m.push(`temp=${metadata.temperature}`);
    if (metadata.top_p != null) m.push(`top_p=${metadata.top_p}`);
    if (metadata.max_tokens != null) m.push(`max_tokens=${metadata.max_tokens}`);
    if (metadata.random_seed != null) m.push(`seed=${metadata.random_seed}`);
    if (metadata.prompt_version) m.push(`prompt_v=${metadata.prompt_version}`);
    if (metadata.parser_version) m.push(`parser_v=${metadata.parser_version}`);
    if (metadata.evaluation_mode) m.push(`eval_mode=${metadata.evaluation_mode}`);
    if (m.length) lines.push(`Metadata: ${m.join(", ")}`);
  }

  if (parseResult) {
    const action = parseResult.action_type
      ? `${parseResult.action_type}${parseResult.target_index != null ? `(idx=${parseResult.target_index})` : ""}${parseResult.value != null ? ` value=${parseResult.value}` : ""}`
      : "no action parsed";
    lines.push(`Parsed action: ${action} · enabled=${parseResult.enabled}${parseResult.parser_notes ? ` · notes=${String(parseResult.parser_notes).slice(0, 160)}` : ""}`);
  }

  if (evaluation) {
    const e: string[] = [];
    e.push(`feasibility=${evaluation.feasibility}`);
    e.push(`baseline_violations=${evaluation.baseline_violations}`);
    e.push(`post_action_violations=${evaluation.post_action_violations}`);
    e.push(`improvement=${evaluation.violation_improvement}`);
    if (evaluation.optimality_gap != null) e.push(`optimality_gap=${evaluation.optimality_gap}`);
    if (evaluation.action_match) e.push(`action_match=${evaluation.action_match}`);
    if (evaluation.feasibility_match) e.push(`feasibility_match=${evaluation.feasibility_match}`);
    if (evaluation.confidence) e.push(`confidence=${evaluation.confidence}`);
    if (evaluation.grounding_quality) e.push(`grounding=${evaluation.grounding_quality}`);
    if (evaluation.engine_used) e.push(`engine=${evaluation.engine_used}`);
    lines.push(`Results: ${e.join(", ")}`);
    if (evaluation.notes) lines.push(`Notes: ${String(evaluation.notes).slice(0, 240)}`);
  }

  return lines.join("\n");
}

/**
 * Derives a lightweight page context for the Ask AI assistant.
 * On run-detail pages, also fetches a compact run summary for sharper grounding.
 */
export function usePageContext(): PageContext {
  const base = deriveBase();
  const getDetails = useServerFn(getRunDetails);

  const isRunPage = !!base.runId && base.route.startsWith("/runs/");

  const runQuery = useQuery({
    queryKey: ["ask-ai-run-context", base.runId],
    queryFn: () => getDetails({ data: { runId: base.runId! } }),
    enabled: isRunPage,
    staleTime: 60_000,
  });

  return useMemo<PageContext>(() => {
    const ctx: PageContext = { ...base };
    if (isRunPage && runQuery.data) {
      const summary = buildRunSummary(runQuery.data);
      if (summary) ctx.runSummary = summary;
    }
    return ctx;
  }, [base.route, base.runId, base.batchId, isRunPage, runQuery.data]);
}

export function describePageContext(ctx: PageContext): string {
  const parts: string[] = [ctx.route];
  if (ctx.runId) parts.push(`run ${ctx.runId.slice(0, 8)}`);
  if (ctx.batchId) parts.push(`batch ${ctx.batchId.slice(0, 8)}`);
  if (ctx.runSummary) parts.push("+run details");
  return parts.join(" · ");
}
