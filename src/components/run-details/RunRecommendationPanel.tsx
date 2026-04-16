import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { updateRecommendation } from "@/server/runs.functions";
import { reparseAndEvaluate } from "@/server/evaluation.functions";
import type { RunRecommendation } from "@/types/grid-arena";

interface RunRecommendationPanelProps {
  runId: string;
  recommendation: RunRecommendation | null;
}

export function RunRecommendationPanel({ runId, recommendation }: RunRecommendationPanelProps) {
  const updateRecFn = useServerFn(updateRecommendation);
  const reparseFn = useServerFn(reparseAndEvaluate);
  const router = useRouter();
  const [recText, setRecText] = useState(recommendation?.recommendation_text ?? "");
  const [saving, setSaving] = useState(false);
  const [reparsing, setReparsing] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateRecFn({ data: { run_id: runId, recommendation_text: recText || null } });
      toast.success("Recommendation saved");
    } catch {
      toast.error("Failed to save recommendation");
    } finally {
      setSaving(false);
    }
  };

  const reparse = async () => {
    if (!recText.trim()) {
      toast.error("No recommendation text to parse");
      return;
    }
    setReparsing(true);
    try {
      await reparseFn({ data: { run_id: runId, recommendation_text: recText } });
      toast.success("Reparsed and evaluated");
      router.invalidate();
    } catch {
      toast.error("Failed to reparse and evaluate");
    } finally {
      setReparsing(false);
    }
  };

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Agent Recommendation</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={reparse} disabled={reparsing || !recText.trim()}>
            <RefreshCw className="mr-1 h-3 w-3" />
            {reparsing ? "Evaluating…" : "Reparse & Evaluate"}
          </Button>
          <Button size="sm" variant="outline" onClick={save} disabled={saving}>
            <Save className="mr-1 h-3 w-3" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Textarea value={recText} onChange={(e) => setRecText(e.target.value)} rows={4} placeholder="Recommendation text…" />
      </CardContent>
    </Card>
  );
}
