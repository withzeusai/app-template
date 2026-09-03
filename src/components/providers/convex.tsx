import { useCallback, useMemo } from "react";
import { ConvexProviderWithAuth, type ConvexReactClient } from "convex/react";
import { useIdToken, useAuth } from "@usehercules/auth-tanstack/client";
import type { ClientUserInfo, NoUserInfo } from "@usehercules/auth-tanstack";
import { AuthProvider } from "./auth.tsx";

/**
 * Bridge Hercules auth into Convex's generic auth integration.
 *
 * `ConvexProviderWithAuth` expects `{ isLoading, isAuthenticated,
 * fetchAccessToken }` and calls `fetchAccessToken` when that object changes
 * identity — and not otherwise. Two rules follow from that:
 *
 * - `isAuthenticated` means "an ID token exists", not "a session exists". The
 *   auth provider is seeded with `initialAuth` during SSR, so `user` is set
 *   from the very first client render, before the token store has fetched
 *   anything. Reporting authenticated then spends Convex's single request on
 *   a cold store; if it comes back empty the client stays unauthenticated for
 *   the life of the page even once the token lands.
 * - `fetchAccessToken` never resolves `null` for a live session. Convex reads
 *   `null` as "signed out" and will not ask again. It forces a refresh right
 *   after confirming the cached token (and again ahead of expiry); a refresh
 *   can legitimately come back empty — no refresh token was issued, or the
 *   grant failed transiently — so fall back to the current ID token.
 */
function useConvexHerculesAuth() {
  const { user, loading } = useAuth();
  const { idToken, loading: tokenLoading, getIdToken, refresh } = useIdToken();
  const isAuthenticated = user !== null && idToken != null;

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      try {
        if (forceRefreshToken) {
          const refreshed = await refresh().catch(() => undefined);
          if (refreshed) return refreshed;
        }
        const token = await getIdToken();
        return token ?? null;
      } catch {
        // Resolve rather than reject: Convex treats a rejection as "no token"
        // and will not ask again until this hook's identity changes. The token
        // store schedules its own retry and re-renders us when it lands.
        return null;
      }
    },
    [getIdToken, refresh],
  );

  // `isAuthenticated` belongs on the memo, not the callback: Convex re-runs
  // the fetcher when this object's identity changes, so the sign-in/out flip
  // and the token landing are both covered here without making the callback
  // itself unstable.
  return useMemo(
    () => ({
      // Once authenticated, stay out of the loading state: a background
      // refresh must not flip Convex's `AuthLoading` back on and unmount
      // everything under `Authenticated`.
      isLoading: isAuthenticated ? false : loading || tokenLoading,
      isAuthenticated,
      fetchAccessToken,
    }),
    [loading, tokenLoading, isAuthenticated, fetchAccessToken],
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
