import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { GitCompare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/compare")({
  head: () => ({
    meta: [
      { title: "Compare Runs — GridArena" },
      { name: "description", content: "Compare two experiment runs side by side." },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold">
        <GitCompare className="h-6 w-6 text-primary" />
        Compare Runs
      </h1>

      <div className="mb-8 grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Run A</Label>
          <Select>
            <SelectTrigger><SelectValue placeholder="Select run..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Run #1 — Load Scaling Test</SelectItem>
              <SelectItem value="2">Run #2 — Generator Dispatch</SelectItem>
              <SelectItem value="3">Run #3 — Line Outage Recovery</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Run B</Label>
          <Select>
            <SelectTrigger><SelectValue placeholder="Select run..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Run #1 — Load Scaling Test</SelectItem>
              <SelectItem value="2">Run #2 — Generator Dispatch</SelectItem>
              <SelectItem value="3">Run #3 — Line Outage Recovery</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {["Metadata", "Recommendation", "Parsed Actions", "Evaluation Summary"].map((section) => (
          <Card key={section} className="col-span-2 border-border/60 bg-card/60">
            <CardHeader><CardTitle className="text-base">{section}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">Run A data…</div>
                <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">Run B data…</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
