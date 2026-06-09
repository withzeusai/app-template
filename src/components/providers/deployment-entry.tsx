import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@usehercules/auth/react";
import { useAction, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";

type EntryStatus = "active" | "blocked" | "suspended" | "pending_approval";

type EntryDecision = {
  allowed: boolean;
  status?: EntryStatus;
};

type EntryState =
  | { identityKey: string; status: "allowed" }
  | { identityKey: string; status: "pending" }
  | { identityKey: string; status: "denied" }
  | { identityKey: string; status: "error" };

const entryRequests = new Map<string, Promise<EntryDecision>>();
const ENTRY_TIMEOUT_MS = 15_000;

function withEntryTimeout(request: Promise<EntryDecision>): Promise<EntryDecision> {
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
        reject(error instanceof Error ? error : new Error("Deployment entry failed"));
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

  const pending = request();
  entryRequests.set(identityKey, pending);
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
    setEntryState(null);
    setRetryVersion((version) => version + 1);
  };

  const reauthenticate = async () => {
    retry();
    await auth.signin();
  };

  useEffect(() => {
    if (!canCheckEntry || identityKey === null) {
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
        // `pending_approval` (e.g. a not-yet-allowlisted user) is NOT a hard
        // denial: an admin may still approve them. Surface it distinctly rather
        // than collapsing it into "Access denied".
        const resolved = decision.allowed
          ? "allowed"
          : decision.status === "pending_approval"
            ? "pending"
            : "denied";
        setEntryState({ identityKey, status: resolved });
      },
      () => {
        if (!active) {
          return;
        }
        setEntryState({ identityKey, status: "error" });
      },
    );

    return () => {
      active = false;
    };
  }, [canCheckEntry, enterDeployment, idToken, identityKey, retryVersion]);

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
        title="Unable to check access"
        retryLabel="Sign in again"
        onRetry={reauthenticate}
        onSignOut={auth.signout}
      />
    );
  }

  const currentState =
    entryState?.identityKey === identityKey ? entryState.status : null;

  if (currentState === "allowed") {
    return children;
  }

  if (currentState === "pending") {
    return (
      <EntryFailureState
        title="Access pending approval"
        description="Your access to this deployment is awaiting approval. Check back after it has been reviewed."
        retryLabel="Check again"
        onRetry={retry}
        onSignOut={auth.signout}
      />
    );
  }

  if (currentState === "denied") {
    return (
      <EntryFailureState
        title="Access denied"
        onRetry={retry}
        onSignOut={auth.signout}
      />
    );
  }

  if (currentState === "error") {
    return (
      <EntryFailureState
        title="Unable to check access"
        onRetry={retry}
        onSignOut={auth.signout}
      />
    );
  }

  return <EntryLoadingState />;
}

function EntryLoadingState() {
  return (
    <div className="flex h-svh flex-col items-center justify-center gap-4">
      <Spinner className="size-8" />
      <p className="text-sm text-muted-foreground">Checking access...</p>
    </div>
  );
}

function EntryFailureState({
  title,
  description = "Your access could not be confirmed for this deployment.",
  onRetry,
  retryLabel = "Retry",
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
            Unable to sign out.
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
