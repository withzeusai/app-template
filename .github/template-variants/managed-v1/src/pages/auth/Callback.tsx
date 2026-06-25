import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useAuthCallback } from "@usehercules/auth/react";
import { useAction, useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  IamAccessStateView,
  type IamAccessState,
} from "@/components/iam/access-state.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";

type CallbackAccessState = Extract<
  IamAccessState,
  | "pending_approval"
  | "blocked"
  | "suspended"
  | "removed"
  | "missing"
  | "access_denied"
> | null;

export default function AuthCallback() {
  const navigate = useNavigate();
  const { signout } = useAuth();
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const updateCurrentUser = useMutation(api.users.updateCurrentUser);
  const evaluateAccess = useAction(api.iam.evaluateAccess);
  const [accessState, setAccessState] = useState<CallbackAccessState>(null);
  const [isChecking, setIsChecking] = useState(false);
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

      setAccessState(
        result.status && result.status !== "active"
          ? result.status
          : "access_denied",
      );
    },
    [navigateHome],
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

  const handleCheckAgain = useCallback(async () => {
    setIsChecking(true);
    setActionFailed(false);

    try {
      const accessResult = await evaluateAccess({});
      handleAccessResult(accessResult);
    } catch {
      setActionFailed(true);
    } finally {
      setIsChecking(false);
    }
  }, [evaluateAccess, handleAccessResult]);

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

  if (accessState) {
    return (
      <IamAccessStateView
        state={accessState}
        actionFailed={actionFailed}
        isChecking={isChecking}
        isSigningOut={isSigningOut}
        onCheckAgain={
          accessState === "pending_approval" || accessState === "missing"
            ? handleCheckAgain
            : undefined
        }
        onSignOut={handleSignOut}
      />
    );
  }

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
