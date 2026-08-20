import { useCallback, useMemo } from "react";
import { ConvexProviderWithAuth, type ConvexReactClient } from "convex/react";
import { useIdToken, useAuth } from "@usehercules/auth-tanstack/client";
import type { ClientUserInfo, NoUserInfo } from "@usehercules/auth-tanstack";
import { AuthProvider } from "./auth.tsx";

/**
 * Bridge Hercules auth into Convex's generic auth integration.
 *
 * `ConvexProviderWithAuth` expects `{ isLoading, isAuthenticated,
 * fetchAccessToken }`. `fetchAccessToken` returns the Hercules ID token, and
 * Convex calls it again with `forceRefreshToken` before expiry, so long
 * sessions stay authenticated on the client.
 */
function useConvexHerculesAuth() {
  const { user, loading } = useAuth();
  const { getIdToken, refresh } = useIdToken();
  const isAuthenticated = user !== null;

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      const token = forceRefreshToken ? await refresh() : await getIdToken();
      return token ?? null;
    },
    [getIdToken, refresh],
  );

  // `isAuthenticated` belongs on the memo, not the callback: Convex re-runs
  // the fetcher when this object's identity changes, so the sign-in/out flip
  // is already covered here without making the callback itself unstable.

  return useMemo(
    () => ({ isLoading: loading, isAuthenticated, fetchAccessToken }),
    [loading, isAuthenticated, fetchAccessToken],
  );
}

/**
 * Wires the Convex client into the app.
 *
 * The authenticated provider is mounted unconditionally on both the server and
 * the client so that `Authenticated` / `Unauthenticated` / `AuthLoading` (which
 * require `ConvexProviderWithAuth` as an ancestor) can render during SSR.
 * Caveat: Convex's `isAuthenticated` only flips true after the client
 * WebSocket presents the token and the backend confirms it, so `Authenticated`
 * children are absent from the SSR HTML and appear shortly after hydration
 * (`AuthLoading` shows in the meantime). For signed-in content that must be
 * server-rendered, fetch it in a route loader via `convexQuery()` — the SSR
 * HTTP client is authenticated in `__root.tsx` — and gate UI on
 * `useAuth().user`, which IS seeded from `initialAuth` and therefore correct
 * in the SSR HTML with no loading flash.
 */
export function ConvexAppProvider({
  client,
  initialAuth,
  children,
}: {
  client: ConvexReactClient;
  initialAuth?: ClientUserInfo | NoUserInfo;
  children: React.ReactNode;
}) {
  return (
    <AuthProvider initialAuth={initialAuth}>
      <ConvexProviderWithAuth client={client} useAuth={useConvexHerculesAuth}>
        {children}
      </ConvexProviderWithAuth>
    </AuthProvider>
  );
}
