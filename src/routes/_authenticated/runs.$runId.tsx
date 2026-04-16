import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { getRunDetails, updateRunMetadata, updatePromptLog, updateRecommendation, updateRunStatus } from "@/server/runs.functions";
import { useServerFn } from "@tanstack/react-start";
import type { RunDetails, RunStatus } from "@/types/grid-arena";

export const Route = createFileRoute("/_authenticated/runs/$runId")({
  head: () => ({
    meta: [{ title: "Run Details — GridArena" }],
  }),
  loader: async ({ params }) => {
    try {
      return await getRunDetails({ data: { runId: params.runId } });
    } catch {
      return { run: null, metadata: null, promptLog: null, recommendation: null, parseResult: null };
    }
  },
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-destructive">Error loading run: {error.message}</p>
      <Button variant="outline" asChild className="mt-4">
        <Link to="/runs">Back to Runs</Link>
      </Button>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-muted-foreground">Run not found.</p>
      <Button variant="outline" asChild className="mt-4">
        <Link to="/runs">Back to Runs</Link>
      </Button>
    </main>
  ),
  component: RunDetailPage,
});

const STATUS_FLOW: RunStatus[] = ["queued", "running", "completed"];

function RunDetailPage() {
  const details = Route.useLoaderData() as RunDetails;
  const router = useRouter();
  const updateMetaFn = useServerFn(updateRunMetadata);
  const updatePromptFn = useServerFn(updatePromptLog);
  const updateRecFn = useServerFn(updateRecommendation);
  const updateStatusFn = useServerFn(updateRunStatus);

  if (!details.run) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-muted-foreground">Loading run details…</p>
      </main>
    );
  }

  const { run, metadata, promptLog, recommendation, parseResult } = details;

  // Metadata state
  const [providerName, setProviderName] = useState(metadata?.provider_name ?? "");
  const [providerUrl, setProviderUrl] = useState(metadata?.provider_base_url ?? "");
  const [modelName, setModelName] = useState(metadata?.model_name ?? "");
  const [modelVersion, setModelVersion] = useState(metadata?.model_version ?? "");
  const [promptVersion, setPromptVersion] = useState(metadata?.prompt_version ?? "");
  const [datasetVersion, setDatasetVersion] = useState(metadata?.dataset_version ?? "");
  const [randomSeed, setRandomSeed] = useState(metadata?.random_seed?.toString() ?? "");
  const [metaNotes, setMetaNotes] = useState(metadata?.notes ?? "");
  const [metaSaving, setMetaSaving] = useState(false);

  // Prompt log state
  const [promptText, setPromptText] = useState(promptLog?.prompt_text ?? "");
  const [responseText, setResponseText] = useState(promptLog?.response_text ?? "");
  const [promptSaving, setPromptSaving] = useState(false);

  // Recommendation state
  const [recText, setRecText] = useState(recommendation?.recommendation_text ?? "");
  const [recSaving, setRecSaving] = useState(false);

  const [statusUpdating, setStatusUpdating] = useState(false);

  const saveMeta = async () => {
    setMetaSaving(true);
    try {
      await updateMetaFn({
        data: {
          run_id: run.id,
          provider_name: providerName || null,
          provider_base_url: providerUrl || null,
          model_name: modelName || null,
          model_version: modelVersion || null,
          prompt_version: promptVersion || null,
          dataset_version: datasetVersion || null,
          random_seed: randomSeed ? parseInt(randomSeed, 10) : null,
          notes: metaNotes || null,
        },
      });
    } catch (err) {
      console.error("Failed to save metadata:", err);
    } finally {
      setMetaSaving(false);
    }
  };

  const savePrompt = async () => {
    setPromptSaving(true);
    try {
      await updatePromptFn({
        data: {
          run_id: run.id,
          prompt_text: promptText || null,
          response_text: responseText || null,
        },
      });
    } catch (err) {
      console.error("Failed to save prompt log:", err);
    } finally {
      setPromptSaving(false);
    }
  };

  const saveRec = async () => {
    setRecSaving(true);
    try {
      await updateRecFn({
        data: {
          run_id: run.id,
          recommendation_text: recText || null,
        },
      });
    } catch (err) {
      console.error("Failed to save recommendation:", err);
    } finally {
      setRecSaving(false);
    }
  };

  const changeStatus = async (newStatus: RunStatus) => {
    setStatusUpdating(true);
    try {
      await updateStatusFn({ data: { run_id: run.id, status: newStatus } });
      router.invalidate();
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setStatusUpdating(false);
    }
  };

  const currentIdx = STATUS_FLOW.indexOf(run.status as RunStatus);
  const nextStatus = currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/runs">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{run.title}</h1>
            <StatusBadge status={run.status as RunStatus} />
          </div>
          <p className="text-sm text-muted-foreground">
            {run.agent} · {run.task} · {run.case_name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {nextStatus && (
            <Button size="sm" disabled={statusUpdating} onClick={() => changeStatus(nextStatus)}>
              {statusUpdating ? "Updating…" : `Mark ${nextStatus}`}
            </Button>
          )}
        </div>
      </div>

      {/* Panels grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Metadata */}
        <Card className="border-border/60 bg-card/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Experiment Metadata</CardTitle>
            <Button size="sm" variant="outline" onClick={saveMeta} disabled={metaSaving}>
              <Save className="mr-1 h-3 w-3" />
              {metaSaving ? "Saving…" : "Save"}
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Provider</Label>
              <Input value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="e.g. openai" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Base URL</Label>
              <Input value={providerUrl} onChange={(e) => setProviderUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Model</Label>
              <Input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="e.g. gpt-4o" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Model Version</Label>
              <Input value={modelVersion} onChange={(e) => setModelVersion(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Prompt Version</Label>
              <Input value={promptVersion} onChange={(e) => setPromptVersion(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Dataset Version</Label>
              <Input value={datasetVersion} onChange={(e) => setDatasetVersion(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Random Seed</Label>
              <Input value={randomSeed} onChange={(e) => setRandomSeed(e.target.value)} type="number" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <Textarea value={metaNotes} onChange={(e) => setMetaNotes(e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>

        {/* Prompt & Response */}
        <Card className="border-border/60 bg-card/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Prompt & Response Log</CardTitle>
            <Button size="sm" variant="outline" onClick={savePrompt} disabled={promptSaving}>
              <Save className="mr-1 h-3 w-3" />
              {promptSaving ? "Saving…" : "Save"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Prompt</Label>
              <Textarea value={promptText} onChange={(e) => setPromptText(e.target.value)} rows={5} placeholder="Enter prompt text…" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Response</Label>
              <Textarea value={responseText} onChange={(e) => setResponseText(e.target.value)} rows={5} placeholder="Response will appear here…" />
            </div>
          </CardContent>
        </Card>

        {/* Recommendation */}
        <Card className="border-border/60 bg-card/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Agent Recommendation</CardTitle>
            <Button size="sm" variant="outline" onClick={saveRec} disabled={recSaving}>
              <Save className="mr-1 h-3 w-3" />
              {recSaving ? "Saving…" : "Save"}
            </Button>
          </CardHeader>
          <CardContent>
            <Textarea value={recText} onChange={(e) => setRecText(e.target.value)} rows={4} placeholder="Recommendation text…" />
          </CardContent>
        </Card>

        {/* Parser Provenance (read-only) */}
        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Parser Provenance</CardTitle>
          </CardHeader>
          <CardContent>
            {parseResult ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Action Type</span>
                  <span>{parseResult.action_type || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target Index</span>
                  <span>{parseResult.target_index ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Value</span>
                  <span>{parseResult.value ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Enabled</span>
                  <span>{parseResult.enabled ? "Yes" : "No"}</span>
                </div>
                {parseResult.source_text && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Source Text</span>
                    <p className="rounded bg-muted/30 p-2 text-xs">{parseResult.source_text}</p>
                  </div>
                )}
                {parseResult.parser_notes && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Parser Notes</span>
                    <p className="rounded bg-muted/30 p-2 text-xs">{parseResult.parser_notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No parse results yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Results Summary */}
        <Card className="border-border/60 bg-card/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Results Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border/40 p-4 text-center">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="mt-1 font-semibold capitalize">{run.status}</p>
              </div>
              <div className="rounded-lg border border-border/40 p-4 text-center">
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="mt-1 text-sm">{new Date(run.created_at).toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-border/40 p-4 text-center">
                <p className="text-xs text-muted-foreground">Research Question</p>
                <p className="mt-1 text-sm">{run.research_question || "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
