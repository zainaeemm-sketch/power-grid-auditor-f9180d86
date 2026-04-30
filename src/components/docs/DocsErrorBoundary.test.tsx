import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DocsErrorBoundary } from "@/components/docs/DocsErrorBoundary";

// React intentionally logs caught errors to console.error during tests.
// Silence to keep the test output readable; restore after each test.
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  consoleErrorSpy.mockRestore();
});

function Boom({ message = "kaboom" }: { message?: string }): JSX.Element {
  throw new Error(message);
}

describe("DocsErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <DocsErrorBoundary>
        <p>safe content</p>
      </DocsErrorBoundary>,
    );
    expect(screen.getByText("safe content")).toBeInTheDocument();
  });

  it("renders the fallback with the error message when a child throws", () => {
    render(
      <DocsErrorBoundary area="this docs page">
        <Boom message="server fn failed" />
      </DocsErrorBoundary>,
    );
    expect(
      screen.getByRole("alert", { name: "" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Something went wrong loading this docs page/i),
    ).toBeInTheDocument();
    expect(screen.getByText("server fn failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reload page/i })).toBeInTheDocument();
  });

  it("recovers when 'Try again' is clicked and the child no longer throws", async () => {
    const user = userEvent.setup();
    let shouldThrow = true;
    function MaybeBoom() {
      if (shouldThrow) throw new Error("first render fails");
      return <p>recovered content</p>;
    }
    render(
      <DocsErrorBoundary>
        <MaybeBoom />
      </DocsErrorBoundary>,
    );
    expect(screen.getByText("first render fails")).toBeInTheDocument();
    shouldThrow = false;
    await user.click(screen.getByRole("button", { name: /Try again/i }));
    expect(screen.getByText("recovered content")).toBeInTheDocument();
  });
});
