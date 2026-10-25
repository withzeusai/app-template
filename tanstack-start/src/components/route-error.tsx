import { useCallback, useEffect } from "react";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@/components/ui/button.tsx";

export default function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const queryErrorResetBoundary = useQueryErrorResetBoundary();

  const retry = useCallback(() => {
    queryErrorResetBoundary.reset();
    reset();
    void router.invalidate();
  }, [queryErrorResetBoundary, reset, router]);

  useEffect(() => {
    // The Hercules preview console picks up errors logged with this prefix.
    console.error("[Runtime Error]", error);
  }, [error]);

  useEffect(() => {
    // Retry after a hot update so fixing the code clears the error.
    const hot = import.meta.hot;
    if (!hot) return;
    hot.on("vite:afterUpdate", retry);
    return () => hot.off("vite:afterUpdate", retry);
  }, [retry]);

  const message = error instanceof Error ? error.message : String(error ?? "");

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Something went wrong</h2>
          <p className="text-muted-foreground">
            This page ran into a problem. Try again in a moment.
          </p>
        </div>
        {import.meta.env.DEV && message ? (
          <pre className="overflow-auto rounded-md bg-muted p-3 text-left text-xs whitespace-pre-wrap text-muted-foreground">
            {message}
          </pre>
        ) : null}
        <Button onClick={retry}>Try again</Button>
      </div>
    </div>
  );
}
