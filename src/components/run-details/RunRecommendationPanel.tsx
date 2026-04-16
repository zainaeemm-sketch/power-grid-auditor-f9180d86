import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { updateRecommendation } from "@/server/runs.functions";
import type { RunRecommendation } from "@/types/grid-arena";

interface RunRecommendationPanelProps {
  runId: string;
  recommendation: RunRecommendation | null;
}

export function RunRecommendationPanel({ runId, recommendation }: RunRecommendationPanelProps) {
  const updateRecFn = useServerFn(updateRecommendation);
  const [recText, setRecText] = useState(recommendation?.recommendation_text ?? "");
  const [saving, setSaving] = useState(false);

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

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Agent Recommendation</CardTitle>
        <Button size="sm" variant="outline" onClick={save} disabled={saving}>
          <Save className="mr-1 h-3 w-3" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </CardHeader>
      <CardContent>
        <Textarea value={recText} onChange={(e) => setRecText(e.target.value)} rows={4} placeholder="Recommendation text…" />
      </CardContent>
    </Card>
  );
}
