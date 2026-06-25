import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useAuthCallback } from "@usehercules/auth/react";
import { useAction, useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { IamAccessStateView } from "@/components/iam/access-state.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { getAuthAccessRoute } from "./access-routes.ts";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { signout } = useAuth();
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const updateCurrentUser = useMutation(api.users.updateCurrentUser);
  const evaluateAccess = useAction(api.iam.evaluateAccess);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);

  const navigateHome = useCallback(
    () => navigate("/", { replace: true }),
    [navigate],
  );

  const handleAccessResult = useCallback(
    (result: Awaited<ReturnType<typeof evaluateAccess>>) => {
      if (result.allowed) {
        navigateHome();
        return;
      }
      navigate(getAuthAccessRoute(result.status), { replace: true });
    },
    [navigate, navigateHome],
  );

  const onSync = useCallback(async () => {
    const [, accessResult] = await Promise.all([
      updateCurrentUser(),
      evaluateAccess({}),
    ]);
    handleAccessResult(accessResult);
  }, [evaluateAccess, handleAccessResult, updateCurrentUser]);

  const { status, retry } = useAuthCallback({
    isBackendAuthenticated: isConvexAuthenticated,
    onSync,
    onNoAuthParams: navigateHome,
  });

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    setActionFailed(false);

    try {
      await signout();
    } catch {
      setActionFailed(true);
      setIsSigningOut(false);
    }
  }, [signout]);

  if (status === "error") {
    return (
      <IamAccessStateView
        state="error"
        actionFailed={actionFailed}
        isSigningOut={isSigningOut}
        onRetry={retry}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4">
      <Spinner className="size-8" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </main>
  );
}
