import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = { children: ReactNode };
type AppErrorBoundaryState = { hasError: boolean };

/**
 * Last-resort boundary around the whole app, mounted from `src/main.tsx`.
 *
 * Without it, any error thrown while rendering (a Convex query that throws, a
 * bad value from local storage, a chunk that failed to load) unmounts the
 * entire React tree and leaves the end user on a blank white screen with no
 * way to recover. Installed home-screen apps have no address bar, so a reload
 * button is the only way out.
 *
 * The fallback uses plain elements rather than the UI kit so it still renders
 * when the error came from a shared component.
 */
export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Unhandled error while rendering the app:", error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4 text-center text-foreground">
        <div className="flex flex-col items-center gap-2">
          <p className="font-medium">Something went wrong</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Reload the page to try again.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="rounded-md border px-4 py-2 text-sm font-medium"
            onClick={() => window.location.assign("/")}
          >
            Go home
          </button>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
