import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Wand2, RefreshCw, X, Check } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { suggestPreset, type PresetSuggestion } from "@/server/preset-assist.functions";
import { toast } from "sonner";

const EXAMPLES = [
  "baseline GPT-4o, low temp, simulation eval",
  "strict heuristic preset for rule-based eval",
  "creative high-temp explorer for case studies",
];

const DRAFT_KEY = "gridarena.presetAssist.draft.v1";

type PersistedDraft = {
  prompt: string;
  suggestion: PresetSuggestion | null;
  model: string | null;
};

function loadDraft(): PersistedDraft {
  if (typeof window === "undefined") return { prompt: "", suggestion: null, model: null };
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return { prompt: "", suggestion: null, model: null };
    const parsed = JSON.parse(raw) as Partial<PersistedDraft>;
    return {
      prompt: typeof parsed.prompt === "string" ? parsed.prompt : "",
      suggestion: parsed.suggestion ?? null,
      model: typeof parsed.model === "string" ? parsed.model : null,
    };
  } catch {
    return { prompt: "", suggestion: null, model: null };
  }
}

function saveDraft(draft: PersistedDraft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota errors */
  }
}

function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

type Props = {
  onApply: (suggestion: PresetSuggestion) => void;
};

export function PresetAssistCard({ onApply }: Props) {
  const suggestFn = useServerFn(suggestPreset);
  const initial = loadDraft();
  const [prompt, setPrompt] = useState(initial.prompt);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<PresetSuggestion | null>(initial.suggestion);
  const [model, setModel] = useState<string | null>(initial.model);

  // Persist whenever prompt / suggestion / model change.
  useEffect(() => {
    saveDraft({ prompt, suggestion, model });
  }, [prompt, suggestion, model]);

  const runSuggest = async () => {
    if (prompt.trim().length < 3) {
      toast.error("Describe your preset in a sentence or two.");
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
    setSuggestion(null);
    setPrompt("");
    setModel(null);
    clearDraft();
  };

  const discard = () => {
    setSuggestion(null);
    setModel(null);
    // Keep the prompt so the user can tweak and regenerate; persist the cleared suggestion.
    saveDraft({ prompt, suggestion: null, model: null });
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="space-y-3 pt-4">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., a careful GPT-4o baseline for power-flow analysis, low temperature, simulation mode"
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
              <div className="font-semibold text-foreground text-sm">{suggestion.name}</div>
              <div className="flex shrink-0 gap-1">
                <span className="rounded bg-primary/15 px-1.5 py-0.5 font-medium text-primary">
                  {suggestion.provider_name}/{suggestion.model_name}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5">{suggestion.evaluation_mode}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono">
              <div><span className="text-muted-foreground">temp</span> {suggestion.temperature}</div>
              <div><span className="text-muted-foreground">top_p</span> {suggestion.top_p}</div>
              <div><span className="text-muted-foreground">max</span> {suggestion.max_tokens}</div>
            </div>
            <div>
              <div className="text-muted-foreground font-semibold mb-0.5">System prompt</div>
              <div className="whitespace-pre-wrap text-foreground/90 line-clamp-4">{suggestion.system_prompt}</div>
            </div>
            <div>
              <div className="text-muted-foreground font-semibold mb-0.5">Default prompt</div>
              <div className="whitespace-pre-wrap text-foreground/90 line-clamp-3">{suggestion.default_prompt_text}</div>
            </div>
            <div>
              <div className="text-muted-foreground font-semibold mb-0.5">Why</div>
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
