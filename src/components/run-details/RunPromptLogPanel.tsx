import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { updatePromptLog } from "@/server/runs.functions";
import type { RunPromptLog } from "@/types/grid-arena";

interface RunPromptLogPanelProps {
  runId: string;
  promptLog: RunPromptLog | null;
}

export function RunPromptLogPanel({ runId, promptLog }: RunPromptLogPanelProps) {
  const updatePromptFn = useServerFn(updatePromptLog);
  const [promptText, setPromptText] = useState(promptLog?.prompt_text ?? "");
  const [responseText, setResponseText] = useState(promptLog?.response_text ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updatePromptFn({
        data: { run_id: runId, prompt_text: promptText || null, response_text: responseText || null },
      });
      toast.success("Prompt log saved");
    } catch {
      toast.error("Failed to save prompt log");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Prompt & Response Log</CardTitle>
        <Button size="sm" variant="outline" onClick={save} disabled={saving}>
          <Save className="mr-1 h-3 w-3" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Prompt</Label>
          <Textarea value={promptText} onChange={(e) => setPromptText(e.target.value)} rows={5} placeholder="Enter prompt text…" className="font-mono text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Response</Label>
          <Textarea value={responseText} onChange={(e) => setResponseText(e.target.value)} rows={5} placeholder="Response will appear here…" className="font-mono text-xs" />
        </div>
      </CardContent>
    </Card>
  );
}
