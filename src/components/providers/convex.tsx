import type { ConvexReactClient } from "convex/react";
import { ConvexProviderWithHerculesAuth } from "@usehercules/auth-tanstack/convex";
import type { ClientUserInfo, NoUserInfo } from "@usehercules/auth-tanstack";
import { AuthProvider } from "./auth.tsx";

/**
 * Wires the Convex client into the app.
 *
 * `ConvexProviderWithHerculesAuth` bridges the Hercules session into Convex's
 * auth integration: it reports authenticated once an ID token exists, hands
 * Convex the freshest token on every (forced) refresh, and never resolves
 * `null` for a live session — Convex reads `null` as "signed out" and will not
 * ask again for the life of the page.
 *
 * The provider is mounted unconditionally on both the server and the client
 * so that `Authenticated` / `Unauthenticated` / `AuthLoading` (which require a
 * Convex auth provider as an ancestor) can render during SSR. Caveat: Convex's
 * `isAuthenticated` only flips true after the client WebSocket presents the
 * token and the backend confirms it, so `Authenticated` children are absent
 * from the SSR HTML and appear shortly after hydration (`AuthLoading` shows in
 * the meantime). For signed-in content that must be server-rendered, fetch it
 * in a route loader via `convexQuery()` — the SSR HTTP client is authenticated
 * in `__root.tsx` — and gate UI on `useAuth().user`, which IS seeded from
 * `initialAuth` and therefore correct in the SSR HTML with no loading flash.
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
      <ConvexProviderWithHerculesAuth client={client}>
        {children}
      </ConvexProviderWithHerculesAuth>
    </AuthProvider>
  );
}
