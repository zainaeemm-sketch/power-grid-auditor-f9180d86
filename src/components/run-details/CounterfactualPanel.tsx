import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { GitCompareArrows, Plus, Download, AlertTriangle } from "lucide-react";
import {
  listCounterfactuals,
  runDefaultCounterfactuals,
  addCustomCounterfactual,
} from "@/server/counterfactual.functions";
import type { CounterfactualWithResult } from "@/server/counterfactual/types";
import { exportCounterfactualCsv } from "@/lib/csv-export";

function changeBadge(c: string) {
  if (c === "improved")
    return <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-300">improved</Badge>;
  if (c === "worsened") return <Badge variant="destructive">worsened</Badge>;
  return <Badge variant="outline">unchanged</Badge>;
}

export function CounterfactualPanel({ runId }: { runId: string }) {
  const listFn = useServerFn(listCounterfactuals);
  const runDefaults = useServerFn(runDefaultCounterfactuals);
  const addCustom = useServerFn(addCustomCounterfactual);

  const [items, setItems] = useState<CounterfactualWithResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [actionType, setActionType] = useState("scale_all_loads");
  const [targetIdx, setTargetIdx] = useState("");
  const [value, setValue] = useState("0.95");
  const [desc, setDesc] = useState("");

  const refresh = async () => {
    try {
      const { items } = await listFn({ data: { runId } });
      setItems(items);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load counterfactuals");
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [runId]);

  const handleRunDefaults = async () => {
    setLoading(true);
    try {
      await runDefaults({ data: { runId } });
      toast.success("Counterfactual analysis executed");
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to run counterfactual analysis");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustom = async () => {
    setLoading(true);
    try {
      await addCustom({
        data: {
          runId,
          action_type: actionType,
          target_index: targetIdx === "" ? null : Number(targetIdx),
          value: value === "" ? null : Number(value),
          description: desc || undefined,
        },
      });
      toast.success("Custom counterfactual executed");
      setOpen(false);
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add counterfactual");
    } finally {
      setLoading(false);
    }
  };

  const chartData = items
    .filter((i) => i.result?.status === "success")
    .map((i) => ({
      name: i.action.description ?? i.action.action_type,
      cf: i.result?.counterfactual_improvement ?? 0,
      base: i.result?.baseline_improvement ?? 0,
    }));
  const chartConfig: ChartConfig = {
    cf: { label: "Counterfactual", color: "hsl(150 70% 50%)" },
    base: { label: "Baseline", color: "hsl(220 70% 60%)" },
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitCompareArrows className="h-4 w-4" />
          Counterfactual Analysis
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={handleRunDefaults} disabled={loading}>
            Run Counterfactual Analysis
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Custom Counterfactual
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Custom Counterfactual</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Action type</Label>
                  <Input value={actionType} onChange={(e) => setActionType(e.target.value)} placeholder="scale_all_loads" />
                </div>
                <div>
                  <Label>Target index (optional)</Label>
                  <Input value={targetIdx} onChange={(e) => setTargetIdx(e.target.value)} placeholder="—" />
                </div>
                <div>
                  <Label>Value</Label>
                  <Input type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} />
                </div>
                <div>
                  <Label>Description (optional)</Label>
                  <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddCustom} disabled={loading}>Run</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="outline" onClick={() => exportCounterfactualCsv(runId, items)} disabled={!items.length}>
            <Download className="mr-1 h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!items.length ? (
          <p className="text-sm text-muted-foreground">No counterfactual analysis executed.</p>
        ) : (
          <>
            {chartData.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs text-muted-foreground">
                  Counterfactual vs baseline improvement
                </p>
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={10} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis fontSize={11} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="base" fill="hsl(220 70% 60%)" />
                    <Bar dataKey="cf" fill="hsl(150 70% 50%)" />
                  </BarChart>
                </ChartContainer>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Feasibility Δ</TableHead>
                  <TableHead className="text-right">Δ violations</TableHead>
                  <TableHead className="text-right">Optimality gap</TableHead>
                  <TableHead className="text-right">Regret</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(({ action, result }) => (
                  <TableRow key={action.id}>
                    <TableCell className="font-mono text-xs">{action.action_type}</TableCell>
                    <TableCell className="text-xs">{action.target_index ?? "—"}</TableCell>
                    <TableCell className="text-xs">{action.value ?? "—"}</TableCell>
                    <TableCell>
                      {result?.failure_reason ? (
                        <span className="flex items-center gap-1 text-xs text-amber-400">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          failed
                        </span>
                      ) : result ? changeBadge(result.feasibility_change) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs">{result?.violation_difference ?? "—"}</TableCell>
                    <TableCell className="text-right text-xs">{result?.optimality_gap?.toFixed(3) ?? "—"}</TableCell>
                    <TableCell className="text-right text-xs">{result?.decision_regret?.toFixed(3) ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
