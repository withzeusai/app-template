import { useCallback, useMemo } from "react";
import {
  ConvexProvider,
  ConvexProviderWithAuth,
  type ConvexReactClient,
} from "convex/react";
import { useIdToken, useAuth } from "@usehercules/auth-tanstack/client";
import { AuthProvider } from "./auth.tsx";

/**
 * Bridge Hercules auth into Convex's generic auth integration.
 *
 * `ConvexProviderWithAuth` expects `{ isLoading, isAuthenticated,
 * fetchAccessToken }`.
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
    // Re-create when auth flips so Convex re-runs the fetcher on sign-in/out.
    [getIdToken, refresh, isAuthenticated],
  );

  return useMemo(
    () => ({ isLoading: loading, isAuthenticated, fetchAccessToken }),
    [loading, isAuthenticated, fetchAccessToken],
  );
}

/**
 * Wires the Convex client into the app.
 *
 * The access token is only available in the browser, so on the server we render
 * a plain `ConvexProvider` (public/unauthenticated queries can still SSR) and
 * mount the authenticated wiring on the client. The same Convex client instance
 * is used in both environments, so hydration is seamless.
 */
export function ConvexAppProvider({
  client,
  children,
}: {
  client: ConvexReactClient;
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      {typeof window === "undefined" ? (
        <ConvexProvider client={client}>{children}</ConvexProvider>
      ) : (
        <ConvexProviderWithAuth client={client} useAuth={useConvexHerculesAuth}>
          {children}
        </ConvexProviderWithAuth>
      )}
    </AuthProvider>
  );
}
