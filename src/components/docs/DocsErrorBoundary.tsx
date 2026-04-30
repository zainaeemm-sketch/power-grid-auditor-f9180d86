import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type Props = {
  children: ReactNode;
  /** Optional label used in the heading, e.g. "this docs page". */
  area?: string;
};

type State = {
  error: Error | null;
  /** Bumped after a reset so React re-mounts children with fresh state. */
  resetKey: number;
};

/**
 * Class-based error boundary for the documentation routes.
 *
 * Why class-based: React's official error-boundary API is `componentDidCatch`
 * + `getDerivedStateFromError`, which only exist on classes. Functional
 * boundaries (e.g. react-error-boundary) work too, but we don't want a new
 * dependency just for one wrapper.
 *
 * Scope: catches *render-time* errors thrown by descendants — including
 * unhandled `throw` from server-function callers that bubble up during a
 * render (or via Suspense). It does NOT catch errors thrown inside async
 * callbacks/event handlers; those are already toasted by
 * `normalizeServerFnError` callers and never reach React's render pipeline.
 *
 * Behavior:
 *   - Renders a friendly fallback (no blank screen) with the error message.
 *   - "Try again" resets the boundary by remounting children with a new key.
 *   - "Reload page" forces a hard reload as a last-resort escape hatch.
 *   - Logs to console in dev so the original stack is still inspectable.
 */
export class DocsErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface the original error so devs can still drill in via console.
    console.error("[DocsErrorBoundary] caught render error:", error, info);
  }

  private handleReset = () => {
    this.setState((s) => ({ error: null, resetKey: s.resetKey + 1 }));
  };

  private handleReload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    const { error, resetKey } = this.state;
    if (!error) {
      // `key` ensures children fully remount on reset, clearing local state
      // so a transient failure isn't permanently sticky.
      return <div key={resetKey}>{this.props.children}</div>;
    }

    const area = this.props.area ?? "this page";
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="not-prose mx-auto my-10 max-w-xl rounded-lg border border-red-500/40 bg-red-500/5 p-6 text-sm text-red-100 shadow-sm"
      >
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-300" aria-hidden="true" />
          <h2 className="text-base font-semibold text-red-50">
            Something went wrong loading {area}.
          </h2>
        </div>
        <p className="mb-3 text-red-100/80">
          A request failed unexpectedly. You can retry the section, or reload
          the whole page if the problem persists.
        </p>
        <pre
          // Keep the error visible but contained — long stacks shouldn't blow
          // up the layout, and we only show the message (not the full stack).
          className="mb-4 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded border border-red-500/30 bg-red-950/40 p-2 font-mono text-[11px] text-red-100/90"
        >
          {error.message || String(error)}
        </pre>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-1.5 rounded border border-red-400/50 bg-red-500/15 px-3 py-1 text-xs font-medium text-red-50 hover:bg-red-500/25"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Try again
          </button>
          <button
            type="button"
            onClick={this.handleReload}
            className="inline-flex items-center gap-1.5 rounded border border-red-400/30 bg-transparent px-3 py-1 text-xs font-medium text-red-100/80 hover:bg-red-500/10"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
