/**
 * RTL tests for SuggestionReviewDrawer.
 *
 * The server functions are mocked because they would otherwise hit the real
 * OpenAI API and Supabase. We assert UI flow only:
 *   - list (target rendering)
 *   - accept (success: row marked Applied + onApplied called)
 *   - accept (error: toast.error called, row stays editable)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const suggestCaseMetaFix = vi.fn();
const acceptCaseMetaFix = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock("@/server/case-fix.functions", () => ({
  suggestCaseMetaFix: (...args: unknown[]) => suggestCaseMetaFix(...args),
  acceptCaseMetaFix: (...args: unknown[]) => acceptCaseMetaFix(...args),
  revertCaseMetaOverride: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

import { SuggestionReviewDrawer, type SuggestTarget } from "@/components/docs/SuggestionReviewDrawer";

const targets: SuggestTarget[] = [
  {
    caseKey: "case14",
    field: "dataset_version",
    severity: "error",
    message: "missing dataset_version",
    currentValue: undefined,
  },
  {
    caseKey: "case30",
    field: "random_seed",
    severity: "warning",
    message: "must be a non-negative integer",
    currentValue: "abc",
  },
];

const currentMetaByCase = {
  case14: { source: "x" },
  case30: { source: "y" },
};

beforeEach(() => {
  suggestCaseMetaFix.mockReset();
  acceptCaseMetaFix.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
});

describe("SuggestionReviewDrawer", () => {
  it("lists every target with severity badge and pending count", () => {
    render(
      <SuggestionReviewDrawer
        targets={targets}
        currentMetaByCase={currentMetaByCase}
        onClose={() => {}}
        onApplied={() => {}}
      />,
    );

    expect(screen.getByRole("dialog", { name: /AI bulk-fix/i })).toBeInTheDocument();
    expect(screen.getByText("case14")).toBeInTheDocument();
    expect(screen.getByText("case30")).toBeInTheDocument();
    expect(screen.getByText(/2 fields · 2 pending/i)).toBeInTheDocument();
    // Two "Suggest fix" buttons (one per row, before suggestion is loaded)
    expect(screen.getAllByRole("button", { name: /Suggest fix/i })).toHaveLength(2);
  });

  it("accepts an AI suggestion (success path)", async () => {
    const user = userEvent.setup();
    const onApplied = vi.fn();

    suggestCaseMetaFix.mockResolvedValueOnce({
      value: "gridarena-case14@1.0.0",
      rationale: "Matches sibling convention.",
      confidence: "high",
      model: "gpt-4o-mini",
    });
    acceptCaseMetaFix.mockResolvedValueOnce({
      id: "row-1",
      case_key: "case14",
      field: "dataset_version",
      value: "gridarena-case14@1.0.0",
      source: "ai_suggested",
      ai_rationale: "Matches sibling convention.",
      ai_model: "gpt-4o-mini",
      created_at: "",
      updated_at: "",
    });

    render(
      <SuggestionReviewDrawer
        targets={[targets[0]!]}
        currentMetaByCase={currentMetaByCase}
        onClose={() => {}}
        onApplied={onApplied}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Suggest fix/i }));
    await waitFor(() => expect(suggestCaseMetaFix).toHaveBeenCalledTimes(1));

    // Proposed value textarea is visible & editable.
    const textarea = await screen.findByRole("textbox");
    expect(textarea).toHaveValue("gridarena-case14@1.0.0");

    await user.click(screen.getByRole("button", { name: /Accept & save/i }));

    await waitFor(() => expect(acceptCaseMetaFix).toHaveBeenCalledTimes(1));
    expect(acceptCaseMetaFix).toHaveBeenCalledWith({
      data: expect.objectContaining({
        caseKey: "case14",
        field: "dataset_version",
        value: "gridarena-case14@1.0.0",
        source: "ai_suggested",
      }),
    });
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalled();
    expect(await screen.findByText(/Applied/)).toBeInTheDocument();
  });

  it("shows toast.error and keeps row editable when accept fails", async () => {
    const user = userEvent.setup();
    const onApplied = vi.fn();

    suggestCaseMetaFix.mockResolvedValueOnce({
      value: 42,
      rationale: "Common seed.",
      confidence: "medium",
      model: "gpt-4o-mini",
    });
    acceptCaseMetaFix.mockRejectedValueOnce(new Error("DB write failed"));

    render(
      <SuggestionReviewDrawer
        targets={[targets[1]!]}
        currentMetaByCase={currentMetaByCase}
        onClose={() => {}}
        onApplied={onApplied}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Suggest fix/i }));
    await screen.findByRole("button", { name: /Accept & save/i });

    await user.click(screen.getByRole("button", { name: /Accept & save/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("DB write failed"));
    expect(onApplied).not.toHaveBeenCalled();
    // Row stays in "ready" — Accept button still present, no Applied chip.
    expect(screen.getByRole("button", { name: /Accept & save/i })).toBeInTheDocument();
    expect(screen.queryByText(/^Applied$/)).not.toBeInTheDocument();
  });

  it("shows toast.error when suggest call fails", async () => {
    const user = userEvent.setup();
    suggestCaseMetaFix.mockRejectedValueOnce(new Error("OpenAI rate limit"));

    render(
      <SuggestionReviewDrawer
        targets={[targets[0]!]}
        currentMetaByCase={currentMetaByCase}
        onClose={() => {}}
        onApplied={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Suggest fix/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("OpenAI rate limit"));
    // Inline error visible alongside re-enabled Suggest button.
    expect(screen.getByText("OpenAI rate limit")).toBeInTheDocument();
  });
});
