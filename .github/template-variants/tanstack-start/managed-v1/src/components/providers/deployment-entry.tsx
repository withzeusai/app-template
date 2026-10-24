import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@usehercules/auth/react";
import { useAction, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";

type EntryStatus =
  "active" | "blocked" | "suspended" | "pending_approval" | "removed";

type EntryDecision = {
  allowed: boolean;
  status?: EntryStatus;
};

type EntryStateStatus =
  | "allowed"
  | "blocked"
  | "suspended"
  | "pending_approval"
  | "removed"
  | "denied"
  | "error";

type EntryState = {
  identityKey: string;
  status: EntryStateStatus;
};

const entryRequests = new Map<string, Promise<EntryDecision>>();
const ENTRY_TIMEOUT_MS = 15_000;

function withEntryTimeout(
  request: Promise<EntryDecision>,
): Promise<EntryDecision> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("Deployment entry timed out")),
      ENTRY_TIMEOUT_MS,
    );
    void request.then(
      (decision) => {
        window.clearTimeout(timeout);
        resolve(decision);
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(
          error instanceof Error ? error : new Error("Deployment entry failed"),
        );
      },
    );
  });
}

function getOrCreateEntryRequest(
  identityKey: string,
  request: () => Promise<EntryDecision>,
): Promise<EntryDecision> {
  const existing = entryRequests.get(identityKey);
  if (existing) {
    return existing;
  }

  let pending: Promise<EntryDecision>;
  try {
    pending = Promise.resolve(request());
  } catch (error) {
    pending = Promise.reject(error);
  }
  entryRequests.set(identityKey, pending);
  const clearPending = () => {
    if (entryRequests.get(identityKey) === pending) {
      entryRequests.delete(identityKey);
    }
  };
  void pending.then(clearPending, clearPending);
  return pending;
}

export function DeploymentEntryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const convexAuth = useConvexAuth();
  const enterDeployment = useAction(api.accessUser.enterDeployment);
  const [entryState, setEntryState] = useState<EntryState | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const [checkedIdentityKey, setCheckedIdentityKey] = useState<string | null>(
    null,
  );

  const identityKey = useMemo(() => {
    const issuer = auth.user?.profile.iss;
    const subject = auth.user?.profile.sub;
    return issuer && subject ? `${issuer}\u0000${subject}` : null;
  }, [auth.user?.profile.iss, auth.user?.profile.sub]);

  const idToken = auth.user?.id_token?.trim() ?? "";
  const canCheckEntry =
    auth.isAuthenticated &&
    !auth.isLoading &&
    convexAuth.isAuthenticated &&
    !convexAuth.isLoading &&
    identityKey !== null &&
    idToken.length > 0;

  const retry = () => {
    if (identityKey !== null) {
      entryRequests.delete(identityKey);
    }
    setCheckedIdentityKey(null);
    setEntryState(null);
    setRetryVersion((version) => version + 1);
  };

  const reauthenticate = async () => {
    retry();
    await auth.signin();
  };

  // Drop the recorded check when the session ends, so signing back in
  // re-verifies access instead of trusting the previous decision.
  const [wasAuthenticated, setWasAuthenticated] = useState(
    auth.isAuthenticated,
  );
  if (wasAuthenticated !== auth.isAuthenticated) {
    setWasAuthenticated(auth.isAuthenticated);
    if (!auth.isAuthenticated) {
      setCheckedIdentityKey(null);
    }
  }

  useEffect(() => {
    if (
      !canCheckEntry ||
      identityKey === null ||
      checkedIdentityKey === identityKey
    ) {
      return;
    }

    let active = true;
    const request = getOrCreateEntryRequest(identityKey, () =>
      withEntryTimeout(enterDeployment({ idToken })),
    );

    void request.then(
      (decision) => {
        if (!active) {
          return;
        }
        const resolved: EntryStateStatus = decision.allowed
          ? "allowed"
          : decision.status && decision.status !== "active"
            ? decision.status
            : "denied";
        setCheckedIdentityKey(identityKey);
        setEntryState({ identityKey, status: resolved });
      },
      () => {
        if (!active) {
          return;
        }
        setCheckedIdentityKey(identityKey);
        setEntryState({ identityKey, status: "error" });
      },
    );

    return () => {
      active = false;
    };
  }, [
    canCheckEntry,
    checkedIdentityKey,
    enterDeployment,
    idToken,
    identityKey,
    retryVersion,
  ]);

  if (auth.isLoading) {
    return <EntryLoadingState />;
  }

  if (!auth.isAuthenticated) {
    return children;
  }

  if (convexAuth.isLoading) {
    return <EntryLoadingState />;
  }

  if (
    !convexAuth.isAuthenticated ||
    identityKey === null ||
    idToken.length === 0
  ) {
    return (
      <EntryFailureState
        title="We couldn't check your access"
        retryLabel="Sign in again"
        onRetry={reauthenticate}
        onSignOut={auth.signout}
      />
    );
  }

  const currentState =
    checkedIdentityKey === identityKey &&
    entryState?.identityKey === identityKey
      ? entryState.status
      : null;

  if (currentState === "allowed") {
    return children;
  }

  if (currentState === "pending_approval") {
    return (
      <EntryFailureState
        title="Approval pending"
        description="Your request is waiting for approval. Check again after an administrator reviews it."
        retryLabel="Check again"
        onRetry={retry}
        onSignOut={auth.signout}
      />
    );
  }

  if (currentState === "blocked" || currentState === "denied") {
    return (
      <EntryFailureState
        title="You don't have access"
        description="This account is not allowed to access this app."
        onRetry={retry}
        onSignOut={auth.signout}
      />
    );
  }

  if (currentState === "suspended") {
    return (
      <EntryFailureState
        title="Your access is suspended"
        description="Contact an administrator if you think this is a mistake."
        onRetry={retry}
        onSignOut={auth.signout}
      />
    );
  }

  if (currentState === "removed") {
    return (
      <EntryFailureState
        title="You no longer have access"
        description="Contact an administrator if you need access again."
        onRetry={retry}
        onSignOut={auth.signout}
      />
    );
  }

  if (currentState === "error") {
    return (
      <EntryFailureState
        title="We couldn't check your access"
        onRetry={retry}
        onSignOut={auth.signout}
      />
    );
  }

  return <EntryLoadingState />;
}

function EntryLoadingState() {
  return (
    <div className="flex h-svh items-center justify-center">
      <Spinner className="size-8" />
    </div>
  );
}

function EntryFailureState({
  title,
  description = "Try again. If the problem continues, sign in again.",
  onRetry,
  retryLabel = "Try again",
  onSignOut,
}: {
  title: string;
  description?: string;
  onRetry: () => void | Promise<void>;
  retryLabel?: string;
  onSignOut: () => Promise<void>;
}) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  const signOut = async () => {
    setIsSigningOut(true);
    setSignOutFailed(false);
    try {
      await onSignOut();
    } catch {
      setSignOutFailed(true);
      setIsSigningOut(false);
    }
  };

  return (
    <div className="flex h-svh flex-col items-center justify-center gap-6 px-4">
      <div className="flex max-w-md flex-col items-center gap-2 text-center">
        <p className="font-medium text-destructive">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
        {signOutFailed ? (
          <p className="text-sm text-destructive" role="alert">
            We couldn't sign you out. Try again.
          </p>
        ) : null}
      </div>
      <div className="flex gap-3">
        <Button
          variant="secondary"
          disabled={isSigningOut}
          onClick={() => void signOut()}
        >
          {isSigningOut ? "Signing out..." : "Sign out"}
        </Button>
        <Button disabled={isSigningOut} onClick={() => void onRetry()}>
          {retryLabel}
        </Button>
      </div>
    </div>
  );
}
