import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Wand2, RefreshCw, X, Check } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { suggestScenario, type ScenarioSuggestion } from "@/server/scenario-assist.functions";
import { toast } from "sonner";

const EXAMPLES = [
  "case14 with two lines tripped, study redispatch",
  "case30 under +20% load spike, find a corrective action",
  "case5 generator trip — agent must rebalance",
];

type Props = {
  onApply: (suggestion: ScenarioSuggestion) => void;
};

export function ScenarioAssistCard({ onApply }: Props) {
  const suggestFn = useServerFn(suggestScenario);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<ScenarioSuggestion | null>(null);
  const [model, setModel] = useState<string | null>(null);

  const runSuggest = async () => {
    if (prompt.trim().length < 3) {
      toast.error("Describe your scenario in a sentence or two.");
      return;
    }
    setLoading(true);
    try {
      const result = await suggestFn({ data: { prompt: prompt.trim() } });
      if (result.ok) {
        setSuggestion(result.suggestion);
        setModel(result.model);
      } else {
        toast.error(result.error);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to get suggestion. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!suggestion) return;
    onApply(suggestion);
    toast.success("Suggestion applied to form");
    setSuggestion(null);
  };

  return (
    <Card className="mb-4 border-primary/30 bg-primary/5 animate-fade-up" style={{ animationDelay: "25ms" }}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <Sparkles className="h-4 w-4 text-primary" />
          Describe your scenario (AI Assist)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., case14 with two lines tripped, study redispatch under contingency"
          rows={3}
          disabled={loading}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={runSuggest}
            disabled={loading || prompt.trim().length < 3}
            className="bg-primary text-primary-foreground"
          >
            <Wand2 className="mr-2 h-3.5 w-3.5" />
            {loading ? "Thinking…" : "Suggest with AI"}
          </Button>
          <span className="text-xs text-muted-foreground">examples:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setPrompt(ex)}
              disabled={loading}
              className="rounded-full border border-border/50 px-2 py-0.5 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>

        {suggestion && (
          <div className="rounded-md border border-primary/30 bg-background/60 p-3 space-y-2 text-xs animate-fade-up">
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-foreground text-sm">{suggestion.title}</div>
              <div className="flex shrink-0 gap-1">
                <span className="rounded bg-primary/15 px-1.5 py-0.5 font-medium text-primary">{suggestion.case_name}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{suggestion.evaluation_mode}</span>
              </div>
            </div>
            <div>
              <div className="text-muted-foreground font-semibold mb-0.5">Task</div>
              <div className="whitespace-pre-wrap text-foreground/90">{suggestion.task}</div>
            </div>
            <div>
              <div className="text-muted-foreground font-semibold mb-0.5">Research question</div>
              <div className="text-foreground/90">{suggestion.research_question}</div>
            </div>
            <div>
              <div className="text-muted-foreground font-semibold mb-0.5">Why this case</div>
              <div className="italic text-muted-foreground">{suggestion.rationale}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button type="button" size="sm" onClick={apply} className="bg-primary text-primary-foreground">
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Apply to form
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setSuggestion(null)}>
                <X className="mr-1.5 h-3.5 w-3.5" />
                Discard
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={runSuggest} disabled={loading}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Regenerate
              </Button>
              {model && (
                <span className="ml-auto text-[10px] text-muted-foreground">
                  Suggested by <code className="font-mono">{model}</code> via your configured OpenAI endpoint
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
