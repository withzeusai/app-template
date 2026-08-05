import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useAuthCallback } from "@usehercules/auth/react";
import { useAction, useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  getAuthAccessRoute,
  IamAccessStateView,
} from "@/components/providers/hercules-iam.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";

// Post-sign-in destination round-tripped through OIDC state by
// signin({ returnTo }). Same-app paths only, never back into /auth/*.
// Checks run on the raw AND decoded value: percent-encoding must not smuggle
// an /auth path past the guard, backslashes normalize cross-origin in URLs.
function getReturnTo(state: unknown): string | null {
  if (typeof state !== "object" || state === null) return null;
  const { returnTo } = state as { returnTo?: unknown };
  if (typeof returnTo !== "string" || !returnTo.startsWith("/")) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(returnTo);
  } catch {
    return null;
  }
  for (const value of [returnTo, decoded]) {
    if (value.startsWith("//") || value.includes("\\")) return null;
    if (/^\/auth(\/|$)/.test(value)) return null;
  }
  return returnTo;
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const { signout, user } = useAuth();
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
        navigate(getReturnTo(user?.state) ?? "/", { replace: true });
        return;
      }
      navigate(getAuthAccessRoute(result.status), { replace: true });
    },
    [navigate, user],
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
