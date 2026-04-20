import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Activity, AlertTriangle, Download, MinusCircle, Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  listPerturbationTests,
  runDefaultPerturbations,
  addCustomPerturbation,
} from "@/server/perturbation.functions";
import type { PerturbationTestWithResult, PerturbationType } from "@/types/grid-arena";
import { exportSensitivityCsv } from "@/lib/csv-export";
import { classifyPerturbation, detectPerturbationEngine, type PerturbationEngine } from "@/lib/simulation-skip";

function engineBadge(engine: PerturbationEngine) {
  const map: Record<PerturbationEngine, { label: string; className: string }> = {
    "pandapower-external": {
      label: "pandapower",
      className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    },
    "dc-powerflow": {
      label: "DC PF",
      className: "border-sky-500/40 bg-sky-500/10 text-sky-300",
    },
    skipped: {
      label: "skipped",
      className: "text-muted-foreground",
    },
    unknown: {
      label: "unknown",
      className: "text-muted-foreground",
    },
  };
  const { label, className } = map[engine];
  return (
    <Badge variant="outline" className={`text-[10px] ${className}`}>
      {label}
    </Badge>
  );
}

const TYPES: PerturbationType[] = [
  "increase_load_percent",
  "decrease_load_percent",
  "line_outage",
  "line_restoration",
  "generator_limit_change",
  "generator_dispatch_change",
  "n1_contingency",
  "voltage_setpoint_shift",
];

function robustnessBadge(result: string) {
  if (result === "stable") return <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-300">stable</Badge>;
  if (result === "degraded") return <Badge variant="secondary" className="bg-amber-500/15 text-amber-300">degraded</Badge>;
  return <Badge variant="destructive">failed</Badge>;
}

export function SensitivityPanel({ runId }: { runId: string }) {
  const listFn = useServerFn(listPerturbationTests);
  const runDefaults = useServerFn(runDefaultPerturbations);
  const addCustom = useServerFn(addCustomPerturbation);

  const [items, setItems] = useState<PerturbationTestWithResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pType, setPType] = useState<PerturbationType>("increase_load_percent");
  const [pName, setPName] = useState("load_percent");
  const [pVal, setPVal] = useState<string>("5");

  const refresh = async () => {
    try {
      const { items } = await listFn({ data: { runId } });
      setItems(items);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load sensitivity tests");
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [runId]);

  const handleRunDefaults = async () => {
    setLoading(true);
    try {
      await runDefaults({ data: { runId } });
      toast.success("Sensitivity tests executed");
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to run sensitivity tests");
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
          perturbation_type: pType,
          parameter_name: pName,
          parameter_value: pVal === "" ? null : Number(pVal),
        },
      });
      toast.success("Custom perturbation executed");
      setDialogOpen(false);
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add perturbation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Sensitivity Analysis
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleRunDefaults} disabled={loading}>
            Run Sensitivity Test
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Custom Perturbation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Custom Perturbation</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Type</Label>
                  <Select value={pType} onValueChange={(v) => setPType(v as PerturbationType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Parameter name</Label>
                  <Input value={pName} onChange={(e) => setPName(e.target.value)} />
                </div>
                <div>
                  <Label>Parameter value</Label>
                  <Input type="number" value={pVal} onChange={(e) => setPVal(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddCustom} disabled={loading}>Run</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="outline" onClick={() => exportSensitivityCsv(runId, items)} disabled={!items.length}>
            <Download className="mr-1 h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!items.length ? (
          <p className="text-sm text-muted-foreground">No sensitivity tests executed.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Parameter</TableHead>
                <TableHead>Baseline</TableHead>
                <TableHead>Perturbed</TableHead>
                <TableHead className="text-right">Δ violations</TableHead>
                <TableHead>Robustness</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(({ test, result }) => (
                <TableRow key={test.id}>
                  <TableCell className="font-mono text-xs">{test.perturbation_type}</TableCell>
                  <TableCell className="text-xs">
                    {test.parameter_name}={test.parameter_value ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">{result?.baseline_feasibility ?? "—"}</TableCell>
                  <TableCell className="text-xs">{result?.perturbed_feasibility ?? "—"}</TableCell>
                  <TableCell className="text-right text-xs">{result?.violation_change ?? "—"}</TableCell>
                  <TableCell>
                    {(() => {
                      if (!result) return "—";
                      const kind = classifyPerturbation(result.failure_reason, result.notes);
                      if (kind === "skipped") {
                        return (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <MinusCircle className="h-3.5 w-3.5" />
                                  skipped
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs">
                                  No simulator available for this case. Perturbation tests need a built-in case (ieee9/14/30) or an external pandapower service with perturbation support.
                                </p>
                                {result.failure_reason && (
                                  <p className="mt-1 text-xs text-muted-foreground">{result.failure_reason}</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      }
                      if (kind === "failed") {
                        return (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center gap-1 text-xs text-amber-400">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  failed
                                </span>
                              </TooltipTrigger>
                              {result.failure_reason && (
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">{result.failure_reason}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        );
                      }
                      return robustnessBadge(result.robustness_result);
                    })()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
