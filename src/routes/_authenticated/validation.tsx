import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ShieldCheck, Play, Download, RefreshCw, ChevronDown, ChevronRight, Trash2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  runAllValidations, getValidationResults, clearValidationResults, deleteValidationResult,
} from "@/server/validation.functions";
import { exportValidationCsv, exportValidationJson, type ValidationRow } from "@/lib/validation-export";

export const Route = createFileRoute("/_authenticated/validation")({
  component: ValidationPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-3xl p-8">
        <Card>
          <CardHeader><CardTitle>Validation page error</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{error.message}</p>
            <Button onClick={() => { router.invalidate(); reset(); }}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl p-8">
      <Card>
        <CardHeader><CardTitle>Page not found</CardTitle></CardHeader>
        <CardContent><Link to="/" className="text-primary underline">Go home</Link></CardContent>
      </Card>
    </div>
  ),
});

const TYPE_LABELS: Record<string, string> = {
  parser: "Parser",
  evaluation: "Evaluation",
  reproducibility: "Reproducibility",
  batch_stability: "Batch stability",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "passed") return <Badge className="border border-primary/30 bg-primary/15 text-primary">Passed</Badge>;
  if (status === "failed") return <Badge variant="destructive">Failed</Badge>;
  return <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">Error</Badge>;
}

function ValidationPage() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["validation-results"],
    queryFn: () => getValidationResults({ data: { limit: 200 } }),
  });

  const runMutation = useMutation({
    mutationFn: () => runAllValidations({ data: undefined as any }),
    onSuccess: (res: any) => {
      if (res?.success) {
        toast.success(`Ran ${res.total} tests · ${res.passed} passed · ${res.failed} failed · ${res.errored} errored`);
      } else {
        toast.error(res?.error ?? "Validation run failed");
      }
      refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Validation run failed"),
  });

  const clearMutation = useMutation({
    mutationFn: () => clearValidationResults({ data: undefined as any }),
    onSuccess: () => { toast.success("Cleared validation history"); refetch(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteValidationResult({ data: { id } }),
    onSuccess: () => { toast.success("Result deleted"); refetch(); },
    onError: (e: any) => toast.error(e?.message || "Failed to delete"),
  });

  const rows: ValidationRow[] = (data as any)?.results ?? [];
  const total = rows.length;
  const passed = rows.filter((r) => r.status === "passed").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const errored = rows.filter((r) => r.status === "error").length;
  const avgMs = total ? Math.round(rows.reduce((s, r) => s + (r.execution_time_ms || 0), 0) / total) : 0;

  const grouped = rows.reduce<Record<string, ValidationRow[]>>((acc, r) => {
    (acc[r.test_type] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold">System Validation</h1>
            <p className="text-sm text-muted-foreground">Deterministic parser, evaluation, reproducibility and stability checks.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending} className="gap-2">
            <Play className="h-4 w-4" />
            {runMutation.isPending ? "Running…" : "Run All Validation Tests"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" disabled={!rows.length}>
                <Download className="h-4 w-4" /> Export Validation Report
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportValidationCsv(rows)}>Export as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportValidationJson(rows)}>Export as JSON</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={() => refetch()} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => clearMutation.mutate()} disabled={!rows.length} title="Clear history">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total tests</div><div className="text-2xl font-bold">{total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle2 className="h-3 w-3 text-primary" /> Passed</div><div className="text-2xl font-bold text-primary">{passed}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-1 text-xs text-muted-foreground"><XCircle className="h-3 w-3 text-destructive" /> Failed / errored</div><div className="text-2xl font-bold text-destructive">{failed + errored}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Avg execution</div><div className="text-2xl font-bold">{avgMs} ms</div></CardContent></Card>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : !rows.length ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <ShieldCheck className="mx-auto mb-3 h-10 w-10 opacity-40" />
            No validation runs yet. Click <span className="font-medium text-foreground">Run All Validation Tests</span> to execute the suite.
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([type, group]) => (
          <Card key={type}>
            <CardHeader>
              <CardTitle className="text-base">{TYPE_LABELS[type] ?? type} <span className="ml-2 text-xs font-normal text-muted-foreground">({group.length})</span></CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Test</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-24">Time</TableHead>
                    <TableHead className="w-44">When</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.map((r: any) => {
                    const key = r.id ?? `${r.test_name}-${r.created_at}`;
                    const isOpen = !!expanded[key];
                    const hasFail = r.status !== "passed";
                    return (
                      <Fragment key={key}>
                        <TableRow className={hasFail ? "cursor-pointer" : undefined} onClick={() => hasFail && setExpanded((s) => ({ ...s, [key]: !s[key] }))}>
                          <TableCell>{hasFail ? (isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}</TableCell>
                          <TableCell className="font-medium">{r.test_name}</TableCell>
                          <TableCell><StatusBadge status={r.status} /></TableCell>
                          <TableCell className="text-muted-foreground">{r.execution_time_ms} ms</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {r.id && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Delete result"
                                onClick={() => deleteMutation.mutate(r.id)} disabled={deleteMutation.isPending}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        {isOpen && hasFail && (
                          <TableRow>
                            <TableCell colSpan={5} className="bg-muted/20">
                              <div className="space-y-3 p-3">
                                {r.failure_reason && (
                                  <div className="flex items-start gap-2 text-sm text-destructive">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>{r.failure_reason}</span>
                                  </div>
                                )}
                                {r.debug_hint && (
                                  <div className="text-xs text-muted-foreground">💡 {r.debug_hint}</div>
                                )}
                                <div className="grid gap-3 md:grid-cols-2">
                                  <div>
                                    <div className="mb-1 text-xs font-medium text-muted-foreground">Expected</div>
                                    <pre className="overflow-x-auto rounded bg-background/60 p-2 text-xs">{JSON.stringify(r.expected_output, null, 2)}</pre>
                                  </div>
                                  <div>
                                    <div className="mb-1 text-xs font-medium text-muted-foreground">Actual</div>
                                    <pre className="overflow-x-auto rounded bg-background/60 p-2 text-xs">{JSON.stringify(r.actual_output, null, 2)}</pre>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
