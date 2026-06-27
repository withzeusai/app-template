import { useCallback } from "react";
import { useAuthCallback } from "@usehercules/auth/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";

// The OIDC redirect handler is browser-only (reads auth params from the URL,
// uses the client-side UserManager), so this route opts out of SSR.
export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const updateCurrentUser = useMutation(api.users.updateCurrentUser);

  const onSync = useCallback(async () => {
    await updateCurrentUser();
  }, [updateCurrentUser]);

  const navigateHome = useCallback(
    () => navigate({ to: "/", replace: true }),
    [navigate],
  );

  const { status, error, retry } = useAuthCallback({
    isBackendAuthenticated: isConvexAuthenticated,
    onSync,
    onSuccess: navigateHome,
    onNoAuthParams: navigateHome,
  });

  if (status === "error" && error) {
    return (
      <div className="flex flex-col items-center justify-center h-svh gap-6 px-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-destructive font-medium">Something went wrong</p>
          <p className="text-sm text-muted-foreground max-w-md">{error}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={navigateHome}>
            Return home
          </Button>
          <Button onClick={retry}>Try again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-svh gap-4">
      <Spinner className="size-8" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  );
}
