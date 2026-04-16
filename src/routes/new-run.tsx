import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export const Route = createFileRoute("/new-run")({
  head: () => ({
    meta: [
      { title: "New Run — GridArena" },
      { name: "description", content: "Create a new experiment run." },
    ],
  }),
  component: NewRunPage,
});

function NewRunPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [task, setTask] = useState("");
  const [agent, setAgent] = useState("");
  const [caseName, setCaseName] = useState("");
  const [researchQuestion, setResearchQuestion] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Phase 2: will create run via server function
    navigate({ to: "/runs" });
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">New Experiment Run</h1>

      <form onSubmit={handleSubmit}>
        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Run Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Preset selector */}
            <div className="space-y-2">
              <Label>Preset (optional)</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Select a preset..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No preset</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Run Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Load Scaling Test" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task">Task</Label>
                <Input id="task" value={task} onChange={(e) => setTask(e.target.value)} placeholder="e.g., load_scaling" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent">Agent</Label>
                <Input id="agent" value={agent} onChange={(e) => setAgent(e.target.value)} placeholder="e.g., gpt-4o" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="case">Benchmark Case</Label>
              <Input id="case" value={caseName} onChange={(e) => setCaseName(e.target.value)} placeholder="e.g., ieee14" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rq">Research Question</Label>
              <Textarea id="rq" value={researchQuestion} onChange={(e) => setResearchQuestion(e.target.value)} placeholder="What is this experiment trying to answer?" rows={3} />
            </div>

            <Button type="submit" className="w-full">Create Run</Button>
          </CardContent>
        </Card>
      </form>
    </main>
  );
}
