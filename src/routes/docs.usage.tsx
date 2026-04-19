import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { seedDemoData } from "@/server/demo.functions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/docs/usage")({
  head: () => ({
    meta: [
      { title: "Usage — GridArena Docs" },
      { name: "description", content: "How to sign in, create runs, manage presets, and execute batch experiments in GridArena." },
      { property: "og:title", content: "Usage — GridArena Docs" },
      { property: "og:description", content: "Sign in, create runs, manage presets, and run batches in GridArena." },
    ],
  }),
  component: UsagePage,
});

function UsagePage() {
  const { isAuthenticated } = useAuth();
  const [busy, setBusy] = useState(false);

  const seedMutation = useMutation({
    mutationFn: () => seedDemoData(),
    onMutate: () => setBusy(true),
    onSuccess: (res) => {
      toast.success("Demo dataset loaded", {
        description: `${res.presets_created} new preset(s), ${res.runs_created} new run(s).`,
        action: { label: "View Runs", onClick: () => { window.location.href = "/runs"; } },
      });
    },
    onError: (e: Error) => toast.error("Failed to load demo data", { description: e.message }),
    onSettled: () => setBusy(false),
  });

  return (
    <>
      <h1>Usage</h1>

      <h2>1. Sign in</h2>
      <p>
        GridArena uses email + password authentication. Visit <Link to="/login">/login</Link>,
        create an account, and you'll land on the runs index. All data is RLS-scoped so each
        researcher only sees their own runs, batches, and presets.
      </p>

      <h2>2. Try the demo dataset</h2>
      <p>
        The fastest way to explore GridArena is to load the bundled demo dataset. It seeds three
        presets (case5 / case14 / case30) and one example completed run per preset, all marked
        with the <code>[Demo]</code> prefix so you can identify and delete them later.
      </p>
      {isAuthenticated ? (
        <Button onClick={() => seedMutation.mutate()} disabled={busy} className="my-3">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Load Demo Dataset
        </Button>
      ) : (
        <p>
          <Link to="/login">Sign in</Link> to load the demo dataset.
        </p>
      )}

      <h2>3. Create a single run</h2>
      <ol>
        <li>Open <Link to="/new-run">/new-run</Link>.</li>
        <li>Pick a benchmark case (case5 / case14 / case30) and a model.</li>
        <li>Write a task prompt or pick one from your presets.</li>
        <li>Submit — the run appears in <Link to="/runs">/runs</Link> and updates as it progresses.</li>
      </ol>

      <h2>4. Manage presets</h2>
      <p>
        Presets capture a complete experiment configuration — prompt, model, evaluation mode,
        sampling parameters, seed. Visit <Link to="/presets">/presets</Link> to create, edit,
        and reuse them across runs and batches.
      </p>

      <h2>5. Run batches</h2>
      <ol>
        <li>Open <Link to="/batches/new">/batches/new</Link> and pick the presets to include.</li>
        <li>Submit — runs are enqueued in the background queue (see <Link to="/system-status">/system-status</Link>).</li>
        <li>Watch the batch detail page; rows transition queued → running → completed.</li>
        <li>Once complete, generate a batch report and export to CSV or LaTeX.</li>
      </ol>

      <h2>6. Compare and export</h2>
      <p>
        Use <Link to="/compare">/compare</Link> to view multiple runs side-by-side, and any run
        or batch detail page to export results, prompts, and provenance to CSV / LaTeX / SVG.
      </p>

      <h2>7. Manage and clean up</h2>
      <p>
        Every dashboard row (Runs, Presets, Batches, Ground Truth, Validation) has inline{" "}
        <strong>Edit</strong> and <strong>Delete</strong> actions so you can keep your workspace tidy
        without leaving the list view.
      </p>
      <ul>
        <li>
          <strong>Soft-delete with undo:</strong> deleting a row shows a 5-second toast with an
          <em> Undo</em> button. The row is hidden immediately and only permanently removed once
          the toast expires — accidental deletes are easy to recover.
        </li>
        <li>
          <strong>Bulk multi-select:</strong> on <Link to="/runs">/runs</Link>,{" "}
          <Link to="/presets">/presets</Link>, and <Link to="/batches">/batches</Link>, tick the
          row checkboxes (or the header checkbox to select all) and a sticky action bar appears at
          the bottom for one-click bulk delete.
        </li>
        <li>
          <strong>Editing:</strong> use Edit to rename, retitle, or adjust notes in place — useful
          when reorganizing experiments before generating a report.
        </li>
      </ul>
    </>
  );
}
