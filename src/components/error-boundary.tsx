import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  ErrorState,
  ErrorStateContent,
  ErrorStateDescription,
  ErrorStateHeader,
  ErrorStateMedia,
  ErrorStateTitle,
} from "@/components/ui/error-state.tsx";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

// Without a boundary, any render-time throw (including a Convex `useQuery` that
// errors mid auth-initialization) unmounts the whole tree to a blank screen.
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <ErrorState>
            <ErrorStateHeader>
              <ErrorStateMedia variant="icon" />
              <ErrorStateTitle>Something went wrong</ErrorStateTitle>
              <ErrorStateDescription>
                The page ran into an unexpected error. Reloading usually fixes
                it.
              </ErrorStateDescription>
            </ErrorStateHeader>
            <ErrorStateContent>
              <Button onClick={() => window.location.reload()}>
                <RefreshCwIcon />
                Reload page
              </Button>
            </ErrorStateContent>
          </ErrorState>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
