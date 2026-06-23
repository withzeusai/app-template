import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "@usehercules/auth/react";
import { useAction, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api.js";

const entryRequests = new Map<string, Promise<void>>();

function getOrCreateEntryRequest(
  identityKey: string,
  request: () => Promise<unknown>,
): Promise<void> {
  const existing = entryRequests.get(identityKey);
  if (existing) {
    return existing;
  }

  const pending = Promise.resolve()
    .then(request)
    .then(
      () => undefined,
      () => undefined,
    );
  entryRequests.set(identityKey, pending);

  void pending.finally(() => {
    if (entryRequests.get(identityKey) === pending) {
      entryRequests.delete(identityKey);
    }
  });

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
  const checkedIdentityKey = useRef<string | null>(null);

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

  useEffect(() => {
    if (!auth.isAuthenticated) {
      checkedIdentityKey.current = null;
    }
  }, [auth.isAuthenticated]);

  useEffect(() => {
    if (
      !canCheckEntry ||
      identityKey === null ||
      checkedIdentityKey.current === identityKey
    ) {
      return;
    }

    checkedIdentityKey.current = identityKey;
    void getOrCreateEntryRequest(identityKey, () =>
      enterDeployment({ idToken }),
    );
  }, [canCheckEntry, enterDeployment, idToken, identityKey]);

  return children;
}
