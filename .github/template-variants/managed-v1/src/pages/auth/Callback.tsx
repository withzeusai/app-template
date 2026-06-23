import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useAuthCallback } from "@usehercules/auth/react";
import type { IamDeploymentEntryResult } from "@usehercules/convex/iam-management";
import { useAction, useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";

type EntryState = "pending" | "denied" | null;

interface EntryActionsProps {
  actionFailed: boolean;
  isChecking: boolean;
  isSigningOut: boolean;
  onCheckAgain: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

function EntryActions({
  actionFailed,
  isChecking,
  isSigningOut,
  onCheckAgain,
  onSignOut,
}: EntryActionsProps) {
  const isBusy = isChecking || isSigningOut;

  return (
    <>
      {actionFailed && (
        <p className="text-sm text-destructive" role="alert">
          We couldn't complete that action. Please try again.
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={isBusy}
          onClick={onSignOut}
        >
          {isSigningOut && <Spinner />}
          {isSigningOut ? "Signing out..." : "Sign out"}
        </Button>
        <Button type="button" disabled={isBusy} onClick={onCheckAgain}>
          {isChecking && <Spinner />}
          {isChecking ? "Checking..." : "Check again"}
        </Button>
      </div>
    </>
  );
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const { signout, user } = useAuth();
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

  const getIdToken = useCallback(() => {
    const idToken = user?.id_token?.trim();
    if (!idToken) {
      throw new Error("Your sign-in session is incomplete. Please try again.");
    }
    return idToken;
  }, [user?.id_token]);

  const handleEntryResult = useCallback(
    (result: IamDeploymentEntryResult) => {
      if (result.allowed) {
        navigateHome();
        return;
      }

      setEntryState(
        result.status === "pending_approval" ? "pending" : "denied",
      );
    },
    [navigateHome],
  );

  const onSync = useCallback(async () => {
    const idToken = getIdToken();
    const [, entryResult] = await Promise.all([
      updateCurrentUser(),
      enterDeployment({ idToken }),
    ]);
    handleEntryResult(entryResult);
  }, [enterDeployment, getIdToken, handleEntryResult, updateCurrentUser]);

  const { status, retry } = useAuthCallback({
    isBackendAuthenticated: isConvexAuthenticated,
    onSync,
    onNoAuthParams: navigateHome,
  });

  const handleCheckAgain = useCallback(async () => {
    setIsChecking(true);
    setActionFailed(false);

    try {
      const entryResult = await enterDeployment({ idToken: getIdToken() });
      handleEntryResult(entryResult);
    } catch {
      setActionFailed(true);
    } finally {
      setIsChecking(false);
    }
  }, [enterDeployment, getIdToken, handleEntryResult]);

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

  if (entryState === "pending") {
    return (
      <main className="flex min-h-svh items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Your access request is pending
            </h1>
            <p className="text-sm text-muted-foreground">
              An app administrator needs to approve your request before you can
              continue.
            </p>
          </div>
          <EntryActions
            actionFailed={actionFailed}
            isChecking={isChecking}
            isSigningOut={isSigningOut}
            onCheckAgain={handleCheckAgain}
            onSignOut={handleSignOut}
          />
        </div>
      </main>
    );
  }

  if (entryState === "denied") {
    return (
      <main className="flex min-h-svh items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              You don't have access
            </h1>
            <p className="text-sm text-muted-foreground">
              Your account cannot access this app.
            </p>
          </div>
          <EntryActions
            actionFailed={actionFailed}
            isChecking={isChecking}
            isSigningOut={isSigningOut}
            onCheckAgain={handleCheckAgain}
            onSignOut={handleSignOut}
          />
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex min-h-svh items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Something went wrong
            </h1>
            <p className="text-sm text-muted-foreground">
              We couldn't finish signing you in. Please try again.
            </p>
          </div>
          {actionFailed && (
            <p className="text-sm text-destructive" role="alert">
              We couldn't sign you out. Please try again.
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={isSigningOut}
              onClick={handleSignOut}
            >
              {isSigningOut && <Spinner />}
              {isSigningOut ? "Signing out..." : "Sign out"}
            </Button>
            <Button
              type="button"
              disabled={isSigningOut}
              onClick={() => void retry()}
            >
              Try again
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4">
      <Spinner className="size-8" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </main>
  );
}
