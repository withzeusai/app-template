import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button.tsx";

/**
 * Catches errors thrown while rendering, such as a failed Convex `useQuery`,
 * and shows a reload screen instead of leaving the whole app blank.
 */
export class RootErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // The Hercules preview console picks up errors logged with this prefix.
    console.error("[Runtime Error]", error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <div
        role="alert"
        className="min-h-screen flex items-center justify-center bg-background p-6"
      >
        <div className="max-w-md space-y-6 text-center">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Something went wrong</h2>
            <p className="text-muted-foreground">
              Reload the page to try again.
            </p>
          </div>
          <Button onClick={() => window.location.reload()}>Reload page</Button>
        </div>
      </div>
    );
  }
}
