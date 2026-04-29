/**
 * RTL tests for OverridesSection: list + revert (success + error).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const revertCaseMetaOverride = vi.fn();
const bulkRevertCaseMetaOverrides = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/server/case-fix.functions", () => ({
  revertCaseMetaOverride: (...args: unknown[]) => revertCaseMetaOverride(...args),
  bulkRevertCaseMetaOverrides: (...args: unknown[]) => bulkRevertCaseMetaOverrides(...args),
  suggestCaseMetaFix: vi.fn(),
  acceptCaseMetaFix: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

import { OverridesSection } from "@/components/docs/OverridesSection";
import type { CaseMetaOverrideRow } from "@/server/case-fix.functions";

const overrides: CaseMetaOverrideRow[] = [
  {
    id: "o1",
    case_key: "case14",
    field: "dataset_version",
    value: "gridarena-case14@1.0.0",
    source: "ai_suggested",
    ai_rationale: "Matches sibling convention",
    ai_model: "gpt-4o-mini",
    created_at: "",
    updated_at: "",
  },
  {
    id: "o2",
    case_key: "case30",
    field: "random_seed",
    value: 42,
    source: "manual",
    ai_rationale: null,
    ai_model: null,
    created_at: "",
    updated_at: "",
  },
];

beforeEach(() => {
  revertCaseMetaOverride.mockReset();
  bulkRevertCaseMetaOverrides.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
});

describe("OverridesSection", () => {
  it("renders nothing when there are no overrides", () => {
    const { container } = render(<OverridesSection overrides={[]} onChanged={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists each override with case, field, value, and source badge", () => {
    render(<OverridesSection overrides={overrides} onChanged={() => {}} />);
    expect(screen.getByRole("region", { name: /Active case-meta overrides/i })).toBeInTheDocument();
    expect(screen.getByText(/Active case-meta overrides \(2\)/)).toBeInTheDocument();
    expect(screen.getByText("case14")).toBeInTheDocument();
    expect(screen.getByText("case30")).toBeInTheDocument();
    expect(screen.getByText("gridarena-case14@1.0.0")).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("manual")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Revert$/ })).toHaveLength(2);
  });

  it("reverts an override (success path) and calls onChanged", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    revertCaseMetaOverride.mockResolvedValueOnce({ ok: true });

    render(<OverridesSection overrides={overrides} onChanged={onChanged} />);

    const buttons = screen.getAllByRole("button", { name: /^Revert$/ });
    await user.click(buttons[0]!);

    await waitFor(() => expect(revertCaseMetaOverride).toHaveBeenCalledTimes(1));
    expect(revertCaseMetaOverride).toHaveBeenCalledWith({ data: { id: "o1" } });
    expect(toastSuccess).toHaveBeenCalledWith("Override reverted");
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("shows toast.error and does not call onChanged when revert fails", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    revertCaseMetaOverride.mockRejectedValueOnce(new Error("delete forbidden"));

    render(<OverridesSection overrides={overrides} onChanged={onChanged} />);

    const buttons = screen.getAllByRole("button", { name: /^Revert$/ });
    await user.click(buttons[1]!);

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("delete forbidden"));
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("bulk-reverts the selected overrides in a single request", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    bulkRevertCaseMetaOverrides.mockResolvedValueOnce({
      reverted_ids: ["o1", "o2"],
      skipped_ids: [],
    });

    render(<OverridesSection overrides={overrides} onChanged={onChanged} />);

    await user.click(screen.getByRole("checkbox", { name: /Select all overrides/i }));
    await user.click(screen.getByRole("button", { name: /^Revert selected/ }));

    await waitFor(() => expect(bulkRevertCaseMetaOverrides).toHaveBeenCalledTimes(1));
    expect(bulkRevertCaseMetaOverrides).toHaveBeenCalledWith({
      data: { ids: ["o1", "o2"] },
    });
    expect(toastSuccess).toHaveBeenCalledWith("Reverted 2 overrides");
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("rolls back optimistic removal and shows error when bulk revert fails", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    bulkRevertCaseMetaOverrides.mockRejectedValueOnce(new Error("network down"));

    render(<OverridesSection overrides={overrides} onChanged={onChanged} />);

    await user.click(
      screen.getByRole("checkbox", { name: /Select override case14 dataset_version/i }),
    );
    await user.click(screen.getByRole("button", { name: /^Revert selected/ }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("network down"));
    expect(onChanged).not.toHaveBeenCalled();
    // Row remains visible after rollback.
    expect(screen.getByText("case14")).toBeInTheDocument();
  });
});
