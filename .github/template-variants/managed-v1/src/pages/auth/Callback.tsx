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

type EntryState = Extract<
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
  const enterDeployment = useAction(api.iam.enterDeployment);
  const [entryState, setEntryState] = useState<EntryState>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);

  const navigateHome = useCallback(
    () => navigate("/", { replace: true }),
    [navigate],
  );

  const handleEntryResult = useCallback(
    (result: Awaited<ReturnType<typeof enterDeployment>>) => {
      if (result.allowed) {
        navigateHome();
        return;
      }

      setEntryState(
        result.status && result.status !== "active"
          ? result.status
          : "access_denied",
      );
    },
    [navigateHome],
  );

  const onSync = useCallback(async () => {
    const [, entryResult] = await Promise.all([
      updateCurrentUser(),
      enterDeployment({}),
    ]);
    handleEntryResult(entryResult);
  }, [enterDeployment, handleEntryResult, updateCurrentUser]);

  const { status, retry } = useAuthCallback({
    isBackendAuthenticated: isConvexAuthenticated,
    onSync,
    onNoAuthParams: navigateHome,
  });

  const handleCheckAgain = useCallback(async () => {
    setIsChecking(true);
    setActionFailed(false);

    try {
      const entryResult = await enterDeployment({});
      handleEntryResult(entryResult);
    } catch {
      setActionFailed(true);
    } finally {
      setIsChecking(false);
    }
  }, [enterDeployment, handleEntryResult]);

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

  if (entryState) {
    return (
      <IamAccessStateView
        state={entryState}
        actionFailed={actionFailed}
        isChecking={isChecking}
        isSigningOut={isSigningOut}
        onCheckAgain={
          entryState === "pending_approval" || entryState === "missing"
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
