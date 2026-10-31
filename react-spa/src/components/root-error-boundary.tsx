import { Component, type ReactNode } from "react";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";
import {
  ErrorState,
  ErrorStateContent,
  ErrorStateDescription,
  ErrorStateHeader,
  ErrorStateMedia,
  ErrorStateTitle,
} from "@/components/ui/error-state.tsx";

/**
 * Catches errors thrown while rendering a page, such as a failed Convex
 * `useQuery`, and shows a recoverable error screen instead of a blank app.
 * "Try again", navigating to another page, or a hot update clears it.
 */
export function RootErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const queryErrorResetBoundary = useQueryErrorResetBoundary();

  return (
    <ErrorBoundary resetKey={pathname} onReset={queryErrorResetBoundary.reset}>
      {children}
    </ErrorBoundary>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
  onReset: () => void;
}

type ErrorBoundaryState =
  { hasError: false } | { hasError: true; error: unknown };

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    // The Hercules preview console picks up errors logged with this prefix.
    console.error("[Runtime Error]", error);
  }

  componentDidMount() {
    // Retry after a hot update so fixing the code clears the error.
    import.meta.hot?.on("vite:afterUpdate", this.retry);
  }

  componentWillUnmount() {
    // Vitest's `import.meta.hot` stub has no `off`.
    import.meta.hot?.off?.("vite:afterUpdate", this.retry);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey) {
      this.retry();
    }
  }

  retry = () => {
    if (!this.state.hasError) return;
    this.props.onReset();
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return <RootError error={this.state.error} onRetry={this.retry} />;
  }
}

function RootError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const message = error instanceof Error ? error.message : String(error ?? "");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <ErrorState role="alert" className="max-w-lg">
        <ErrorStateHeader>
          <ErrorStateMedia />
          <ErrorStateTitle>Something went wrong</ErrorStateTitle>
          <ErrorStateDescription>
            This page ran into a problem. Try again in a moment.
          </ErrorStateDescription>
        </ErrorStateHeader>
        <ErrorStateContent>
          {import.meta.env.DEV && message ? (
            <pre className="w-full overflow-auto rounded-md bg-muted p-3 text-left text-xs whitespace-pre-wrap text-muted-foreground">
              {message}
            </pre>
          ) : null}
          <Button onClick={onRetry}>Try again</Button>
        </ErrorStateContent>
      </ErrorState>
    </div>
  );
}
