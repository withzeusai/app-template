import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button.tsx";
import {
  ErrorState,
  ErrorStateContent,
  ErrorStateDescription,
  ErrorStateHeader,
  ErrorStateMedia,
  ErrorStateTitle,
} from "@/components/ui/error-state.tsx";

// Shows a reload prompt instead of a blank page when rendering crashes.
export class RootErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen bg-background p-4">
        <ErrorState>
          <ErrorStateHeader>
            <ErrorStateMedia />
            <ErrorStateTitle>Something went wrong</ErrorStateTitle>
            <ErrorStateDescription>
              Reload the page to try again.
            </ErrorStateDescription>
          </ErrorStateHeader>
          <ErrorStateContent>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </ErrorStateContent>
        </ErrorState>
      </div>
    );
  }
}
