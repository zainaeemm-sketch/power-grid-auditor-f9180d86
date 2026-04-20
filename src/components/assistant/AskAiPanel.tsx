import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Sparkles, Send, Loader2, User as UserIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { askGridArenaAi } from "@/server/assistant.functions";
import { QUICK_PROMPTS } from "@/lib/assistant-knowledge";
import { usePageContext, describePageContext } from "@/hooks/usePageContext";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AskAiPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AskAiPanel({ open, onOpenChange }: AskAiPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const ask = useServerFn(askGridArenaAi);
  const pageContext = usePageContext();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await ask({
        data: {
          messages: next.slice(-20),
          pageContext,
        },
      });
      setMessages([...next, { role: "assistant", content: res.reply }]);
      if (res.error === "rate_limited" || res.error === "quota_exhausted") {
        toast.error(res.reply);
      }
    } catch (e) {
      // Server fns throw a raw Response on handler/validator failure
      let msg = "Unknown error";
      if (e instanceof Response) {
        try {
          msg = (await e.text()) || `HTTP ${e.status}`;
        } catch {
          msg = `HTTP ${e.status}`;
        }
      } else if (e instanceof Error) {
        msg = e.message;
      }
      console.error("[AskAi] failed", e, msg);
      setMessages([
        ...next,
        { role: "assistant", content: `Sorry — something went wrong:\n\n\`\`\`\n${msg}\n\`\`\`` },
      ]);
      toast.error("Failed to reach Ask AI");
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[440px]">
        <SheetHeader className="border-b border-border/50 px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Ask AI
            <span className="text-xs font-normal text-muted-foreground">· GridArena assistant</span>
          </SheetTitle>
          <SheetDescription className="text-xs">
            Context: <span className="font-mono">{describePageContext(pageContext)}</span>
          </SheetDescription>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                I can explain features, help debug runs, and walk you through workflows. Try one:
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => void send(q)}
                    className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-foreground transition-colors hover:border-primary/60 hover:bg-primary/10"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((m, i) => (
                <MessageBubble key={i} message={m} />
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Thinking…
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border/50 p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask anything about GridArena…"
              rows={2}
              maxLength={4000}
              disabled={loading}
              className="min-h-[44px] resize-none text-sm"
            />
            <Button
              size="icon"
              onClick={() => void send(input)}
              disabled={loading || !input.trim()}
              className="h-10 w-10 shrink-0"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Enter to send · Shift+Enter for newline</span>
            <Badge variant="outline" className="text-[10px]">beta</Badge>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted/60 text-foreground border border-border/40",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none break-words [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_code]:rounded [&_code]:bg-background/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <UserIcon className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}
