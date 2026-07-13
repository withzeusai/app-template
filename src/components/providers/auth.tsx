import { HerculesAuthProvider } from "@usehercules/auth-tanstack/client";
import type { ClientUserInfo, NoUserInfo } from "@usehercules/auth-tanstack";

/**
 * Provides reactive auth state (`useAuth`, `useAccessToken`, …) to the tree.
 *
 * OIDC configuration lives server-side (the `HERCULES_AUTH_*` env vars); the
 * provider just reads the sealed session cookie via server functions, so there
 * is nothing to configure here. `initialAuth` is the sanitized session fetched
 * during SSR (see `__root.tsx`'s `beforeLoad`); seeding it means `useAuth()`
 * returns the real user on the server render and hydrates without a loading
 * flash. The client keeps the session fresh from there.
 */
export function AuthProvider({
  initialAuth,
  children,
}: {
  initialAuth?: ClientUserInfo | NoUserInfo;
  children: React.ReactNode;
}) {
  return (
    <HerculesAuthProvider initialAuth={initialAuth}>
      {children}
    </HerculesAuthProvider>
  );
}
