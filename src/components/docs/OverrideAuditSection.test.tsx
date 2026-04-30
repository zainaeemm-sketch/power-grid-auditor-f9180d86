import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const listCaseMetaOverrideAudit = vi.fn();
const toastError = vi.fn();

vi.mock("@/server/case-fix.functions", () => ({
  listCaseMetaOverrideAudit: (...args: unknown[]) => listCaseMetaOverrideAudit(...args),
}));
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));
// `<Link>` from TanStack Router needs a router context; stub to a plain anchor.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

import { OverrideAuditSection } from "@/components/docs/OverrideAuditSection";

beforeEach(() => {
  listCaseMetaOverrideAudit.mockReset();
  toastError.mockReset();
});

describe("OverrideAuditSection", () => {
  it("shows a loading skeleton on first render", () => {
    listCaseMetaOverrideAudit.mockReturnValueOnce(new Promise(() => {})); // never resolves
    render(<OverrideAuditSection />);
    expect(screen.getByLabelText(/Case-meta override audit trail/i)).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByText(/Loading…/)).toBeInTheDocument();
  });

  it("renders the 'Sign in to view audit logs' state for anonymous users", async () => {
    listCaseMetaOverrideAudit.mockResolvedValueOnce({
      ok: false,
      error: "unauthenticated",
      message: "Sign in to view audit logs.",
    });
    render(<OverrideAuditSection />);
    await waitFor(() =>
      expect(screen.getByText(/Sign in to view audit logs\./i)).toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: /Sign in/i })).toHaveAttribute("href", "/login");
    // Auth-required is not a real error → no toast spam.
    expect(toastError).not.toHaveBeenCalled();
  });

  it("renders an inline error and toasts when the server reports a failure", async () => {
    listCaseMetaOverrideAudit.mockResolvedValueOnce({
      ok: false,
      error: "db_error",
      message: "permission denied for table case_meta_override_audit",
    });
    render(<OverrideAuditSection />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(
      screen.getByText(/permission denied for table case_meta_override_audit/i),
    ).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith(
      "permission denied for table case_meta_override_audit",
    );
  });

  it("renders an empty state when loaded with zero rows", async () => {
    listCaseMetaOverrideAudit.mockResolvedValueOnce({ ok: true, rows: [] });
    render(<OverrideAuditSection />);
    await waitFor(() =>
      expect(screen.getByText(/No audit entries yet\./i)).toBeInTheDocument(),
    );
    // No "Show" toggle when there's nothing to expand.
    expect(screen.queryByRole("button", { name: /^Show$/ })).not.toBeInTheDocument();
  });

  it("renders the row count and a Show toggle when loaded with data", async () => {
    listCaseMetaOverrideAudit.mockResolvedValueOnce({
      ok: true,
      rows: [
        {
          id: "a1",
          override_id: "o1",
          case_key: "case14",
          field: "dataset_version",
          action: "accept",
          source: "ai_suggested",
          previous_value: null,
          new_value: "gridarena-case14@1.0.0",
          ai_model: "gpt-4o-mini",
          ai_rationale: "Matches sibling convention",
          created_at: "2026-04-29T10:00:00Z",
        },
      ],
    });
    render(<OverrideAuditSection />);
    await waitFor(() =>
      expect(screen.getByText(/Override audit trail \(1\)/)).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /^Show$/ })).toBeInTheDocument();
  });
});
