import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RunParseResult } from "@/types/grid-arena";

interface ParserProvenancePanelProps {
  parseResult: RunParseResult | null;
}

export function ParserProvenancePanel({ parseResult }: ParserProvenancePanelProps) {
  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader>
        <CardTitle className="text-base">Parser Provenance</CardTitle>
      </CardHeader>
      <CardContent>
        {parseResult ? (
          <div className="space-y-2 text-sm">
            <Row label="Action Type" value={parseResult.action_type || "—"} />
            <Row label="Target Index" value={parseResult.target_index?.toString() ?? "—"} />
            <Row label="Value" value={parseResult.value?.toString() ?? "—"} />
            <Row label="Enabled" value={parseResult.enabled ? "Yes" : "No"} />
            {parseResult.source_text && (
              <div className="space-y-1">
                <span className="text-muted-foreground">Source Text</span>
                <p className="rounded bg-muted/30 p-2 text-xs font-mono whitespace-pre-wrap">{parseResult.source_text}</p>
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
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
