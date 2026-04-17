import type { BatchRunWithEvaluation } from "@/types/grid-arena";
import {
  bestModel,
  bestAgent,
  bestCase,
  robustnessNotes,
  failureModes,
} from "@/lib/batch-summary";

interface Props {
  runs: BatchRunWithEvaluation[];
}

export function ExecutiveSummary({ runs }: Props) {
  if (runs.length === 0) {
    return <p className="text-sm text-muted-foreground">No completed runs to summarize.</p>;
  }

  const model = bestModel(runs);
  const agent = bestAgent(runs);
  const case_ = bestCase(runs);
  const { highVariance, stable } = robustnessNotes(runs);
  const failures = failureModes(runs);

  const fmt = (n: number) => n.toFixed(2);

  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <p>
        Across <strong>{runs.length}</strong> run{runs.length === 1 ? "" : "s"} in this batch, the
        best-performing model was{" "}
        <strong>{model?.key ?? "—"}</strong>
        {model && (
          <>
            {" "}with a mean violation improvement of <strong>{fmt(model.mean)}</strong> across{" "}
            {model.count} run{model.count === 1 ? "" : "s"}
          </>
        )}
        . The most effective agent was <strong>{agent?.key ?? "—"}</strong>
        {agent && <> (mean improvement {fmt(agent.mean)})</>}, and the case yielding the highest
        improvement was <strong>{case_?.key ?? "—"}</strong>
        {case_ && <> (mean {fmt(case_.mean)})</>}.
      </p>

      <p>
        <strong>Robustness:</strong>{" "}
        {stable.length > 0 ? (
          <>
            Stable models (low improvement variance):{" "}
            <em>{stable.map((s) => s.key).join(", ")}</em>.{" "}
          </>
        ) : (
          "No stable model identified yet (insufficient repetitions). "
        )}
        {highVariance.length > 0 && (
          <>
            Models with high run-to-run variance:{" "}
            <em>{highVariance.map((s) => `${s.key} (σ²=${fmt(s.variance)})`).join(", ")}</em>.
          </>
        )}
      </p>

      <p>
        <strong>Failure modes:</strong>{" "}
        {failures.infeasibleCount} infeasible recommendation
        {failures.infeasibleCount === 1 ? "" : "s"}, {failures.ungroundedCount} ungrounded
        evaluation{failures.ungroundedCount === 1 ? "" : "s"} out of {failures.total} total.
        {failures.recurringNotes.length > 0 && (
          <>
            {" "}Recurring evaluator remarks:
            <ul className="ml-5 mt-1 list-disc">
              {failures.recurringNotes.map((n) => (
                <li key={n.phrase}>
                  <span className="italic">"{n.phrase}…"</span> ×{n.count}
                </li>
              ))}
            </ul>
          </>
        )}
      </p>
    </div>
  );
}
